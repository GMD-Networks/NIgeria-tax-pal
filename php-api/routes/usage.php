<?php
/**
 * Feature usage route handlers
 */

function handleGetUsage(Database $db, string $userId, string $featureType) {
    $monthYear = date('Y-m');

    $usage = $db->fetch(
        "SELECT * FROM feature_usage WHERE user_id = ? AND feature_type = ? AND month_year = ?",
        [$userId, $featureType, $monthYear]
    );

    jsonResponse([
        'success' => true,
        'data' => $usage ? mapUsage($usage) : null,
    ]);
}

function handleIncrementUsage(Database $db, string $userId, string $featureType) {
    $monthYear = date('Y-m');
    $now = date('Y-m-d H:i:s');

    $existing = $db->fetch(
        "SELECT * FROM feature_usage WHERE user_id = ? AND feature_type = ? AND month_year = ?",
        [$userId, $featureType, $monthYear]
    );

    if ($existing) {
        $db->query(
            "UPDATE feature_usage SET usage_count = usage_count + 1, updated_at = ? WHERE id = ?",
            [$now, $existing['id']]
        );
        $updated = $db->fetch("SELECT * FROM feature_usage WHERE id = ?", [$existing['id']]);
        jsonResponse(['success' => true, 'data' => mapUsage($updated)]);
    } else {
        $id = generateUUID();
        $db->query(
            "INSERT INTO feature_usage (id, user_id, feature_type, usage_count, month_year, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)",
            [$id, $userId, $featureType, $monthYear, $now, $now]
        );
        $row = $db->fetch("SELECT * FROM feature_usage WHERE id = ?", [$id]);
        jsonResponse(['success' => true, 'data' => mapUsage($row)]);
    }
}

function handleCheckCanUse(Database $db, string $userId, string $featureType) {
    // Check premium
    $sub = $db->fetch(
        "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC LIMIT 1",
        [$userId]
    );

    if ($sub) {
        jsonResponse([
            'success' => true,
            'data' => [
                'canUse' => true,
                'currentUsage' => 0,
                'limit' => -1,
                'isUnlimited' => true,
            ]
        ]);
    }

    // Free user - check limits
    $monthYear = date('Y-m');
    $usage = $db->fetch(
        "SELECT usage_count FROM feature_usage WHERE user_id = ? AND feature_type = ? AND month_year = ?",
        [$userId, $featureType, $monthYear]
    );

    $currentUsage = $usage ? (int)$usage['usage_count'] : 0;
    $limits = FREE_LIMITS;
    $limit = $limits[$featureType] ?? 5;

    jsonResponse([
        'success' => true,
        'data' => [
            'canUse' => $currentUsage < $limit,
            'currentUsage' => $currentUsage,
            'limit' => $limit,
            'isUnlimited' => false,
        ]
    ]);
}

function mapUsage(array $row): array {
    return [
        'id' => $row['id'],
        'userId' => $row['user_id'],
        'featureType' => $row['feature_type'],
        'usageCount' => (int)$row['usage_count'],
        'monthYear' => $row['month_year'],
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
