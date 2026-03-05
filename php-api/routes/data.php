<?php
/**
 * Generic Data CRUD Handler
 * Handles all table operations with security checks
 */

// Table access control configuration
$TABLE_CONFIG = [
    // User-owned tables (filter by user_id automatically)
    'saved_clients'           => ['owner_col' => 'user_id', 'ops' => ['SELECT','INSERT','UPDATE','DELETE']],
    'invoice_templates'       => ['owner_col' => 'user_id', 'ops' => ['SELECT','INSERT','UPDATE','DELETE']],
    'invoices'                => ['owner_col' => 'user_id', 'ops' => ['SELECT','INSERT','UPDATE','DELETE']],
    'default_business_details'=> ['owner_col' => 'user_id', 'ops' => ['SELECT','INSERT','UPDATE']],
    'profiles'                => ['owner_col' => 'user_id', 'ops' => ['SELECT','INSERT','UPDATE']],
    'user_push_tokens'        => ['owner_col' => 'user_id', 'ops' => ['SELECT','INSERT','UPDATE','DELETE']],
    'feature_usage'           => ['owner_col' => 'user_id', 'ops' => ['SELECT','INSERT','UPDATE']],
    'subscriptions'           => ['owner_col' => 'user_id', 'ops' => ['SELECT','INSERT','UPDATE','DELETE']],

    // Chat tables (user_id can be null for anonymous)
    'chat_sessions'           => ['owner_col' => 'user_id', 'ops' => ['SELECT','INSERT','UPDATE'], 'allow_null' => true],
    'chat_messages'           => ['session_based' => true, 'ops' => ['SELECT','INSERT']],
    'consultant_chats'        => ['owner_col' => 'user_id', 'ops' => ['SELECT','INSERT'], 'allow_null' => true],

    // Public read + admin write
    'tax_content'             => ['public_read' => true, 'admin_write' => true, 'public_filter' => ['is_published' => 1]],
    'tax_rates'               => ['public_read' => true, 'admin_write' => true, 'public_filter' => ['is_active' => 1]],
    'api_configurations'      => ['public_read_types' => ['branding', 'tool_availability'], 'admin_write' => true],

    // Admin only
    'smtp_settings'           => ['admin_only' => true, 'ops' => ['SELECT','INSERT','UPDATE','DELETE']],
    'user_roles'              => ['admin_only' => true, 'self_read' => true],
];

function handleDataRequest($db, $table, $method, $userId) {
    global $TABLE_CONFIG;

    if (!isset($TABLE_CONFIG[$table])) {
        jsonResponse(['error' => 'Table not found'], 404);
    }

    if ($table === 'api_configurations') {
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
    }

    if ($table === 'smtp_settings') {
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
    }

    $config = $TABLE_CONFIG[$table];
    $isAdmin = $userId ? Auth::isAdmin($db, $userId) : false;

    switch ($method) {
        case 'GET':
            handleSelect($db, $table, $config, $userId, $isAdmin);
            break;
        case 'POST':
            handleInsert($db, $table, $config, $userId, $isAdmin);
            break;
        case 'PUT':
            handleUpdate($db, $table, $config, $userId, $isAdmin);
            break;
        case 'DELETE':
            handleDelete($db, $table, $config, $userId, $isAdmin);
            break;
        default:
            jsonResponse(['error' => 'Method not allowed'], 405);
    }
}

function handleSelect($db, $table, $config, $userId, $isAdmin) {
    // Check access
    if (isset($config['admin_only']) && !$isAdmin) {
        // Allow self-read for user_roles
        if (isset($config['self_read']) && $userId) {
            // Will filter by user_id below
        } else {
            jsonResponse(['error' => 'Forbidden'], 403);
        }
    }

    $params = [];
    $where = [];

    // Apply ownership filter for user tables
    if (isset($config['owner_col']) && !$isAdmin) {
        if ($userId) {
            $where[] = "{$config['owner_col']} = ?";
            $params[] = $userId;
        } elseif (!isset($config['allow_null'])) {
            jsonResponse(['error' => 'Unauthorized'], 401);
        }
    }

    // Apply self-read filter for admin-only tables
    if (isset($config['admin_only']) && isset($config['self_read']) && !$isAdmin && $userId) {
        $where[] = "user_id = ?";
        $params[] = $userId;
    }

    // Public read filter (e.g., only published content)
    if (isset($config['public_read']) && !$isAdmin && isset($config['public_filter'])) {
        foreach ($config['public_filter'] as $col => $val) {
            $where[] = "$col = ?";
            $params[] = $val;
        }
    }

    // Handle api_configurations public read
    if (isset($config['public_read_types']) && !$isAdmin) {
        $types = $config['public_read_types'];
        $placeholders = implode(',', array_fill(0, count($types), '?'));
        $where[] = "config_type IN ($placeholders) AND is_active = 1";
        $params = array_merge($params, $types);
    }

    // Parse filter parameters
    if (isset($_GET['filter']) && is_array($_GET['filter'])) {
        foreach ($_GET['filter'] as $col => $opVal) {
            $col = preg_replace('/[^a-zA-Z0-9_]/', '', $col);
            if (preg_match('/^(eq|neq|gt|gte|lt|lte)\.(.+)$/', $opVal, $m)) {
                $op = $m[1];
                $val = $m[2];
                $opMap = ['eq' => '=', 'neq' => '!=', 'gt' => '>', 'gte' => '>=', 'lt' => '<', 'lte' => '<='];
                if (isset($opMap[$op])) {
                    // Handle boolean values
                    if ($val === 'true') $val = 1;
                    elseif ($val === 'false') $val = 0;
                    $where[] = "`$col` {$opMap[$op]} ?";
                    $params[] = $val;
                }
            }
        }
    }

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    // Count only
    $isCount = isset($_GET['count']) && $_GET['count'] === 'exact';
    $isHead = isset($_GET['head']) && $_GET['head'] === 'true';

    if ($isCount && $isHead) {
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM `$table` $whereClause");
        $stmt->execute($params);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        jsonResponse(['count' => (int)$result['count']]);
        return;
    }

    // Select columns
    $select = isset($_GET['select']) ? preg_replace('/[^a-zA-Z0-9_,* ]/', '', $_GET['select']) : '*';

    // Order
    $orderClause = '';
    if (isset($_GET['order'])) {
        $orders = explode(',', $_GET['order']);
        $orderParts = [];
        foreach ($orders as $o) {
            if (preg_match('/^([a-zA-Z_]+)\.(asc|desc)$/', trim($o), $m)) {
                $orderParts[] = "`{$m[1]}` {$m[2]}";
            }
        }
        if ($orderParts) $orderClause = 'ORDER BY ' . implode(', ', $orderParts);
    }

    // Limit
    $limitClause = '';
    if (isset($_GET['limit'])) {
        $limit = (int)$_GET['limit'];
        if ($limit > 0 && $limit <= 1000) $limitClause = "LIMIT $limit";
    }

    $sql = "SELECT $select FROM `$table` $whereClause $orderClause $limitClause";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Convert MySQL booleans
    $data = array_map(function($row) {
        foreach ($row as $key => $val) {
            if ($val === '1' || $val === '0') {
                // Check if it's likely a boolean column
                if (in_array($key, ['is_active', 'is_published', 'consultant_typing'])) {
                    $row[$key] = (bool)(int)$val;
                }
            }
            // Parse JSON columns
            if ($key === 'items' || $key === 'config_data') {
                $decoded = json_decode($val, true);
                if ($decoded !== null) $row[$key] = $decoded;
            }
        }
        return $row;
    }, $data);

    $response = ['data' => $data];
    if ($isCount) {
        $countStmt = $db->prepare("SELECT COUNT(*) as count FROM `$table` $whereClause");
        $countStmt->execute($params);
        $response['count'] = (int)$countStmt->fetch(PDO::FETCH_ASSOC)['count'];
    }

    jsonResponse($response);
}

function handleInsert($db, $table, $config, $userId, $isAdmin) {
    // Check write access
    if (isset($config['admin_write']) && !$isAdmin) {
        jsonResponse(['error' => 'Forbidden: admin access required'], 403);
    }
    if (isset($config['admin_only']) && !$isAdmin) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }
    if (!in_array('INSERT', $config['ops'] ?? [])) {
        jsonResponse(['error' => 'Insert not allowed'], 403);
    }

    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $records = isset($body[0]) ? $body : [$body];

    $inserted = [];
    foreach ($records as $record) {
        // Generate UUID if not provided
        if (!isset($record['id'])) {
            $record['id'] = generateUUID();
        }

        // Enforce ownership for user tables
        if (isset($config['owner_col']) && $userId && !isset($record[$config['owner_col']])) {
            $record[$config['owner_col']] = $userId;
        }

        // Handle JSON fields
        foreach (['items', 'config_data'] as $jsonCol) {
            if (isset($record[$jsonCol]) && is_array($record[$jsonCol])) {
                $record[$jsonCol] = json_encode($record[$jsonCol]);
            }
        }

        $columns = array_keys($record);
        $placeholders = implode(',', array_fill(0, count($columns), '?'));
        $colList = implode(',', array_map(fn($c) => "`$c`", $columns));

        $stmt = $db->prepare("INSERT INTO `$table` ($colList) VALUES ($placeholders)");
        $stmt->execute(array_values($record));
        $inserted[] = $record;
    }

    jsonResponse(['data' => count($inserted) === 1 ? $inserted[0] : $inserted]);
}

function handleUpdate($db, $table, $config, $userId, $isAdmin) {
    if (isset($config['admin_write']) && !$isAdmin) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }
    if (isset($config['admin_only']) && !$isAdmin) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }
    if (!in_array('UPDATE', $config['ops'] ?? [])) {
        jsonResponse(['error' => 'Update not allowed'], 403);
    }

    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $params = [];
    $where = [];

    // Handle JSON fields
    foreach (['items', 'config_data'] as $jsonCol) {
        if (isset($body[$jsonCol]) && is_array($body[$jsonCol])) {
            $body[$jsonCol] = json_encode($body[$jsonCol]);
        }
    }

    $setParts = [];
    foreach ($body as $col => $val) {
        $col = preg_replace('/[^a-zA-Z0-9_]/', '', $col);
        $setParts[] = "`$col` = ?";
        $params[] = $val;
    }

    if (empty($setParts)) {
        jsonResponse(['error' => 'No data to update'], 400);
    }

    // Build WHERE from filters
    if (isset($_GET['filter']) && is_array($_GET['filter'])) {
        foreach ($_GET['filter'] as $col => $opVal) {
            $col = preg_replace('/[^a-zA-Z0-9_]/', '', $col);
            if (preg_match('/^eq\.(.+)$/', $opVal, $m)) {
                $where[] = "`$col` = ?";
                $params[] = $m[1];
            }
        }
    }

    // Enforce ownership
    if (isset($config['owner_col']) && !$isAdmin) {
        $where[] = "{$config['owner_col']} = ?";
        $params[] = $userId;
    }

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $setClause = implode(', ', $setParts);

    $stmt = $db->prepare("UPDATE `$table` SET $setClause $whereClause");
    $stmt->execute($params);

    jsonResponse(['data' => $body]);
}

function handleDelete($db, $table, $config, $userId, $isAdmin) {
    if (isset($config['admin_write']) && !$isAdmin) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }
    if (isset($config['admin_only']) && !$isAdmin) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }
    if (!in_array('DELETE', $config['ops'] ?? [])) {
        jsonResponse(['error' => 'Delete not allowed'], 403);
    }

    $params = [];
    $where = [];

    if (isset($_GET['filter']) && is_array($_GET['filter'])) {
        foreach ($_GET['filter'] as $col => $opVal) {
            $col = preg_replace('/[^a-zA-Z0-9_]/', '', $col);
            if (preg_match('/^eq\.(.+)$/', $opVal, $m)) {
                $where[] = "`$col` = ?";
                $params[] = $m[1];
            }
        }
    }

    // Enforce ownership
    if (isset($config['owner_col']) && !$isAdmin) {
        $where[] = "{$config['owner_col']} = ?";
        $params[] = $userId;
    }

    if (empty($where)) {
        jsonResponse(['error' => 'Delete requires filters'], 400);
    }

    $whereClause = 'WHERE ' . implode(' AND ', $where);
    $stmt = $db->prepare("DELETE FROM `$table` $whereClause");
    $stmt->execute($params);

    jsonResponse(['data' => null]);
}

if (!function_exists('generateUUID')) {
    function generateUUID() {
        return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
}
