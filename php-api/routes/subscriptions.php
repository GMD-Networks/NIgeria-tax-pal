<?php
/**
 * Subscription route handlers
 */

function handleGetSubscription(Database $db, string $userId) {
    $sub = $db->fetch(
        "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
        [$userId]
    );

    if ($sub) {
        // Check expiry
        if ($sub['expires_at'] && strtotime($sub['expires_at']) < time()) {
            $db->query("UPDATE subscriptions SET status = 'expired', updated_at = NOW() WHERE id = ?", [$sub['id']]);
            $sub = null;
        }
    }

    jsonResponse([
        'success' => true,
        'data' => $sub ? mapSubscription($sub) : null,
    ]);
}

function handleCreateSubscription(Database $db, array $body) {
    $userId = $body['userId'] ?? null;
    $transactionRef = $body['transactionRef'] ?? null;
    $planTier = $body['planTier'] ?? 'quarterly';

    if (!$userId || !$transactionRef) {
        jsonResponse(['error' => 'userId and transactionRef required'], 400);
    }

    $plans = PLAN_TIERS;
    $plan = $plans[$planTier] ?? $plans['quarterly'];
    $now = date('Y-m-d H:i:s');

    $id = generateUUID();
    $db->query(
        "INSERT INTO subscriptions (id, user_id, plan_type, status, amount, currency, flutterwave_tx_ref, created_at, updated_at) 
         VALUES (?, ?, ?, 'pending', ?, 'NGN', ?, ?, ?)",
        [$id, $userId, $planTier, $plan['price'], $transactionRef, $now, $now]
    );

    $sub = $db->fetch("SELECT * FROM subscriptions WHERE id = ?", [$id]);
    jsonResponse(['success' => true, 'data' => mapSubscription($sub)], 201);
}

function mapSubscription(array $row): array {
    return [
        'id' => $row['id'],
        'userId' => $row['user_id'],
        'planType' => $row['plan_type'] === 'premium' ? 'premium' : ($row['status'] === 'active' ? 'premium' : 'free'),
        'planTier' => $row['plan_type'],
        'status' => $row['status'],
        'amount' => (float)$row['amount'],
        'currency' => $row['currency'],
        'transactionRef' => $row['flutterwave_tx_ref'],
        'transactionId' => $row['flutterwave_tx_id'] ?? null,
        'startsAt' => $row['starts_at'],
        'expiresAt' => $row['expires_at'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
    ];
}

if (!function_exists('generateUUID')) {
    function generateUUID(): string {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
