<?php

function convertJsonError(string $message, int $status = 400): void {
    http_response_code($status);
    echo json_encode(['error' => $message]);
    exit;
}

function adobeHttpRequest(
    string $method,
    string $url,
    array $headers = [],
    ?string $body = null,
    int $timeout = 60,
    bool $captureHeaders = true
): array {
    $ch = curl_init($url);
    if ($ch === false) {
        return ['ok' => false, 'error' => 'Failed to initialize HTTP client'];
    }

    $responseHeaders = [];
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
    curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);

    if ($captureHeaders) {
        curl_setopt($ch, CURLOPT_HEADERFUNCTION, static function ($curl, $headerLine) use (&$responseHeaders) {
            $len = strlen($headerLine);
            $trimmed = trim($headerLine);
            if ($trimmed === '' || strpos($trimmed, ':') === false) {
                return $len;
            }
            [$name, $value] = explode(':', $trimmed, 2);
            $responseHeaders[strtolower(trim($name))] = trim($value);
            return $len;
        });
    }

    if (!empty($headers)) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }

    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }

    $raw = curl_exec($ch);
    if ($raw === false) {
        $error = curl_error($ch);
        curl_close($ch);
        return ['ok' => false, 'error' => $error !== '' ? $error : 'Unknown HTTP error'];
    }

    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [
        'ok' => true,
        'status' => $status,
        'body' => $raw,
        'headers' => $responseHeaders,
    ];
}

function adobeGetAccessToken(string $baseUrl, string $clientId, string $clientSecret, int $timeout): string {
    $payload = http_build_query([
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
    ]);

    $response = adobeHttpRequest(
        'POST',
        rtrim($baseUrl, '/') . '/token',
        ['Content-Type: application/x-www-form-urlencoded'],
        $payload,
        $timeout
    );

    if (!$response['ok']) {
        throw new RuntimeException('Adobe token request failed: ' . ($response['error'] ?? 'Unknown error'));
    }
    if (($response['status'] ?? 0) < 200 || ($response['status'] ?? 0) >= 300) {
        throw new RuntimeException('Adobe token request failed with HTTP ' . ($response['status'] ?? 0));
    }

    $json = json_decode((string)($response['body'] ?? ''), true);
    $token = is_array($json) ? (string)($json['access_token'] ?? '') : '';
    if ($token === '') {
        throw new RuntimeException('Adobe token response missing access token');
    }

    return $token;
}

function adobeCreateAsset(string $baseUrl, string $clientId, string $token, string $mediaType, int $timeout): array {
    $response = adobeHttpRequest(
        'POST',
        rtrim($baseUrl, '/') . '/assets',
        [
            'Authorization: Bearer ' . $token,
            'x-api-key: ' . $clientId,
            'Content-Type: application/json',
        ],
        json_encode(['mediaType' => $mediaType], JSON_UNESCAPED_SLASHES),
        $timeout
    );

    if (!$response['ok']) {
        throw new RuntimeException('Adobe asset request failed: ' . ($response['error'] ?? 'Unknown error'));
    }
    if (($response['status'] ?? 0) < 200 || ($response['status'] ?? 0) >= 300) {
        throw new RuntimeException('Adobe asset request failed with HTTP ' . ($response['status'] ?? 0));
    }

    $json = json_decode((string)($response['body'] ?? ''), true);
    $assetId = is_array($json) ? (string)($json['assetID'] ?? '') : '';
    $uploadUri = is_array($json) ? (string)($json['uploadUri'] ?? '') : '';
    if ($assetId === '' || $uploadUri === '') {
        throw new RuntimeException('Adobe asset response missing assetID or uploadUri');
    }

    return ['assetID' => $assetId, 'uploadUri' => $uploadUri];
}

function adobeUploadAsset(string $uploadUri, string $filePath, string $mediaType, int $timeout): void {
    $binary = file_get_contents($filePath);
    if ($binary === false) {
        throw new RuntimeException('Failed to read uploaded file for Adobe conversion');
    }

    $response = adobeHttpRequest(
        'PUT',
        $uploadUri,
        ['Content-Type: ' . $mediaType],
        $binary,
        $timeout,
        false
    );

    if (!$response['ok']) {
        throw new RuntimeException('Adobe upload failed: ' . ($response['error'] ?? 'Unknown error'));
    }

    $status = (int)($response['status'] ?? 0);
    if ($status < 200 || $status >= 300) {
        throw new RuntimeException('Adobe upload failed with HTTP ' . $status);
    }
}

function adobeStartOperation(string $baseUrl, string $clientId, string $token, string $operation, array $payload, int $timeout): string {
    $response = adobeHttpRequest(
        'POST',
        rtrim($baseUrl, '/') . '/operation/' . $operation,
        [
            'Authorization: Bearer ' . $token,
            'x-api-key: ' . $clientId,
            'Content-Type: application/json',
        ],
        json_encode($payload, JSON_UNESCAPED_SLASHES),
        $timeout
    );

    if (!$response['ok']) {
        throw new RuntimeException('Adobe operation request failed: ' . ($response['error'] ?? 'Unknown error'));
    }

    $status = (int)($response['status'] ?? 0);
    if ($status < 200 || $status >= 300) {
        throw new RuntimeException('Adobe operation request failed with HTTP ' . $status);
    }

    $location = (string)($response['headers']['location'] ?? '');
    if ($location === '') {
        throw new RuntimeException('Adobe operation response missing location header');
    }

    if (!preg_match('#^https?://#i', $location)) {
        $location = rtrim($baseUrl, '/') . '/' . ltrim($location, '/');
    }

    return $location;
}

function adobePollForResult(
    string $statusUrl,
    string $clientId,
    string $token,
    int $timeout,
    int $pollIntervalMs
): array {
    $start = microtime(true);

    while (true) {
        if ((microtime(true) - $start) > $timeout) {
            throw new RuntimeException('Adobe conversion timeout');
        }

        $response = adobeHttpRequest(
            'GET',
            $statusUrl,
            [
                'Authorization: Bearer ' . $token,
                'x-api-key: ' . $clientId,
            ],
            null,
            min(30, $timeout)
        );

        if (!$response['ok']) {
            throw new RuntimeException('Adobe status poll failed: ' . ($response['error'] ?? 'Unknown error'));
        }

        $statusCode = (int)($response['status'] ?? 0);
        if ($statusCode < 200 || $statusCode >= 300) {
            throw new RuntimeException('Adobe status poll failed with HTTP ' . $statusCode);
        }

        $json = json_decode((string)($response['body'] ?? ''), true);
        if (!is_array($json)) {
            throw new RuntimeException('Adobe status poll returned invalid JSON');
        }

        $statusValue = strtolower(str_replace(' ', '', (string)($json['status'] ?? '')));
        if ($statusValue === 'done' || $statusValue === 'succeeded' || $statusValue === 'success') {
            return $json;
        }

        if ($statusValue === 'failed' || $statusValue === 'error' || $statusValue === 'cancelled') {
            $details = '';
            if (isset($json['error']) && is_array($json['error'])) {
                $details = (string)($json['error']['message'] ?? $json['error']['code'] ?? '');
            }
            throw new RuntimeException('Adobe conversion failed' . ($details !== '' ? ': ' . $details : ''));
        }

        usleep(max(200, $pollIntervalMs) * 1000);
    }
}

function adobeExtractOutputAssetId(array $result): string {
    $candidates = [
        $result['assetID'] ?? null,
        $result['assetId'] ?? null,
        $result['outputAssetID'] ?? null,
        $result['outputAssetId'] ?? null,
        $result['asset']['assetID'] ?? null,
        $result['asset']['assetId'] ?? null,
        $result['output']['assetID'] ?? null,
        $result['output']['assetId'] ?? null,
        $result['outputAsset']['assetID'] ?? null,
        $result['outputAsset']['assetId'] ?? null,
    ];

    foreach ($candidates as $candidate) {
        if (is_string($candidate) && $candidate !== '') {
            return $candidate;
        }
    }

    return '';
}

function adobeFetchDownloadUri(string $baseUrl, string $clientId, string $token, string $assetId, int $timeout): string {
    $response = adobeHttpRequest(
        'GET',
        rtrim($baseUrl, '/') . '/assets/' . rawurlencode($assetId),
        [
            'Authorization: Bearer ' . $token,
            'x-api-key: ' . $clientId,
        ],
        null,
        $timeout
    );

    if (!$response['ok']) {
        throw new RuntimeException('Adobe output asset lookup failed: ' . ($response['error'] ?? 'Unknown error'));
    }

    $status = (int)($response['status'] ?? 0);
    if ($status < 200 || $status >= 300) {
        throw new RuntimeException('Adobe output asset lookup failed with HTTP ' . $status);
    }

    $json = json_decode((string)($response['body'] ?? ''), true);
    $downloadUri = is_array($json) ? (string)($json['downloadUri'] ?? '') : '';
    if ($downloadUri === '') {
        throw new RuntimeException('Adobe output asset response missing downloadUri');
    }

    return $downloadUri;
}

function adobeDownloadBinary(string $downloadUri, int $timeout): string {
    $response = adobeHttpRequest('GET', $downloadUri, [], null, $timeout, false);
    if (!$response['ok']) {
        throw new RuntimeException('Adobe download failed: ' . ($response['error'] ?? 'Unknown error'));
    }

    $status = (int)($response['status'] ?? 0);
    if ($status < 200 || $status >= 300) {
        throw new RuntimeException('Adobe download failed with HTTP ' . $status);
    }

    return (string)($response['body'] ?? '');
}

function performAdobeConversion(string $inputPath, string $inputExt, string $target): string {
    $clientId = trim((string)(defined('ADOBE_PDF_SERVICES_CLIENT_ID') ? ADOBE_PDF_SERVICES_CLIENT_ID : ''));
    $clientSecret = trim((string)(defined('ADOBE_PDF_SERVICES_CLIENT_SECRET') ? ADOBE_PDF_SERVICES_CLIENT_SECRET : ''));
    if ($clientId === '' || $clientSecret === '') {
        throw new RuntimeException('Adobe PDF Services credentials are not configured');
    }

    $baseUrl = trim((string)(defined('ADOBE_PDF_SERVICES_BASE_URL') ? ADOBE_PDF_SERVICES_BASE_URL : 'https://pdf-services.adobe.io'));
    $httpTimeout = (int)(defined('ADOBE_PDF_SERVICES_TIMEOUT') ? ADOBE_PDF_SERVICES_TIMEOUT : 60);
    $pollTimeout = (int)(defined('ADOBE_PDF_SERVICES_POLL_TIMEOUT') ? ADOBE_PDF_SERVICES_POLL_TIMEOUT : 120);
    $pollIntervalMs = (int)(defined('ADOBE_PDF_SERVICES_POLL_INTERVAL_MS') ? ADOBE_PDF_SERVICES_POLL_INTERVAL_MS : 1500);

    $mediaTypes = [
        'pdf' => 'application/pdf',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
    $mediaType = $mediaTypes[$inputExt] ?? 'application/octet-stream';

    $token = adobeGetAccessToken($baseUrl, $clientId, $clientSecret, $httpTimeout);
    $asset = adobeCreateAsset($baseUrl, $clientId, $token, $mediaType, $httpTimeout);
    adobeUploadAsset((string)$asset['uploadUri'], $inputPath, $mediaType, $httpTimeout);

    if ($target === 'pdf') {
        $operation = 'createpdf';
        $payload = ['assetID' => $asset['assetID'], 'documentLanguage' => 'en-US'];
    } else {
        $operation = 'exportpdf';
        $payload = ['assetID' => $asset['assetID'], 'targetFormat' => $target, 'ocrLang' => 'en-US'];
    }

    $statusUrl = adobeStartOperation($baseUrl, $clientId, $token, $operation, $payload, $httpTimeout);
    $result = adobePollForResult($statusUrl, $clientId, $token, $pollTimeout, $pollIntervalMs);

    $downloadUri = (string)($result['downloadUri'] ?? '');
    if ($downloadUri === '') {
        $assetId = adobeExtractOutputAssetId($result);
        if ($assetId === '') {
            throw new RuntimeException('Adobe conversion completed but output asset was not found');
        }
        $downloadUri = adobeFetchDownloadUri($baseUrl, $clientId, $token, $assetId, $httpTimeout);
    }

    return adobeDownloadBinary($downloadUri, $httpTimeout);
}

function performSofficeConversion(string $inputPath, string $jobDir, string $target): string {
    $bin = defined('CONVERT_BIN') ? CONVERT_BIN : 'soffice';
    $timeout = defined('CONVERT_TIMEOUT') ? (int)CONVERT_TIMEOUT : 90;

    $cmd = escapeshellarg($bin)
        . ' --headless --nologo --nolockcheck --nofirststartwizard --invisible'
        . ' --convert-to ' . escapeshellarg($target)
        . ' --outdir ' . escapeshellarg($jobDir)
        . ' ' . escapeshellarg($inputPath);

    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    $process = proc_open($cmd, $descriptors, $pipes);
    if (!is_resource($process)) {
        throw new RuntimeException('Failed to start converter');
    }

    $start = microtime(true);
    $status = proc_get_status($process);
    while ($status['running']) {
        if ((microtime(true) - $start) > $timeout) {
            proc_terminate($process);
            throw new RuntimeException('Conversion timeout');
        }
        usleep(200000);
        $status = proc_get_status($process);
    }

    $exitCode = proc_close($process);
    if ($exitCode !== 0) {
        throw new RuntimeException('Conversion failed');
    }

    $baseName = pathinfo($inputPath, PATHINFO_FILENAME);
    $outputPath = $jobDir . DIRECTORY_SEPARATOR . $baseName . '.' . $target;
    if (!file_exists($outputPath)) {
        $files = glob($jobDir . DIRECTORY_SEPARATOR . '*.' . $target);
        if ($files && isset($files[0])) {
            $outputPath = $files[0];
        }
    }

    if (!file_exists($outputPath)) {
        throw new RuntimeException('Output file not found');
    }

    $content = file_get_contents($outputPath);
    if ($content === false) {
        throw new RuntimeException('Failed to read output file');
    }

    return $content;
}

function handleDocumentConvert($method) {
    if ($method !== 'POST') {
        convertJsonError('Method not allowed', 405);
    }

    $target = strtolower(trim((string)($_GET['target'] ?? '')));
    $allowedTargets = ['pdf', 'docx', 'xlsx', 'pptx'];
    if (!in_array($target, $allowedTargets, true)) {
        convertJsonError('Invalid target format', 400);
    }

    if (!isset($_FILES['file'])) {
        convertJsonError('No file uploaded', 400);
    }

    $upload = $_FILES['file'];
    if (!is_array($upload) || $upload['error'] !== UPLOAD_ERR_OK) {
        convertJsonError('Upload failed', 400);
    }

    $originalName = (string)($upload['name'] ?? 'document');
    $inputExt = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $allowedInputs = ['pdf', 'docx', 'xlsx', 'pptx'];
    if (!in_array($inputExt, $allowedInputs, true)) {
        convertJsonError('Unsupported input format', 400);
    }

    if ($target !== 'pdf' && $inputExt !== 'pdf') {
        convertJsonError('Only PDF can be converted to Office formats', 400);
    }
    if ($target === 'pdf' && !in_array($inputExt, ['docx', 'xlsx', 'pptx'], true)) {
        convertJsonError('Only Office files can be converted to PDF', 400);
    }

    $tmpRoot = defined('CONVERT_TMP_DIR') && CONVERT_TMP_DIR !== '' ? CONVERT_TMP_DIR : sys_get_temp_dir();
    $tmpRoot = rtrim($tmpRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'taxpal-convert';
    if (!is_dir($tmpRoot) && !mkdir($tmpRoot, 0755, true) && !is_dir($tmpRoot)) {
        convertJsonError('Failed to create temp directory', 500);
    }

    $jobDir = $tmpRoot . DIRECTORY_SEPARATOR . uniqid('job_', true);
    if (!mkdir($jobDir, 0755, true) && !is_dir($jobDir)) {
        convertJsonError('Failed to create job directory', 500);
    }

    $inputPath = $jobDir . DIRECTORY_SEPARATOR . basename($originalName);
    if (!move_uploaded_file($upload['tmp_name'], $inputPath)) {
        convertJsonError('Failed to move upload', 500);
    }

    $adobeClientId = trim((string)(defined('ADOBE_PDF_SERVICES_CLIENT_ID') ? ADOBE_PDF_SERVICES_CLIENT_ID : ''));
    $adobeClientSecret = trim((string)(defined('ADOBE_PDF_SERVICES_CLIENT_SECRET') ? ADOBE_PDF_SERVICES_CLIENT_SECRET : ''));
    $useAdobe = $adobeClientId !== '' && $adobeClientSecret !== '';

    try {
        if ($useAdobe) {
            $outputBinary = performAdobeConversion($inputPath, $inputExt, $target);
        } else {
            $outputBinary = performSofficeConversion($inputPath, $jobDir, $target);
        }
    } catch (RuntimeException $e) {
        $status = str_contains(strtolower($e->getMessage()), 'timeout') ? 504 : 500;
        convertJsonError($e->getMessage(), $status);
    }

    $downloadName = pathinfo($originalName, PATHINFO_FILENAME) . '.' . $target;
    $mimeMap = [
        'pdf' => 'application/pdf',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];

    header_remove('Content-Type');
    header('Content-Type: ' . ($mimeMap[$target] ?? 'application/octet-stream'));
    header('Content-Disposition: attachment; filename="' . $downloadName . '"');
    header('Content-Length: ' . strlen($outputBinary));
    echo $outputBinary;
    exit;
}
