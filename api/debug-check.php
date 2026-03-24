<?php
// 一時的なデバッグスクリプト（確認後削除）
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Database.php';

$db = Database::getInstance();

$info = [];

$info['daily_reports'] = $db->fetchAll(
    "SELECT id, user_id, report_date, status,
     (SELECT name FROM users WHERE id = dr.user_id) as user_name
     FROM daily_reports dr ORDER BY report_date DESC"
);

$info['id_zero_count'] = $db->fetch("SELECT COUNT(*) as cnt FROM daily_reports WHERE id = 0")['cnt'];

$info['auto_increment'] = $db->fetch(
    "SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'daily_reports'"
);

$info['table_structure'] = $db->fetchAll("DESCRIBE daily_reports");

echo json_encode($info, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
