<?php
/**
 * Payment route handlers (Flutterwave integration)
 */

function handleInitiatePayment(Database $db, array $body) {
    $userId = $body['userId'] ?? null;
    $email = $body['email'] ?? null;
    $planTier = $body['planTier'] ?? 'quarterly';

    if (!$userId || !$email) {
        jsonResponse(['error' => 'userId and email required'], 400);
    }

    $plans = PLAN_TIERS;
    $plan = $plans[$planTier] ?? $plans['quarterly'];
    $txRef = 'TAXPAL-' . strtoupper(substr(md5(uniqid()), 0, 12));

    if (!function_exists('curl_init')) {
        jsonResponse(['error' => 'cURL extension is not enabled on the server'], 503);
    }

    // Create pending subscription
    $subId = generateUUID();
    $now = date('Y-m-d H:i:s');
    $db->query(
        "INSERT INTO subscriptions (id, user_id, plan_type, status, amount, currency, flutterwave_tx_ref, created_at, updated_at) 
         VALUES (?, ?, ?, 'pending', ?, 'NGN', ?, ?, ?)",
        [$subId, $userId, $planTier, $plan['price'], $txRef, $now, $now]
    );

    // Create Flutterwave payment link
    $flwPayload = [
        'tx_ref' => $txRef,
        'amount' => $plan['price'],
        'currency' => 'NGN',
        'redirect_url' => APP_URL . '/subscription?verify=' . $txRef,
        'customer' => [
            'email' => $email,
        ],
        'customizations' => [
            'title' => 'TaxPal Premium - ' . $plan['name'],
            'description' => 'TaxPal Premium Subscription (' . $plan['name'] . ')',
        ],
        'meta' => [
            'user_id' => $userId,
            'plan_tier' => $planTier,
        ],
    ];

    $ch = curl_init('https://api.flutterwave.com/v3/payments');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($flwPayload),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . FLW_SECRET_KEY,
            'Content-Type: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);

    $response = curl_exec($ch);
    if ($response === false) {
        $error = curl_error($ch) ?: 'Unknown cURL error';
        curl_close($ch);
        jsonResponse(['error' => 'Failed to create payment link: ' . $error], 502);
    }
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $flwResponse = json_decode($response, true);
    if ($httpCode !== 200) {
        $message = $flwResponse['message'] ?? 'Failed to create payment link';
        jsonResponse(['error' => $message, 'httpCode' => $httpCode], 502);
    }

    if (!$flwResponse || ($flwResponse['status'] ?? '') !== 'success') {
        jsonResponse(['error' => $flwResponse['message'] ?? 'Payment initialization failed', 'httpCode' => $httpCode], 502);
    }

    jsonResponse([
        'success' => true,
        'data' => [
            'paymentLink' => $flwResponse['data']['link'],
            'transactionRef' => $txRef,
        ]
    ]);
}

function handleVerifyPayment(Database $db, array $body) {
    $transactionId = $body['transactionId'] ?? null;

    if (!$transactionId) {
        jsonResponse(['error' => 'transactionId required'], 400);
    }

    if (!function_exists('curl_init')) {
        jsonResponse(['error' => 'cURL extension is not enabled on the server'], 503);
    }

    // Verify with Flutterwave
    $ch = curl_init("https://api.flutterwave.com/v3/transactions/{$transactionId}/verify");
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . FLW_SECRET_KEY,
            'Content-Type: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);

    $response = curl_exec($ch);
    if ($response === false) {
        $error = curl_error($ch) ?: 'Unknown cURL error';
        curl_close($ch);
        jsonResponse(['error' => 'Payment verification failed: ' . $error], 502);
    }
    curl_close($ch);

    $flwData = json_decode($response, true);
    if (!$flwData || ($flwData['status'] ?? '') !== 'success' || (($flwData['data']['status'] ?? '') !== 'successful')) {
        $message = $flwData['message'] ?? 'Payment verification failed';
        jsonResponse(['error' => $message], 400);
    }

    $txRef = $flwData['data']['tx_ref'];
    $sub = $db->fetch("SELECT * FROM subscriptions WHERE flutterwave_tx_ref = ?", [$txRef]);

    if (!$sub) {
        jsonResponse(['error' => 'Subscription not found'], 404);
    }

    // Activate subscription
    $plans = PLAN_TIERS;
    $planTier = $sub['plan_type'];
    $plan = $plans[$planTier] ?? $plans['quarterly'];
    $now = date('Y-m-d H:i:s');
    $expiresAt = date('Y-m-d H:i:s', strtotime("+{$plan['duration']} months"));

    $db->query(
        "UPDATE subscriptions SET status = 'active', flutterwave_tx_id = ?, starts_at = ?, expires_at = ?, updated_at = ? WHERE id = ?",
        [$transactionId, $now, $expiresAt, $now, $sub['id']]
    );

    $updated = $db->fetch("SELECT * FROM subscriptions WHERE id = ?", [$sub['id']]);
    
    require_once __DIR__ . '/subscriptions.php';
    jsonResponse(['success' => true, 'data' => mapSubscription($updated)]);
}

function handleFlutterwaveWebhook(Database $db, array $body) {
    // Verify webhook hash
    $hash = $_SERVER['HTTP_VERIF_HASH'] ?? '';
    if ($hash !== FLW_WEBHOOK_HASH) {
        jsonResponse(['error' => 'Invalid webhook hash'], 401);
    }

    if (($body['event'] ?? '') === 'charge.completed' && ($body['data']['status'] ?? '') === 'successful') {
        $txRef = $body['data']['tx_ref'] ?? '';
        $txId = (string)($body['data']['id'] ?? '');

        $sub = $db->fetch("SELECT * FROM subscriptions WHERE flutterwave_tx_ref = ?", [$txRef]);
        if ($sub && $sub['status'] === 'pending') {
            $plans = PLAN_TIERS;
            $plan = $plans[$sub['plan_type']] ?? $plans['quarterly'];
            $now = date('Y-m-d H:i:s');
            $expiresAt = date('Y-m-d H:i:s', strtotime("+{$plan['duration']} months"));

            $db->query(
                "UPDATE subscriptions SET status = 'active', flutterwave_tx_id = ?, starts_at = ?, expires_at = ?, updated_at = ? WHERE id = ?",
                [$txId, $now, $expiresAt, $now, $sub['id']]
            );
        }
    }

    jsonResponse(['status' => 'ok']);
}

if (!function_exists('generateUUID')) {
    function generateUUID(): string {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
