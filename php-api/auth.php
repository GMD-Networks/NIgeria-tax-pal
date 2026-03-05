<?php
/**
 * JWT Authentication helper
 * Supports custom JWT tokens and optional external JWT tokens
 */

class Auth {
    /**
     * Validate a JWT token and return user ID
        * Works with custom PHP JWTs and optional external JWTs
     */
    public static function validateToken(string $token): ?string {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;

        [$header, $payload, $signature] = $parts;

        // Decode payload
        $data = json_decode(self::base64UrlDecode($payload), true);
        if (!$data) return null;

        // Check expiry
        if (isset($data['exp']) && $data['exp'] < time()) return null;

        // Verify signature with app JWT secret first
        $expectedSig = self::base64UrlEncode(
            hash_hmac('sha256', "$header.$payload", JWT_SECRET, true)
        );
        
        if (hash_equals($expectedSig, $signature)) {
            return $data['sub'] ?? null;
        }

        // Optional: verify external JWTs when an external secret is configured
        if (defined('EXTERNAL_JWT_SECRET') && EXTERNAL_JWT_SECRET) {
            $expectedSig = self::base64UrlEncode(
                hash_hmac('sha256', "$header.$payload", EXTERNAL_JWT_SECRET, true)
            );
            if (hash_equals($expectedSig, $signature)) {
                return $data['sub'] ?? null;
            }
        }

        return null;
    }

    public static function isAdmin(Database $db, string $userId): bool {
        $row = $db->fetch(
            "SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'admin' LIMIT 1",
            [$userId]
        );

        return (bool)$row;
    }

    /**
     * Generate a custom JWT token
     */
    public static function generateToken(string $userId, string $email): string {
        $header = self::base64UrlEncode(json_encode([
            'alg' => 'HS256',
            'typ' => 'JWT'
        ]));

        $payload = self::base64UrlEncode(json_encode([
            'sub' => $userId,
            'email' => $email,
            'iat' => time(),
            'exp' => time() + JWT_EXPIRY,
        ]));

        $signature = self::base64UrlEncode(
            hash_hmac('sha256', "$header.$payload", JWT_SECRET, true)
        );

        return "$header.$payload.$signature";
    }

    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
