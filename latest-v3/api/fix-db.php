<?php
// DB修復スクリプト（実行後削除してください）
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Database.php';

$db = Database::getInstance();
$results = [];

// 1. id=0のレコードに正しいIDを振る
$maxId = $db->fetch("SELECT MAX(id) as max_id FROM daily_reports")['max_id'] ?? 0;
$results['current_max_id'] = $maxId;

$zeroRecords = $db->fetchAll("SELECT id, user_id, report_date FROM daily_reports WHERE id = 0 ORDER BY report_date");
$results['zero_records_found'] = count($zeroRecords);

$newId = $maxId + 1;
foreach ($zeroRecords as $rec) {
    // id=0のレコードを1件ずつ更新（report_date + user_idで特定）
    $db->execute(
        "UPDATE daily_reports SET id = ? WHERE id = 0 AND user_id = ? AND report_date = ? LIMIT 1",
        [$newId, $rec['user_id'], $rec['report_date']]
    );

    // 関連テーブルも更新（report_id=0 → 新ID）
    // ※id=0の関連データは区別できないので、ここでは本体のみ修正

    $results['fixed'][] = [
        'new_id' => $newId,
        'user_id' => $rec['user_id'],
        'report_date' => $rec['report_date']
    ];
    $newId++;
}

// 2. PRIMARY KEYとAUTO_INCREMENTを設定
try {
    $db->execute("ALTER TABLE daily_reports ADD PRIMARY KEY (id)");
    $results['primary_key'] = 'added';
} catch (Exception $e) {
    $results['primary_key_error'] = $e->getMessage();
}

try {
    $db->execute("ALTER TABLE daily_reports MODIFY id INT(11) NOT NULL AUTO_INCREMENT");
    $results['auto_increment'] = 'added';
} catch (Exception $e) {
    $results['auto_increment_error'] = $e->getMessage();
}

// 3. 修復後の確認
$results['after_fix'] = $db->fetchAll(
    "SELECT id, user_id, report_date,
     (SELECT name FROM users WHERE id = dr.user_id) as user_name
     FROM daily_reports dr WHERE report_date >= '2026-03-19' ORDER BY report_date DESC"
);

$results['new_auto_increment'] = $db->fetch(
    "SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'daily_reports'"
);

$results['id_zero_remaining'] = $db->fetch("SELECT COUNT(*) as cnt FROM daily_reports WHERE id = 0")['cnt'];

echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
