<?php
require __DIR__ . '/../php-api/config.php';
require __DIR__ . '/../php-api/database.php';

$schemaFile = __DIR__ . '/../php-api/schema.sql';
$schema = file_get_contents($schemaFile);
if ($schema === false) {
    fwrite(STDERR, "Failed to read schema.sql\n");
    exit(1);
}

try {
    $db = Database::getInstance()->getPdo();
    $db->exec($schema);
    echo "SCHEMA_APPLIED\n";
} catch (Throwable $e) {
    fwrite(STDERR, "SCHEMA_ERROR: " . $e->getMessage() . "\n");
    exit(1);
}
