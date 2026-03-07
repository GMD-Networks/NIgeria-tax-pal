<?php
/**
 * TaxPal API Configuration
 * UPDATE THESE VALUES for your cPanel environment
 */

$localEnvFile = __DIR__ . '/.env.local';
if (is_file($localEnvFile) && is_readable($localEnvFile)) {
    $lines = file($localEnvFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (is_array($lines)) {
        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }
            $parts = explode('=', $trimmed, 2);
            if (count($parts) !== 2) {
                continue;
            }
            $key = trim($parts[0]);
            $value = trim($parts[1]);
            if ($key === '') {
                continue;
            }
            if (getenv($key) === false) {
                putenv($key . '=' . $value);
            }
        }
    }
}

function envOrDefault(string $key, $default = '') {
    $value = getenv($key);
    if ($value === false || $value === null) {
        return $default;
    }
    return $value;
}

// Database
define('DB_HOST', envOrDefault('DB_HOST', 'localhost'));
define('DB_NAME', envOrDefault('DB_NAME', 'gmdnetwo_taxpal'));          // Create this in cPanel MySQL Databases
define('DB_USER', envOrDefault('DB_USER', 'gmdnetwo_taxpal'));        // Create this in cPanel MySQL Databases
define('DB_PASS', envOrDefault('DB_PASS', ''));   // Set a strong password via environment on cPanel

// JWT Secret - CHANGE THIS to a random 64+ character string
define('JWT_SECRET', envOrDefault('JWT_SECRET', 'SET_A_64PLUS_CHAR_SECRET_IN_ENV_BEFORE_DEPLOYMENT'));
define('JWT_EXPIRY', (int)envOrDefault('JWT_EXPIRY', 86400 * 30)); // 30 days

// Optional external JWT secret (only needed if accepting tokens from another auth provider)
define('EXTERNAL_JWT_SECRET', envOrDefault('EXTERNAL_JWT_SECRET', ''));

// Flutterwave
define('FLW_SECRET_KEY', envOrDefault('FLW_SECRET_KEY', ''));
define('FLW_PUBLIC_KEY', envOrDefault('FLW_PUBLIC_KEY', ''));
define('FLW_WEBHOOK_HASH', envOrDefault('FLW_WEBHOOK_HASH', ''));

// App
define('APP_URL', envOrDefault('APP_URL', 'https://taxpal.reddonisha.com'));
define('API_URL', envOrDefault('API_URL', 'https://taxpal.reddonisha.com/api'));

// AI provider
define('AI_API_URL', envOrDefault('AI_API_URL', 'https://api.openai.com/v1/chat/completions'));
define('AI_API_KEY', envOrDefault('AI_API_KEY', envOrDefault('OPENAI_API_KEY', '')));
define('AI_MODEL', envOrDefault('AI_MODEL', 'gpt-4o-mini'));
define('OPENROUTER_API_KEY', envOrDefault('OPENROUTER_API_KEY', ''));
define('DEEPSEEK_API_KEY', envOrDefault('DEEPSEEK_API_KEY', ''));
define('GEMINI_API_KEY', envOrDefault('GEMINI_API_KEY', ''));
define('OCR_AI_PROVIDER', envOrDefault('OCR_AI_PROVIDER', ''));
define('OCR_AI_API_URL', envOrDefault('OCR_AI_API_URL', ''));
define('OCR_AI_API_KEY', envOrDefault('OCR_AI_API_KEY', ''));
define('OCR_AI_MODEL', envOrDefault('OCR_AI_MODEL', ''));

// Document conversion (LibreOffice)
define('CONVERT_BIN', envOrDefault('CONVERT_BIN', 'soffice'));
define('CONVERT_TMP_DIR', envOrDefault('CONVERT_TMP_DIR', ''));
define('CONVERT_TIMEOUT', (int)envOrDefault('CONVERT_TIMEOUT', 90));

// Adobe PDF Services (preferred for cPanel/shared hosting)
define('ADOBE_PDF_SERVICES_CLIENT_ID', envOrDefault('ADOBE_PDF_SERVICES_CLIENT_ID', ''));
define('ADOBE_PDF_SERVICES_CLIENT_SECRET', envOrDefault('ADOBE_PDF_SERVICES_CLIENT_SECRET', ''));
define('ADOBE_PDF_SERVICES_BASE_URL', envOrDefault('ADOBE_PDF_SERVICES_BASE_URL', 'https://pdf-services.adobe.io'));
define('ADOBE_PDF_SERVICES_TIMEOUT', (int)envOrDefault('ADOBE_PDF_SERVICES_TIMEOUT', 60));
define('ADOBE_PDF_SERVICES_POLL_TIMEOUT', (int)envOrDefault('ADOBE_PDF_SERVICES_POLL_TIMEOUT', 120));
define('ADOBE_PDF_SERVICES_POLL_INTERVAL_MS', (int)envOrDefault('ADOBE_PDF_SERVICES_POLL_INTERVAL_MS', 1500));

// Email defaults
define('SMTP_HOST', envOrDefault('SMTP_HOST', ''));
define('SMTP_PORT', (int)envOrDefault('SMTP_PORT', 587));
define('SMTP_USERNAME', envOrDefault('SMTP_USERNAME', ''));
define('SMTP_PASSWORD', envOrDefault('SMTP_PASSWORD', ''));
define('SMTP_ENCRYPTION', envOrDefault('SMTP_ENCRYPTION', 'tls'));
define('SMTP_FROM_EMAIL', envOrDefault('SMTP_FROM_EMAIL', 'noreply@taxpal.reddonisha.com'));
define('SMTP_FROM_NAME', envOrDefault('SMTP_FROM_NAME', 'TaxPal'));

// Free tier limits (per month)
define('FREE_LIMITS', [
    'calculator' => 5,
    'invoice' => 5,
    'chat' => 5,
]);

// Plan pricing
define('PLAN_TIERS', [
    'quarterly' => ['price' => 999, 'duration' => 3, 'name' => '3 Months'],
    'biannual'  => ['price' => 1499, 'duration' => 6, 'name' => '6 Months'],
    'annual'    => ['price' => 2499, 'duration' => 12, 'name' => '1 Year'],
]);
