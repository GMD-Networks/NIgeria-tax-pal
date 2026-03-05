<?php
/**
 * Auth route handlers
 */

function handleRegister(Database $db, array $body) {
    $email = trim($body['email'] ?? '');
    $password = $body['password'] ?? '';

    if (!$email || !$password) {
        jsonResponse(['error' => 'Email and password required'], 400);
    }

    if (strlen($password) < 6) {
        jsonResponse(['error' => 'Password must be at least 6 characters'], 400);
    }

    // Check if user exists
    $existing = $db->fetch("SELECT id FROM users WHERE email = ?", [$email]);
    if ($existing) {
        jsonResponse(['error' => 'Email already registered'], 409);
    }

    $userId = generateUUID();
    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
    $now = date('Y-m-d H:i:s');

    $db->query(
        "INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [$userId, $email, $hashedPassword, $now, $now]
    );

    // Create profile
    $db->query(
        "INSERT INTO profiles (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [generateUUID(), $userId, $now, $now]
    );

    $token = Auth::generateToken($userId, $email);

    jsonResponse([
        'success' => true,
        'data' => [
            'user' => ['id' => $userId, 'email' => $email],
            'token' => $token,
        ]
    ], 201);
}

function handleLogin(Database $db, array $body) {
    $email = trim($body['email'] ?? '');
    $password = $body['password'] ?? '';

    if (!$email || !$password) {
        jsonResponse(['error' => 'Email and password required'], 400);
    }

    $user = $db->fetch("SELECT id, email, password_hash FROM users WHERE email = ?", [$email]);
    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonResponse(['error' => 'Invalid credentials'], 401);
    }

    $token = Auth::generateToken($user['id'], $user['email']);

    jsonResponse([
        'success' => true,
        'data' => [
            'user' => ['id' => $user['id'], 'email' => $user['email']],
            'token' => $token,
        ]
    ]);
}

function handleGetMe(Database $db, string $userId) {
    $user = $db->fetch("SELECT id, email, created_at FROM users WHERE id = ?", [$userId]);
    if (!$user) {
        jsonResponse(['error' => 'User not found'], 404);
    }

    $profile = $db->fetch("SELECT full_name, avatar_url FROM profiles WHERE user_id = ?", [$userId]);

    jsonResponse([
        'success' => true,
        'data' => [
            'id' => $user['id'],
            'email' => $user['email'],
            'full_name' => $profile['full_name'] ?? null,
            'avatar_url' => $profile['avatar_url'] ?? null,
        ]
    ]);
}

if (!function_exists('generateUUID')) {
    function generateUUID(): string {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
