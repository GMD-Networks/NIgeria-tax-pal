<?php
/**
 * TaxPal API - Main Entry Point (Complete cPanel Backend)
 * Deploy to: taxpal.reddonisha.com/api/
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/auth.php';

// Parse request
$requestUri = $_SERVER['REQUEST_URI'];
$basePath = '/api';
$rawPath = parse_url($requestUri, PHP_URL_PATH) ?? '/';
$path = preg_replace('#^' . preg_quote($basePath, '#') . '(?:/|$)#', '', $rawPath, 1);
$path = trim($path, '/');
$segments = explode('/', $path);
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?? [];

try {
    $db = Database::getInstance();

    // Authenticate
    $userId = null;
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
        $userId = Auth::validateToken($matches[1]);
    }

    switch (true) {
        // ===== AUTH ROUTES =====
        case ($segments[0] === 'auth' && ($segments[1] ?? '') === 'register' && $method === 'POST'):
            require_once __DIR__ . '/routes/auth.php';
            handleRegister($db, $body);
            break;

        case ($segments[0] === 'auth' && ($segments[1] ?? '') === 'login' && $method === 'POST'):
            require_once __DIR__ . '/routes/auth.php';
            handleLogin($db, $body);
            break;

        case ($segments[0] === 'auth' && ($segments[1] ?? '') === 'me' && $method === 'GET'):
            if (!$userId) jsonResponse(['error' => 'Unauthorized'], 401);
            require_once __DIR__ . '/routes/auth.php';
            handleGetMe($db, $userId);
            break;

        // ===== GENERIC DATA ROUTES =====
        case ($segments[0] === 'data' && isset($segments[1])):
            require_once __DIR__ . '/routes/data.php';
            $table = preg_replace('/[^a-zA-Z0-9_]/', '', $segments[1]);
            handleDataRequest($db, $table, $method, $userId);
            break;

        // ===== DOCUMENT CONVERSION =====
        case ($segments[0] === 'convert'):
            require_once __DIR__ . '/routes/convert.php';
            handleDocumentConvert($method);
            break;

        // ===== FUNCTION ROUTES (Edge Function Replacements) =====
        case ($segments[0] === 'functions' && isset($segments[1])):
            $funcName = $segments[1];
            switch ($funcName) {
                case 'tax-ai-chat':
                    require_once __DIR__ . '/routes/ai.php';
                    handleTaxAiChat($db, $userId, $body);
                    break;

                case 'receipt-ocr':
                    require_once __DIR__ . '/routes/ai.php';
                    handleReceiptOcr($db, $userId, $body);
                    break;

                case 'smart-translate':
                    require_once __DIR__ . '/routes/ai.php';
                    handleSmartTranslate($db, $userId, $body);
                    break;

                case 'auto-tax-content':
                    require_once __DIR__ . '/routes/ai.php';
                    handleAutoTaxContent($db, $userId, $body);
                    break;

                case 'send-smtp-email':
                    require_once __DIR__ . '/routes/email.php';
                    handleSendEmail($db, $userId, $body);
                    break;

                case 'send-consultant-notification':
                    require_once __DIR__ . '/routes/email.php';
                    handleSendNotification($db, $userId, $body);
                    break;

                case 'admin-users':
                    require_once __DIR__ . '/routes/admin.php';
                    handleAdminUsers($db, $userId);
                    break;

                case 'admin-manage-user':
                    require_once __DIR__ . '/routes/admin.php';
                    handleAdminManageUser($db, $userId, $body);
                    break;

                case 'manage-api-config':
                    handleManageApiConfig($db, $userId, $method, $body);
                    break;

                case 'flutterwave-inline':
                    require_once __DIR__ . '/routes/payments.php';
                    handleInitiatePayment($db, $body);
                    break;

                default:
                    jsonResponse(['error' => "Function '$funcName' not found"], 404);
            }
            break;

        // ===== LEGACY USAGE/SUBSCRIPTION/PAYMENT ROUTES =====
        case ($segments[0] === 'usage' && isset($segments[1]) && isset($segments[2])):
            require_once __DIR__ . '/routes/usage.php';
            if (!$userId) jsonResponse(['error' => 'Unauthorized'], 401);
            if (isset($segments[3]) && $segments[3] === 'increment' && $method === 'POST') {
                handleIncrementUsage($db, $segments[1], $segments[2]);
            } elseif (isset($segments[3]) && $segments[3] === 'check') {
                handleCheckCanUse($db, $segments[1], $segments[2]);
            } else {
                handleGetUsage($db, $segments[1], $segments[2]);
            }
            break;

        case ($segments[0] === 'subscriptions'):
            require_once __DIR__ . '/routes/subscriptions.php';
            if (!$userId) jsonResponse(['error' => 'Unauthorized'], 401);
            if (isset($segments[1]) && $method === 'GET') {
                handleGetSubscription($db, $segments[1]);
            } elseif ($method === 'POST') {
                handleCreateSubscription($db, $body);
            }
            break;

        case ($segments[0] === 'payments'):
            require_once __DIR__ . '/routes/payments.php';
            if (($segments[1] ?? '') === 'webhook' && $method === 'POST') {
                handleFlutterwaveWebhook($db, $body);
            } else {
                if (!$userId) jsonResponse(['error' => 'Unauthorized'], 401);
                if (($segments[1] ?? '') === 'initiate') handleInitiatePayment($db, $body);
                elseif (($segments[1] ?? '') === 'verify') handleVerifyPayment($db, $body);
            }
            break;

        // ===== HEALTH CHECK =====
        case ($segments[0] === 'health'):
            jsonResponse(['status' => 'ok', 'timestamp' => date('c'), 'backend' => 'cpanel-php']);
            break;

        default:
            jsonResponse(['error' => 'Route not found: ' . $path], 404);
    }
} catch (Exception $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}

// ===== Helpers =====

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function requireAuth($userId) {
    if (!$userId) jsonResponse(['error' => 'Unauthorized'], 401);
}

function handleManageApiConfig($db, $userId, $method, $body) {
    if (!$userId || !Auth::isAdmin($db, $userId)) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }

    $db->query(
        "CREATE TABLE IF NOT EXISTS api_configurations (
            id VARCHAR(36) PRIMARY KEY,
            config_type VARCHAR(100) NOT NULL,
            config_data JSON NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_config_type (config_type),
            INDEX idx_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    if ($method === 'GET' || (isset($body['type']) && !isset($body['config_data']))) {
        $type = $body['type'] ?? $_GET['type'] ?? '';
        if (!$type) jsonResponse(['error' => 'Config type required'], 400);

        $stmt = $db->prepare("SELECT * FROM api_configurations WHERE config_type = ? AND is_active = 1 LIMIT 1");
        $stmt->execute([$type]);
        $config = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($config && isset($config['config_data'])) {
            $config['config_data'] = json_decode($config['config_data'], true);
        }

        jsonResponse(['data' => $config]);
    } else {
        $type = $body['type'] ?? '';
        $configData = $body['config_data'] ?? [];

        if (!$type) jsonResponse(['error' => 'Config type required'], 400);

        // Upsert
        $stmt = $db->prepare("SELECT id FROM api_configurations WHERE config_type = ? LIMIT 1");
        $stmt->execute([$type]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            $stmt = $db->prepare("UPDATE api_configurations SET config_data = ?, is_active = 1, updated_at = NOW() WHERE id = ?");
            $stmt->execute([json_encode($configData), $existing['id']]);
        } else {
            $id = generateUUID();
            $stmt = $db->prepare("INSERT INTO api_configurations (id, config_type, config_data, is_active) VALUES (?, ?, ?, 1)");
            $stmt->execute([$id, $type, json_encode($configData)]);
        }

        jsonResponse(['data' => ['success' => true]]);
    }
}

function generateUUID() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}
