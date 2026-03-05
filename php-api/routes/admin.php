<?php
/**
 * Admin API Routes
 */

function handleAdminUsers($db, $userId) {
    if (!$userId || !Auth::isAdmin($db, $userId)) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }

    // Fetch all users with profile details, subscriptions, and roles
    $stmt = $db->query(
        "SELECT u.id, u.email, u.created_at, p.full_name, p.avatar_url
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         ORDER BY u.created_at DESC"
    );
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($users as &$user) {
        // Get subscription
        $subStmt = $db->prepare("SELECT id, plan_type, status, expires_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1");
        $subStmt->execute([$user['id']]);
        $user['subscription'] = $subStmt->fetch(PDO::FETCH_ASSOC) ?: null;

        // Get roles
        $roleStmt = $db->prepare("SELECT role FROM user_roles WHERE user_id = ?");
        $roleStmt->execute([$user['id']]);
        $user['roles'] = $roleStmt->fetchAll(PDO::FETCH_COLUMN);
    }

    jsonResponse(['data' => ['users' => $users]]);
}

function handleAdminManageUser($db, $userId, $body) {
    if (!$userId || !Auth::isAdmin($db, $userId)) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }

    $action = $body['action'] ?? '';
    $targetUserId = $body['user_id'] ?? null;
    $subscriptionId = $body['subscription_id'] ?? null;

    switch ($action) {
        case 'grant_subscription':
            if (!$targetUserId) jsonResponse(['error' => 'User ID required'], 400);
            $id = generateUUID();
            $expires = date('Y-m-d H:i:s', strtotime('+3 months'));
            $stmt = $db->prepare("INSERT INTO subscriptions (id, user_id, plan_type, status, amount, starts_at, expires_at) VALUES (?, ?, 'quarterly', 'active', 0, NOW(), ?)");
            $stmt->execute([$id, $targetUserId, $expires]);
            jsonResponse(['data' => ['message' => 'Subscription granted']]);
            break;

        case 'approve_subscription':
            if (!$subscriptionId) jsonResponse(['error' => 'Subscription ID required'], 400);
            $stmt = $db->prepare("UPDATE subscriptions SET status = 'active', starts_at = NOW() WHERE id = ?");
            $stmt->execute([$subscriptionId]);
            jsonResponse(['data' => ['message' => 'Subscription approved']]);
            break;

        case 'cancel_subscription':
            if (!$subscriptionId) jsonResponse(['error' => 'Subscription ID required'], 400);
            $stmt = $db->prepare("UPDATE subscriptions SET status = 'cancelled' WHERE id = ?");
            $stmt->execute([$subscriptionId]);
            jsonResponse(['data' => ['message' => 'Subscription cancelled']]);
            break;

        case 'delete_user':
            if (!$targetUserId) jsonResponse(['error' => 'User ID required'], 400);
            $stmt = $db->prepare("DELETE FROM users WHERE id = ?");
            $stmt->execute([$targetUserId]);
            jsonResponse(['data' => ['message' => 'User deleted']]);
            break;

        default:
            jsonResponse(['error' => 'Unknown action'], 400);
    }
}
