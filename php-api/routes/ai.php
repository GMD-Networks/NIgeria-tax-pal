<?php
/**
 * AI Proxy Routes - Tax Chat, Receipt OCR, Content Generation
 * Proxies to OpenAI-compatible API
 */

function getAiRuntimeConfig($db): array {
    $provider = strtolower(trim((string)(defined('AI_PROVIDER') ? AI_PROVIDER : 'gemini')));
    $apiKey = trim((string)(defined('AI_API_KEY') ? AI_API_KEY : ''));
    if ($apiKey === '' && defined('OPENROUTER_API_KEY')) {
        $apiKey = trim((string)OPENROUTER_API_KEY);
    }
    if ($apiKey === '' && defined('DEEPSEEK_API_KEY')) {
        $apiKey = trim((string)DEEPSEEK_API_KEY);
    }
    if ($apiKey === '' && defined('GEMINI_API_KEY')) {
        $apiKey = trim((string)GEMINI_API_KEY);
    }
    $model = defined('AI_MODEL') ? (string)AI_MODEL : 'gpt-4o-mini';
    $apiUrl = defined('AI_API_URL') ? (string)AI_API_URL : 'https://api.openai.com/v1/chat/completions';
    $maxTokens = 4096;

    try {
        $stmt = $db->prepare("SELECT config_data FROM api_configurations WHERE config_type = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1");
        $stmt->execute(['ai']);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row && isset($row['config_data'])) {
            $configData = is_string($row['config_data'])
                ? json_decode($row['config_data'], true)
                : $row['config_data'];

            if (is_array($configData)) {
                if (isset($configData['config_data']) && is_array($configData['config_data'])) {
                    $configData = $configData['config_data'];
                }

                $provider = strtolower(trim((string)($configData['provider'] ?? $provider)));
                $dbApiKey = '';
                foreach (['api_key', 'apiKey', 'key', 'token', 'apiToken'] as $keyField) {
                    if (isset($configData[$keyField])) {
                        $candidate = trim((string)$configData[$keyField]);
                        if ($candidate !== '') {
                            $dbApiKey = $candidate;
                            break;
                        }
                    }
                }
                if ($dbApiKey !== '') {
                    $apiKey = $dbApiKey;
                }
                $model = trim((string)($configData['model'] ?? $model));
                $maxTokens = (int)($configData['max_tokens'] ?? $maxTokens);

                if (!empty($configData['api_url'])) {
                    $apiUrl = trim((string)$configData['api_url']);
                } elseif ($provider === 'deepseek') {
                    $apiUrl = 'https://api.deepseek.com/v1/chat/completions';
                } elseif ($provider === 'gemini') {
                    $apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
                }
            }
        }
    } catch (Throwable $e) {
        // Fallback to config.php constants if dynamic config table/query is unavailable.
    }

    if ($maxTokens < 256) {
        $maxTokens = 256;
    }

    if ($provider === 'deepseek' && $apiUrl === 'https://api.openai.com/v1/chat/completions') {
        $apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    }
    if ($provider === 'gemini' && $apiUrl === 'https://api.openai.com/v1/chat/completions') {
        $apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    }

    if ($provider === '') {
        $provider = 'gemini';
    }

    return [
        'provider' => $provider,
        'api_key' => $apiKey,
        'model' => $model,
        'api_url' => $apiUrl,
        'max_tokens' => $maxTokens,
    ];
}

function getReceiptAiRuntimeConfig($db): array {
    $config = getAiRuntimeConfig($db);

    $envOcrKey = defined('OCR_AI_API_KEY') ? trim((string)OCR_AI_API_KEY) : '';
    if ($envOcrKey !== '') {
        $config['api_key'] = $envOcrKey;
        if (defined('OCR_AI_PROVIDER') && trim((string)OCR_AI_PROVIDER) !== '') {
            $config['provider'] = strtolower(trim((string)OCR_AI_PROVIDER));
        }
        if (defined('OCR_AI_API_URL') && trim((string)OCR_AI_API_URL) !== '') {
            $config['api_url'] = trim((string)OCR_AI_API_URL);
        }
        if (defined('OCR_AI_MODEL') && trim((string)OCR_AI_MODEL) !== '') {
            $config['model'] = trim((string)OCR_AI_MODEL);
        }
    }

    try {
        $stmt = $db->prepare("SELECT config_data FROM api_configurations WHERE config_type = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1");
        $stmt->execute(['ai']);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row && isset($row['config_data'])) {
            $configData = is_string($row['config_data'])
                ? json_decode($row['config_data'], true)
                : $row['config_data'];

            if (is_array($configData)) {
                $dbOcrKey = '';
                foreach (['ocr_api_key', 'receipt_api_key'] as $keyField) {
                    if (!empty($configData[$keyField])) {
                        $dbOcrKey = trim((string)$configData[$keyField]);
                        break;
                    }
                }

                if ($dbOcrKey !== '') {
                    $config['api_key'] = $dbOcrKey;

                    foreach (['ocr_provider', 'receipt_provider'] as $providerField) {
                        if (!empty($configData[$providerField])) {
                            $config['provider'] = strtolower(trim((string)$configData[$providerField]));
                            break;
                        }
                    }

                    foreach (['ocr_api_url', 'receipt_api_url'] as $urlField) {
                        if (!empty($configData[$urlField])) {
                            $config['api_url'] = trim((string)$configData[$urlField]);
                            break;
                        }
                    }

                    foreach (['ocr_model', 'receipt_model'] as $modelField) {
                        if (!empty($configData[$modelField])) {
                            $config['model'] = trim((string)$configData[$modelField]);
                            break;
                        }
                    }
                }
            }
        }
    } catch (Throwable $e) {
        // Use base AI config if OCR override lookup fails.
    }

    if ($config['api_key'] === '' && $config['provider'] === 'gemini') {
        if (defined('OPENROUTER_API_KEY') && trim((string)OPENROUTER_API_KEY) !== '') {
            $config['api_key'] = trim((string)OPENROUTER_API_KEY);
        } elseif (defined('GEMINI_API_KEY') && trim((string)GEMINI_API_KEY) !== '') {
            $config['api_key'] = trim((string)GEMINI_API_KEY);
        }
    }

    return $config;
}

function handleTaxAiChat($db, $userId, $body) {
    $aiConfig = getAiRuntimeConfig($db);
    if (!$aiConfig['api_key']) {
        jsonResponse(['error' => 'AI API key not configured for provider ' . $aiConfig['provider'] . '. Save AI settings in Admin > Settings or set AI_API_KEY in config.php'], 500);
    }

    $messages = $body['messages'] ?? [];
    $messageCount = $body['messageCount'] ?? 0;

    // Add system prompt
    $systemPrompt = "You are TaxBot, a Nigerian tax assistant. Give short (2-3 sentence) answers about Nigerian taxes (PAYE, VAT, WHT, CIT, CGT). Always recommend consulting a tax expert for detailed advice. Current Nigerian tax info: VAT is 7.5%, PAYE uses graduated rates from 7-24%.";

    if ($messageCount >= 2) {
        $systemPrompt .= " After 2 messages, remind the user they can chat with a live consultant for personalized advice.";
    }

    array_unshift($messages, ['role' => 'system', 'content' => $systemPrompt]);

    $shouldStream = !array_key_exists('stream', $body) || $body['stream'] !== false;

    if ($shouldStream) {
        // Stream response
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
    }

    $ch = curl_init($aiConfig['api_url']);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $aiConfig['api_key'],
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => $aiConfig['model'],
            'messages' => $messages,
            'stream' => $shouldStream,
            'max_tokens' => min(500, $aiConfig['max_tokens']),
            'temperature' => 0.7,
        ]),
        CURLOPT_RETURNTRANSFER => !$shouldStream,
        CURLOPT_WRITEFUNCTION => $shouldStream ? function($ch, $data) {
            echo $data;
            if (ob_get_level() > 0) ob_flush();
            flush();
            return strlen($data);
        } : null,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($shouldStream) {
        exit;
    }

    if ($response === false) {
        jsonResponse(['error' => 'AI request failed: ' . ($curlError ?: 'Unknown cURL error')], 502);
    }

    $rawResponse = (string)$response;
    $sanitizedResponse = preg_replace('/^\xEF\xBB\xBF/', '', $rawResponse);
    if (function_exists('iconv')) {
        $converted = @iconv('UTF-8', 'UTF-8//IGNORE', $sanitizedResponse);
        if ($converted !== false) {
            $sanitizedResponse = $converted;
        }
    }
    $decoded = json_decode($sanitizedResponse, true, 512, JSON_INVALID_UTF8_IGNORE);
    if (is_array($decoded) && isset($decoded['choices'][0]['message']['content'])) {
        jsonResponse(['success' => true, 'data' => ['content' => $decoded['choices'][0]['message']['content']]]);
    }
    if (is_array($decoded) && isset($decoded['choices'][0]['delta']['content'])) {
        $deltaContent = (string)$decoded['choices'][0]['delta']['content'];
        if ($deltaContent !== '') {
            jsonResponse(['success' => true, 'data' => ['content' => $deltaContent]]);
        }
    }
    $sseContent = '';
    $lines = preg_split("/\r?\n/", (string)$sanitizedResponse);
    if (is_array($lines)) {
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, ':') || !str_starts_with($line, 'data:')) {
                continue;
            }
            $payload = trim(substr($line, 5));
            if ($payload === '[DONE]') {
                break;
            }
            $chunk = json_decode($payload, true);
            if (!is_array($chunk)) {
                continue;
            }
            $part = $chunk['choices'][0]['delta']['content'] ?? $chunk['choices'][0]['message']['content'] ?? '';
            if (is_string($part) && $part !== '') {
                $sseContent .= $part;
            }
        }
    }
    if ($sseContent !== '') {
        jsonResponse(['success' => true, 'data' => ['content' => $sseContent]]);
    }
    if (preg_match_all('/"content"\s*:\s*"((?:\\\\.|[^"])*)"/s', (string)$sanitizedResponse, $matches) && !empty($matches[1])) {
        $parts = [];
        foreach ($matches[1] as $raw) {
            $part = json_decode('"' . $raw . '"');
            if (!is_string($part)) {
                $part = stripcslashes($raw);
            }
            if (is_string($part) && $part !== '') {
                $parts[] = $part;
            }
        }
        $content = trim(implode('', $parts));
        if ($content !== '') {
            jsonResponse(['success' => true, 'data' => ['content' => $content]]);
        }
    }

    if ($httpCode !== 200) {
        if (is_array($decoded) && isset($decoded['error']['message'])) {
            jsonResponse(['error' => $decoded['error']['message']], 502);
        }
        jsonResponse(['error' => 'AI request failed', 'httpCode' => $httpCode], 502);
    }

    jsonResponse(['error' => 'AI response missing content'], 502);
}

function handleReceiptOcr($db, $userId, $body) {
    if (function_exists('set_time_limit')) {
        @set_time_limit(120);
    }

    $aiConfig = getReceiptAiRuntimeConfig($db);
    if (!$aiConfig['api_key']) {
        jsonResponse(['error' => 'AI API key not configured for provider ' . $aiConfig['provider']], 500);
    }

    $image = $body['image'] ?? '';
    if (!$image) {
        jsonResponse(['error' => 'No image provided'], 400);
    }

    if (strlen((string)$image) > 8_000_000) {
        jsonResponse(['error' => 'Image payload too large. Please upload a smaller image.'], 413);
    }

    $prompt = 'Analyze this document image and return strict JSON only with fields: document_type, title, raw_text, formatted_blocks, vendor_name, date, receipt_number, items, subtotal, tax_amount, tax_rate, total_amount, payment_method, currency, sections, key_details.';

    $provider = strtolower(trim((string)($aiConfig['provider'] ?? '')));
    $isGeminiProvider = $provider === 'gemini' || stripos((string)$aiConfig['api_url'], 'generativelanguage.googleapis.com') !== false;

    if ($isGeminiProvider) {
        $mimeType = 'image/jpeg';
        $imageData = $image;
        if (preg_match('/^data:([^;]+);base64,(.+)$/', $image, $matches)) {
            $mimeType = trim((string)$matches[1]) !== '' ? trim((string)$matches[1]) : 'image/jpeg';
            $imageData = trim((string)$matches[2]);
        }

        $model = trim((string)($aiConfig['model'] ?? 'gemini-1.5-flash'));
        if (stripos($model, 'google/') === 0) {
            $model = substr($model, 7);
        }
        if ($model === '') {
            $model = 'gemini-1.5-flash';
        }

        $geminiUrl = trim((string)($aiConfig['api_url'] ?? ''));
        if ($geminiUrl === '' || stripos($geminiUrl, 'chat/completions') !== false) {
            $geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent';
        }

        $separator = strpos($geminiUrl, '?') !== false ? '&' : '?';
        $geminiUrlWithKey = $geminiUrl . $separator . 'key=' . rawurlencode((string)$aiConfig['api_key']);

        $ch = curl_init($geminiUrlWithKey);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
            ],
            CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
            CURLOPT_CONNECTTIMEOUT => 20,
            CURLOPT_TIMEOUT => 110,
            CURLOPT_POSTFIELDS => json_encode([
                'contents' => [[
                    'role' => 'user',
                    'parts' => [
                        ['text' => $prompt],
                        ['inline_data' => ['mime_type' => $mimeType, 'data' => $imageData]],
                    ],
                ]],
                'generationConfig' => [
                    'temperature' => 0.1,
                    'maxOutputTokens' => min(1800, (int)$aiConfig['max_tokens']),
                ],
            ], JSON_UNESCAPED_SLASHES),
            CURLOPT_RETURNTRANSFER => true,
        ]);
    } else {
        $messages = [
            ['role' => 'system', 'content' => 'You are a document analysis AI. Extract structured data from images. Return only valid JSON.'],
            ['role' => 'user', 'content' => [
                ['type' => 'text', 'text' => $prompt],
                ['type' => 'image_url', 'image_url' => ['url' => $image]],
            ]],
        ];

        $ch = curl_init($aiConfig['api_url']);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $aiConfig['api_key'],
            ],
            CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
            CURLOPT_CONNECTTIMEOUT => 20,
            CURLOPT_TIMEOUT => 110,
            CURLOPT_POSTFIELDS => json_encode([
                'model' => $aiConfig['model'],
                'messages' => $messages,
                'max_tokens' => min(1800, $aiConfig['max_tokens']),
                'temperature' => 0.1,
            ]),
            CURLOPT_RETURNTRANSFER => true,
        ]);
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        jsonResponse(['error' => 'AI request failed: ' . ($curlError ?: 'Unknown cURL error'), 'success' => false], 502);
    }

    if ($httpCode !== 200) {
        $decodedError = json_decode((string)$response, true);
        if (is_array($decodedError) && isset($decodedError['error']['message'])) {
            $errorMessage = (string)$decodedError['error']['message'];
            if (stripos($errorMessage, 'unknown variant `image_url`') !== false || stripos($errorMessage, 'expected `text`') !== false) {
                jsonResponse([
                    'success' => true,
                    'data' => [
                        'document_type' => 'other',
                        'title' => 'Scanned Document',
                        'raw_text' => 'Image OCR is not supported by the currently configured AI model. Switch AI provider/model to a vision-capable model for full scanner extraction.',
                        'formatted_blocks' => [
                            [
                                'text' => 'Image OCR is not supported by the currently configured AI model. Switch AI provider/model to a vision-capable model for full scanner extraction.',
                                'style' => 'body',
                            ],
                        ],
                    ],
                ]);
            }
            jsonResponse(['error' => $errorMessage, 'success' => false], 502);
        }
        jsonResponse(['error' => 'AI API error', 'success' => false, 'httpCode' => $httpCode], 500);
    }

    $result = json_decode($response, true);
    $content = '';
    if ($isGeminiProvider) {
        $parts = $result['candidates'][0]['content']['parts'] ?? [];
        if (is_array($parts)) {
            foreach ($parts as $part) {
                if (is_array($part) && isset($part['text']) && is_string($part['text'])) {
                    $content .= $part['text'];
                }
            }
        }
    } else {
        $content = (string)($result['choices'][0]['message']['content'] ?? '');
    }

    // Try to parse JSON from response
    $content = preg_replace('/```json\s*/', '', $content);
    $content = preg_replace('/```\s*$/', '', $content);
    $parsed = json_decode(trim($content), true);

    if (!$parsed && preg_match('/\{[\s\S]*\}/', (string)$content, $matches)) {
        $parsed = json_decode($matches[0], true);
    }

    if (!$parsed) {
        $parsed = ['raw_text' => $content, 'document_type' => 'other'];
    }

    jsonResponse(['success' => true, 'data' => $parsed]);
}

function handleSmartTranslate($db, $userId, $body) {
    if (!$userId) {
        jsonResponse(['error' => 'Unauthorized'], 401);
    }
    $text = trim((string)($body['text'] ?? ''));
    $target = trim((string)($body['target'] ?? 'English'));
    if ($text === '') {
        jsonResponse(['error' => 'Text is required'], 400);
    }

    $aiConfig = getAiRuntimeConfig($db);
    if (!$aiConfig['api_key']) {
        jsonResponse(['error' => 'AI API key not configured for provider ' . $aiConfig['provider']], 500);
    }

    $prompt = "Translate the following text to {$target}. Return only the translated text. Preserve line breaks where possible.";

    $provider = strtolower(trim((string)($aiConfig['provider'] ?? '')));
    $isGeminiProvider = $provider === 'gemini' || stripos((string)$aiConfig['api_url'], 'generativelanguage.googleapis.com') !== false;

    if ($isGeminiProvider) {
        $model = trim((string)($aiConfig['model'] ?? 'gemini-1.5-flash'));
        if (stripos($model, 'google/') === 0) {
            $model = substr($model, 7);
        }
        if ($model === '') {
            $model = 'gemini-1.5-flash';
        }

        $geminiUrl = trim((string)($aiConfig['api_url'] ?? ''));
        if ($geminiUrl === '' || stripos($geminiUrl, 'chat/completions') !== false) {
            $geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent';
        }
        $separator = strpos($geminiUrl, '?') !== false ? '&' : '?';
        $geminiUrlWithKey = $geminiUrl . $separator . 'key=' . rawurlencode((string)$aiConfig['api_key']);

        $ch = curl_init($geminiUrlWithKey);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
            ],
            CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
            CURLOPT_CONNECTTIMEOUT => 20,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_POSTFIELDS => json_encode([
                'contents' => [[
                    'role' => 'user',
                    'parts' => [
                        ['text' => $prompt . "\n\n" . $text],
                    ],
                ]],
                'generationConfig' => [
                    'temperature' => 0.2,
                    'maxOutputTokens' => min(2000, (int)$aiConfig['max_tokens']),
                ],
            ]),
            CURLOPT_RETURNTRANSFER => true,
        ]);
    } else {
        $ch = curl_init($aiConfig['api_url']);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $aiConfig['api_key'],
            ],
            CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
            CURLOPT_CONNECTTIMEOUT => 20,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_POSTFIELDS => json_encode([
                'model' => $aiConfig['model'],
                'messages' => [
                    ['role' => 'system', 'content' => 'You are a translation engine. Output only translated text.'],
                    ['role' => 'user', 'content' => $prompt . "\n\n" . $text],
                ],
                'max_tokens' => min(2000, $aiConfig['max_tokens']),
                'temperature' => 0.2,
            ]),
            CURLOPT_RETURNTRANSFER => true,
        ]);
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        jsonResponse(['error' => 'AI request failed: ' . ($curlError ?: 'Unknown cURL error')], 502);
    }

    $sanitizedResponse = preg_replace('/^\xEF\xBB\xBF/', '', (string)$response);
    if (function_exists('iconv')) {
        $converted = @iconv('UTF-8', 'UTF-8//IGNORE', $sanitizedResponse);
        if ($converted !== false) {
            $sanitizedResponse = $converted;
        }
    }

    $decoded = json_decode($sanitizedResponse, true, 512, JSON_INVALID_UTF8_IGNORE);
    if ($isGeminiProvider) {
        $parts = $decoded['candidates'][0]['content']['parts'] ?? [];
        $translatedText = '';
        if (is_array($parts)) {
            foreach ($parts as $part) {
                if (is_array($part) && isset($part['text']) && is_string($part['text'])) {
                    $translatedText .= $part['text'];
                }
            }
        }
        if (trim($translatedText) !== '') {
            jsonResponse(['success' => true, 'data' => ['translated_text' => $translatedText]]);
        }
    }

    if (is_array($decoded) && isset($decoded['choices'][0]['message']['content'])) {
        jsonResponse(['success' => true, 'data' => ['translated_text' => $decoded['choices'][0]['message']['content']]]);
    }

    if ($httpCode !== 200) {
        if (is_array($decoded) && isset($decoded['error']['message'])) {
            jsonResponse(['error' => $decoded['error']['message']], 502);
        }
        jsonResponse(['error' => 'AI request failed', 'httpCode' => $httpCode], 502);
    }

    jsonResponse(['error' => 'AI response missing content'], 502);
}

function handleAutoTaxContent($db, $userId, $body) {
    if (function_exists('set_time_limit')) {
        @set_time_limit(180);
    }

    $aiConfig = getAiRuntimeConfig($db);
    if (!$aiConfig['api_key']) {
        jsonResponse(['error' => 'AI API key not configured for provider ' . $aiConfig['provider']], 500);
    }

    if (!Auth::isAdmin($db, $userId)) {
        jsonResponse(['error' => 'Admin access required'], 403);
    }

    $categories = ['paye', 'vat', 'wht', 'cit', 'cgt', 'updates', 'mistakes', 'stamp', 'levy'];
    $selectedCategories = array_rand(array_flip($categories), 3);

    $prompt = "Generate exactly 3 Nigerian tax educational articles for categories: " . implode(', ', $selectedCategories) . ". "
        . "Return ONLY a valid JSON array (no markdown, no prose). "
        . "Each array item must include keys: title, content, category, title_yo, title_ha, title_pcm, title_ig, content_yo, content_ha, content_pcm, content_ig. "
        . "Write 'title' and 'content' in English only. Do not mix multiple languages inside one field. "
        . "Use concise practical content of about 120-180 words in 'content'. If any translation is not available, set it to null.";

    $provider = strtolower(trim((string)($aiConfig['provider'] ?? '')));
    $isGeminiProvider = $provider === 'gemini' || stripos((string)$aiConfig['api_url'], 'generativelanguage.googleapis.com') !== false;

    if ($isGeminiProvider) {
        $model = trim((string)($aiConfig['model'] ?? 'gemini-1.5-flash'));
        if (stripos($model, 'google/') === 0) {
            $model = substr($model, 7);
        }
        if ($model === '') {
            $model = 'gemini-1.5-flash';
        }

        $geminiUrl = trim((string)($aiConfig['api_url'] ?? ''));
        if ($geminiUrl === '' || stripos($geminiUrl, 'chat/completions') !== false) {
            $geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent';
        }
        $separator = strpos($geminiUrl, '?') !== false ? '&' : '?';
        $geminiUrlWithKey = $geminiUrl . $separator . 'key=' . rawurlencode((string)$aiConfig['api_key']);

        $ch = curl_init($geminiUrlWithKey);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
            ],
            CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
            CURLOPT_CONNECTTIMEOUT => 20,
            CURLOPT_TIMEOUT => 170,
            CURLOPT_POSTFIELDS => json_encode([
                'contents' => [[
                    'role' => 'user',
                    'parts' => [
                        ['text' => 'You are a Nigerian tax content writer. Return strict machine-readable JSON array only. No markdown, no commentary.'],
                        ['text' => $prompt],
                    ],
                ]],
                'generationConfig' => [
                    'temperature' => 0.3,
                    'maxOutputTokens' => min(2600, (int)$aiConfig['max_tokens']),
                ],
            ]),
            CURLOPT_RETURNTRANSFER => true,
        ]);
    } else {
        $ch = curl_init($aiConfig['api_url']);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $aiConfig['api_key'],
            ],
            CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
            CURLOPT_CONNECTTIMEOUT => 20,
            CURLOPT_TIMEOUT => 170,
            CURLOPT_POSTFIELDS => json_encode([
                'model' => $aiConfig['model'],
                'messages' => [
                    ['role' => 'system', 'content' => 'You are a Nigerian tax content writer. Return strict machine-readable JSON array only. No markdown, no commentary.'],
                    ['role' => 'user', 'content' => $prompt],
                ],
                'max_tokens' => min(2600, $aiConfig['max_tokens']),
                'temperature' => 0.3,
            ]),
            CURLOPT_RETURNTRANSFER => true,
        ]);
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        jsonResponse(['error' => 'AI request failed: ' . ($curlError ?: 'Unknown cURL error'), 'success' => false], 502);
    }

    $result = json_decode($response, true);
    if (!is_array($result)) {
        jsonResponse(['error' => 'AI response was not valid JSON', 'success' => false], 502);
    }
    if ($isGeminiProvider) {
        $errorMessage = $result['error']['message'] ?? null;
        if (is_string($errorMessage) && $errorMessage !== '') {
            jsonResponse(['error' => $errorMessage, 'success' => false, 'httpCode' => $httpCode], 502);
        }
    } elseif (isset($result['error']['message'])) {
        jsonResponse(['error' => $result['error']['message'], 'success' => false, 'httpCode' => $httpCode], 502);
    }
    if ($httpCode !== 200) {
        jsonResponse(['error' => 'AI request failed', 'success' => false, 'httpCode' => $httpCode], 502);
    }

    $content = '';
    if ($isGeminiProvider) {
        $parts = $result['candidates'][0]['content']['parts'] ?? [];
        if (is_array($parts)) {
            foreach ($parts as $part) {
                if (is_array($part) && isset($part['text']) && is_string($part['text'])) {
                    $content .= $part['text'];
                }
            }
        }
    } else {
        $content = (string)($result['choices'][0]['message']['content'] ?? '');
    }

    $cleanText = function (?string $value): string {
        $text = trim((string)($value ?? ''));
        if ($text === '') {
            return '';
        }
        if (function_exists('iconv')) {
            $sanitized = @iconv('UTF-8', 'UTF-8//IGNORE', $text);
            if ($sanitized !== false) {
                $text = $sanitized;
            }
        }
        $text = preg_replace('/^```(?:json|markdown)?\s*/i', '', $text);
        $text = preg_replace('/\s*```$/', '', $text);
        $text = preg_replace('/\r\n?/', "\n", $text);
        $text = preg_replace('/\n{3,}/', "\n\n", $text);
        return trim((string)$text);
    };

    $decodeJsonString = function (string $value): string {
        $decoded = json_decode('"' . str_replace('"', '\\"', $value) . '"');
        return is_string($decoded) ? $decoded : $value;
    };

    $stripJsonArtifacts = function (string $text) use ($decodeJsonString): string {
        $normalized = trim($text);
        if ($normalized === '') {
            return '';
        }

        if (preg_match('/"content"\s*:\s*"((?:\\\\.|[^"\\\\])*)"/is', $normalized, $contentMatch)) {
            $normalized = $decodeJsonString($contentMatch[1]);
        }

        $normalized = preg_replace('/^[\[\{]\s*$/m', '', $normalized);
        $normalized = preg_replace('/^[\]\},]\s*$/m', '', $normalized);
        $normalized = preg_replace('/^\s*"?(title|content|category|title_yo|title_ha|title_pcm|title_ig|content_yo|content_ha|content_pcm|content_ig)"?\s*:\s*/im', '', $normalized);
        $normalized = preg_replace('/^\s*[,]+\s*$/m', '', $normalized);
        $normalized = preg_replace('/\n{3,}/', "\n\n", (string)$normalized);

        return trim((string)$normalized, " \t\n\r\0\x0B\"'");
    };

    $extractLangSections = function (string $text): array {
        $sections = [
            'en' => null,
            'yo' => null,
            'ha' => null,
            'ig' => null,
            'pcm' => null,
        ];

        $allLabels = 'english|en|yoruba|yo|yorùbá|hausa|ha|igbo|ig|pidgin|nigerian\s+pidgin|pcm';
        $langPatterns = [
            'en' => 'english|en',
            'yo' => 'yoruba|yo|yorùbá',
            'ha' => 'hausa|ha',
            'ig' => 'igbo|ig',
            'pcm' => 'pidgin|nigerian\s+pidgin|pcm',
        ];

        foreach ($langPatterns as $lang => $labelPattern) {
            $pattern = '/(?:^|\n)\s*(?:' . $labelPattern . ')\s*[:\-]\s*(.+?)(?=(?:\n\s*(?:' . $allLabels . ')\s*[:\-])|\z)/is';
            if (preg_match($pattern, $text, $matches)) {
                $sections[$lang] = trim((string)$matches[1]);
            }
        }

        return $sections;
    };

    $parseArticles = function (string $raw) use ($categories, $cleanText, $extractLangSections) {
        $normalized = trim($raw);
        $normalized = preg_replace('/^```(?:json)?\s*/i', '', $normalized);
        $normalized = preg_replace('/\s*```$/', '', $normalized);

        $decoded = json_decode($normalized, true);

        if (is_string($decoded)) {
            $decodedAgain = json_decode($decoded, true);
            if (is_array($decodedAgain)) {
                $decoded = $decodedAgain;
            }
        }

        if (!is_array($decoded) && preg_match('/\[[\s\S]*\]/', $normalized, $matches)) {
            $decoded = json_decode($matches[0], true);
        }

        if (is_array($decoded) && isset($decoded['articles']) && is_array($decoded['articles'])) {
            $decoded = $decoded['articles'];
        }

        if (!is_array($decoded)) {
            return null;
        }

        if (array_keys($decoded) !== range(0, count($decoded) - 1)) {
            $decoded = [$decoded];
        }

        $normalizedArticles = [];
        foreach ($decoded as $item) {
            if (!is_array($item)) {
                continue;
            }

            $title = $cleanText((string)($item['title'] ?? $item['heading'] ?? 'Untitled'));
            if (preg_match('/^```/i', $title)) {
                $title = '';
            }
            $bodyContent = $cleanText((string)($item['content'] ?? $item['body'] ?? $item['text'] ?? ''));
            $bodyContent = $cleanText($stripJsonArtifacts((string)$bodyContent));
            $category = strtolower(trim((string)($item['category'] ?? 'updates')));
            if (!in_array($category, $categories, true)) {
                $category = 'updates';
            }

            if ($title === '' || strlen($title) < 4 || preg_match('/^[\[\]{}()"\'\s]+$/', $title)) {
                $title = strtoupper($category) . ' Tax Update';
            }

            $langSections = $extractLangSections($bodyContent);
            if (!empty($langSections['en'])) {
                $bodyContent = $cleanText($langSections['en']);
            }

            $titleYo = $cleanText((string)($item['title_yo'] ?? ''));
            $titleHa = $cleanText((string)($item['title_ha'] ?? ''));
            $titlePcm = $cleanText((string)($item['title_pcm'] ?? ''));
            $titleIg = $cleanText((string)($item['title_ig'] ?? ''));
            $contentYo = $cleanText((string)($item['content_yo'] ?? ''));
            $contentHa = $cleanText((string)($item['content_ha'] ?? ''));
            $contentPcm = $cleanText((string)($item['content_pcm'] ?? ''));
            $contentIg = $cleanText((string)($item['content_ig'] ?? ''));

            if ($contentYo === '' && !empty($langSections['yo'])) $contentYo = $cleanText($langSections['yo']);
            if ($contentHa === '' && !empty($langSections['ha'])) $contentHa = $cleanText($langSections['ha']);
            if ($contentPcm === '' && !empty($langSections['pcm'])) $contentPcm = $cleanText($langSections['pcm']);
            if ($contentIg === '' && !empty($langSections['ig'])) $contentIg = $cleanText($langSections['ig']);

            if ($bodyContent === '' || preg_match('/^(title|content|category)\s*:/i', $bodyContent)) {
                continue;
            }

            $normalizedArticles[] = [
                'title' => $title !== '' ? $title : 'Untitled',
                'content' => $bodyContent,
                'category' => $category !== '' ? $category : 'updates',
                'title_yo' => $titleYo !== '' ? $titleYo : null,
                'title_ha' => $titleHa !== '' ? $titleHa : null,
                'title_pcm' => $titlePcm !== '' ? $titlePcm : null,
                'title_ig' => $titleIg !== '' ? $titleIg : null,
                'content_yo' => $contentYo !== '' ? $contentYo : null,
                'content_ha' => $contentHa !== '' ? $contentHa : null,
                'content_pcm' => $contentPcm !== '' ? $contentPcm : null,
                'content_ig' => $contentIg !== '' ? $contentIg : null,
            ];
        }

        return count($normalizedArticles) > 0 ? $normalizedArticles : null;
    };

    $articles = $parseArticles($content);

    if ($articles === null) {
        $fallbackText = $cleanText(strip_tags((string)$content));
        $fallbackText = $cleanText($stripJsonArtifacts($fallbackText));
        $fallbackSections = $extractLangSections($fallbackText);
        if (!empty($fallbackSections['en'])) {
            $fallbackText = $cleanText($fallbackSections['en']);
        }
        $firstLine = strtok($fallbackText, "\n");
        $fallbackTitle = trim((string)$firstLine);
        if ($fallbackTitle === '' || strlen($fallbackTitle) < 4 || preg_match('/^```/i', $fallbackTitle) || preg_match('/^[\[\]{}()"\'\s]+$/', $fallbackTitle)) {
            $fallbackTitle = 'Nigerian Tax Update';
        }

        $fallbackText = preg_replace('/\n{3,}/', "\n\n", (string)$fallbackText);
        if (strlen($fallbackText) > 1800) {
            $fallbackText = trim((string)substr($fallbackText, 0, 1800)) . '...';
        }

        if ($fallbackText === '' || strlen($fallbackText) < 40 || preg_match('/^[\[\]{}()"\'\s]+$/', $fallbackText)) {
            $fallbackText = 'Practical Nigerian tax guidance for businesses and individuals, including compliance reminders, due dates, and documentation best practices.';
        }

        $fallbackCategory = is_array($selectedCategories) && isset($selectedCategories[0])
            ? (string)$selectedCategories[0]
            : 'updates';

        $articles = [[
            'title' => $fallbackTitle,
            'content' => $fallbackText !== '' ? $fallbackText : 'Important Nigerian tax guidance and compliance updates.',
            'category' => $fallbackCategory,
            'title_yo' => null,
            'title_ha' => null,
            'title_pcm' => null,
            'title_ig' => null,
            'content_yo' => null,
            'content_ha' => null,
            'content_pcm' => null,
            'content_ig' => null,
        ]];
    }

    $inserted = [];
    $sanitize = function ($value) use ($stripJsonArtifacts) {
        if ($value === null) {
            return null;
        }
        $text = trim((string)$value);
        if ($text === '') {
            return null;
        }
        if (function_exists('iconv')) {
            $converted = @iconv('UTF-8', 'UTF-8//IGNORE', $text);
            if ($converted !== false) {
                $text = $converted;
            }
        }
        $text = $stripJsonArtifacts($text);
        $text = preg_replace('/\p{C}+/u', '', (string)$text);
        return trim((string)$text);
    };

    $limitText = function (?string $text, int $maxLength): ?string {
        if ($text === null) {
            return null;
        }
        $value = trim($text);
        if ($value === '') {
            return null;
        }
        if (function_exists('mb_strlen') && function_exists('mb_substr')) {
            if (mb_strlen($value, 'UTF-8') > $maxLength) {
                $value = mb_substr($value, 0, $maxLength, 'UTF-8');
            }
            return trim($value);
        }
        if (strlen($value) > $maxLength) {
            $value = substr($value, 0, $maxLength);
        }
        return trim($value);
    };

    $keepEnglishSection = function (string $text) use ($extractLangSections, $cleanText): string {
        $sections = $extractLangSections($text);
        if (!empty($sections['en'])) {
            return $cleanText((string)$sections['en']);
        }
        $cleaned = preg_replace('/(?:^|\n)\s*(?:yoruba|yo|yorùbá|hausa|ha|igbo|ig|pidgin|nigerian\s+pidgin|pcm|english|en)\s*[:\-].*?(?=(?:\n\s*(?:yoruba|yo|yorùbá|hausa|ha|igbo|ig|pidgin|nigerian\s+pidgin|pcm|english|en)\s*[:\-])|\z)/is', '', $text);
        return $cleanText((string)$cleaned);
    };
    foreach ($articles as $article) {
        $normalizedTitle = $sanitize($article['title'] ?? '') ?? '';
        $normalizedContent = $sanitize($article['content'] ?? '') ?? '';
        $normalizedContent = $keepEnglishSection($normalizedContent);
        $normalizedCategory = strtolower(trim((string)($article['category'] ?? 'updates')));

        if (!in_array($normalizedCategory, $categories, true)) {
            $normalizedCategory = 'updates';
        }

        if ($normalizedTitle === '' || strlen($normalizedTitle) < 4 || preg_match('/^[\[\]{}()"\'\s,.:;-]+$/', $normalizedTitle)) {
            $normalizedTitle = strtoupper($normalizedCategory) . ' Tax Update';
        }

        $titleWordCount = count(array_filter(preg_split('/\s+/', $normalizedTitle) ?: []));
        if ($titleWordCount > 12 || strlen($normalizedTitle) > 110 || preg_match('/[\.!\?].*\s+/', $normalizedTitle)) {
            $normalizedTitle = ucfirst($normalizedCategory) . ' Tax Update';
        }

        if ($normalizedContent === '' || preg_match('/^[\[\]{}()"\'\s,.:;-]+$/', $normalizedContent)) {
            $normalizedContent = 'Practical Nigerian tax guidance for businesses and individuals, including compliance reminders, due dates, and documentation best practices.';
        }

        $normalizedTitle = $limitText($normalizedTitle, 110) ?? 'Nigerian Tax Update';
        $normalizedCategory = $limitText($normalizedCategory, 90) ?? 'updates';

        $titleYo = $limitText($sanitize($article['title_yo'] ?? null), 180);
        $titleHa = $limitText($sanitize($article['title_ha'] ?? null), 180);
        $titlePcm = $limitText($sanitize($article['title_pcm'] ?? null), 180);
        $titleIg = $limitText($sanitize($article['title_ig'] ?? null), 180);

        $id = generateUUID();
        $stmt = $db->prepare("INSERT INTO tax_content (id, title, content, category, title_yo, title_ha, title_pcm, title_ig, content_yo, content_ha, content_pcm, content_ig, icon) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([
            $id,
            $normalizedTitle,
            $normalizedContent,
            $normalizedCategory,
            $titleYo,
            $titleHa,
            $titlePcm,
            $titleIg,
            $sanitize($article['content_yo'] ?? null),
            $sanitize($article['content_ha'] ?? null),
            $sanitize($article['content_pcm'] ?? null),
            $sanitize($article['content_ig'] ?? null),
            'FileText',
        ]);
        $inserted[] = [
            'id' => $id,
            'title' => $normalizedTitle,
            'category' => $normalizedCategory,
        ];
    }

    jsonResponse(['success' => true, 'articles' => $inserted]);
}
