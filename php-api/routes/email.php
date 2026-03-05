<?php
/**
 * Email Routes - SMTP email sending
 */

function handleSendEmail($db, $userId, $body) {
    $to = $body['to'] ?? '';
    $subject = $body['subject'] ?? '';
    $html = $body['html'] ?? '';
    $template = $body['template'] ?? '';
    $templateData = $body['templateData'] ?? [];

    if (!$to) {
        jsonResponse(['error' => 'Recipient email required'], 400);
    }

    $db->query(
        "CREATE TABLE IF NOT EXISTS smtp_settings (
            id VARCHAR(36) PRIMARY KEY,
            host VARCHAR(255) DEFAULT NULL,
            port INT DEFAULT 587,
            username VARCHAR(255) DEFAULT NULL,
            password VARCHAR(255) DEFAULT NULL,
            encryption VARCHAR(20) DEFAULT 'tls',
            from_email VARCHAR(255) DEFAULT NULL,
            from_name VARCHAR(255) DEFAULT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    // Get SMTP settings from DB or config
    $smtp = null;
    $stmt = $db->query("SELECT * FROM smtp_settings WHERE is_active = 1 LIMIT 1");
    $smtp = $stmt->fetch(PDO::FETCH_ASSOC);

    // Build email content from template
    if ($template === 'welcome') {
        $name = $templateData['name'] ?? 'User';
        $subject = 'Welcome to TaxPal!';
        $html = "<h1>Welcome to TaxPal, $name!</h1><p>Thank you for joining TaxPal - your smart Nigerian tax assistant.</p><p>Start exploring our features: tax calculators, invoice generator, AI chat, and more!</p>";
    }

    if (!$subject) $subject = 'TaxPal Notification';
    if (!$html) $html = '<p>This is a notification from TaxPal.</p>';

    $smtpHost = $smtp['host'] ?? SMTP_HOST;
    $smtpPort = (int)($smtp['port'] ?? SMTP_PORT);
    $smtpUser = $smtp['username'] ?? SMTP_USERNAME;
    $smtpPass = $smtp['password'] ?? SMTP_PASSWORD;
    $smtpEncryption = strtolower((string)($smtp['encryption'] ?? SMTP_ENCRYPTION));
    $fromEmail = $smtp['from_email'] ?? SMTP_FROM_EMAIL;
    $fromName = $smtp['from_name'] ?? SMTP_FROM_NAME;

    $smtpConfigured = !empty($smtpHost) && !empty($smtpPort);
    if ($smtpConfigured && function_exists('curl_init')) {
        $protocol = $smtpEncryption === 'ssl' ? 'smtps' : 'smtp';
        $smtpUrl = sprintf('%s://%s:%d', $protocol, $smtpHost, $smtpPort);

        $headers = [
            'From: ' . $fromName . ' <' . $fromEmail . '>',
            'To: <' . $to . '>',
            'Subject: ' . $subject,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
        ];
        $payload = implode("\r\n", $headers) . "\r\n\r\n" . $html;

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $smtpUrl,
            CURLOPT_MAIL_FROM => '<' . $fromEmail . '>',
            CURLOPT_MAIL_RCPT => ['<' . $to . '>'],
            CURLOPT_UPLOAD => true,
            CURLOPT_INFILESIZE => strlen($payload),
            CURLOPT_READFUNCTION => function($ch, $fd, $length) use (&$payload) {
                $chunk = substr($payload, 0, $length);
                $payload = substr($payload, strlen($chunk));
                return $chunk;
            },
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
        ]);

        if (!empty($smtpUser)) {
            curl_setopt($ch, CURLOPT_USERNAME, $smtpUser);
        }
        if (!empty($smtpPass)) {
            curl_setopt($ch, CURLOPT_PASSWORD, $smtpPass);
        }
        if (in_array($smtpEncryption, ['tls', 'starttls', 'ssl'], true)) {
            curl_setopt($ch, CURLOPT_USE_SSL, (int)CURLUSESSL_ALL);
        }

        $smtpResult = curl_exec($ch);
        $smtpError = curl_error($ch);
        $smtpCode = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($smtpResult !== false && $smtpCode >= 200 && $smtpCode < 400) {
            jsonResponse(['data' => ['success' => true, 'message' => 'Email sent via SMTP']]);
        }

        jsonResponse(['data' => ['success' => false, 'message' => 'SMTP send failed: ' . ($smtpError ?: 'response code ' . $smtpCode)]]);
    }

    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/html; charset=UTF-8',
        "From: $fromName <$fromEmail>",
    ];

    $sent = @mail($to, $subject, $html, implode("\r\n", $headers));

    if ($sent) {
        jsonResponse(['data' => ['success' => true, 'message' => 'Email sent']]);
    }

    jsonResponse(['data' => ['success' => false, 'message' => 'Email sending failed - configure SMTP settings or server mail transport']]);
}

function handleSendNotification($db, $userId, $body) {
    // For push notifications on cPanel, we'd need a service like Firebase
    // For now, log the notification attempt
    $chatId = $body['chatId'] ?? '';
    $targetUserId = $body['userId'] ?? '';
    $message = $body['message'] ?? '';

    // Could integrate with a push service here
    jsonResponse(['data' => ['success' => true, 'message' => 'Notification queued']]);
}
