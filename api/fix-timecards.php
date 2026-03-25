<?php
/**
 * タイムカード id=0 修復スクリプト
 *
 * 問題: timecards テーブルの id カラムに AUTO_INCREMENT/PRIMARY KEY が設定されておらず、
 *        全レコードが id=0 で作成されている。
 *        UPDATE ... WHERE id=0 が全 id=0 レコードに適用され、
 *        他ユーザー・他日のデータが上書きされるバグが発生。
 *
 * ※ 実行後、必ず結果を確認してからこのファイルを削除してください
 */
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Database.php';

$db = Database::getInstance();
$pdo = $db->getConnection();
$results = [];

// ========== 1. 現状確認 ==========
$results['before_fix'] = [];

$zeroCount = $db->fetch("SELECT COUNT(*) as cnt FROM timecards WHERE id = 0")['cnt'];
$totalCount = $db->fetch("SELECT COUNT(*) as cnt FROM timecards")['cnt'];
$results['before_fix']['id_zero_count'] = $zeroCount;
$results['before_fix']['total_count'] = $totalCount;

// id=0レコードの一覧（破損データの確認用）
$zeroRecords = $db->fetchAll(
    "SELECT id, user_id, work_date, clock_in, clock_out, clock_in_type, clock_out_type
     FROM timecards WHERE id = 0 ORDER BY work_date, user_id"
);
$results['before_fix']['zero_records'] = $zeroRecords;

// ========== 2. id=0レコードに正しいIDを振る ==========
$maxId = $db->fetch("SELECT MAX(id) as max_id FROM timecards")['max_id'] ?? 0;
$results['current_max_id'] = $maxId;

$pdo->beginTransaction();
try {
    $newId = max(1, $maxId + 1);
    $fixed = [];

    foreach ($zeroRecords as $rec) {
        // user_id + work_date で1件ずつ特定して更新
        $db->query(
            "UPDATE timecards SET id = ? WHERE id = 0 AND user_id = ? AND work_date = ? LIMIT 1",
            [$newId, $rec['user_id'], $rec['work_date']]
        );

        $fixed[] = [
            'new_id' => $newId,
            'user_id' => $rec['user_id'],
            'work_date' => $rec['work_date'],
            'clock_in' => $rec['clock_in'],
            'clock_out' => $rec['clock_out']
        ];
        $newId++;
    }
    $results['fixed_records'] = $fixed;

    // ========== 3. PRIMARY KEY と AUTO_INCREMENT を設定 ==========
    // まず既存のPRIMARY KEYを確認
    $pkCheck = $db->fetchAll("SHOW INDEX FROM timecards WHERE Key_name = 'PRIMARY'");

    if (empty($pkCheck)) {
        // PRIMARY KEY がない場合は追加
        $db->query("ALTER TABLE timecards ADD PRIMARY KEY (id)");
        $results['primary_key'] = 'added';
    } else {
        $results['primary_key'] = 'already_exists';
    }

    // AUTO_INCREMENT を設定
    $db->query("ALTER TABLE timecards MODIFY id INT(11) NOT NULL AUTO_INCREMENT");
    $results['auto_increment'] = 'set';

    $pdo->commit();
    $results['status'] = 'SUCCESS';

} catch (Exception $e) {
    $pdo->rollBack();
    $results['status'] = 'FAILED';
    $results['error'] = $e->getMessage();
    echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// ========== 4. 修復後の確認 ==========
$results['after_fix'] = [];
$results['after_fix']['id_zero_remaining'] = $db->fetch("SELECT COUNT(*) as cnt FROM timecards WHERE id = 0")['cnt'];
$results['after_fix']['auto_increment'] = $db->fetch(
    "SELECT AUTO_INCREMENT FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'timecards'"
)['AUTO_INCREMENT'];

// 修復後のレコード一覧
$results['after_fix']['records'] = $db->fetchAll(
    "SELECT t.id, t.user_id, u.name as user_name, t.work_date, t.clock_in, t.clock_out,
            t.clock_in_type, t.clock_out_type
     FROM timecards t
     JOIN users u ON t.user_id = u.id
     WHERE t.work_date >= '2026-03-22'
     ORDER BY t.work_date, t.user_id"
);

// ========== 5. 破損した clock_out の警告 ==========
// clock_out が 18:31:46 で上書きされたレコードのリスト（要手動修正）
$corrupted = $db->fetchAll(
    "SELECT t.id, t.user_id, u.name as user_name, t.work_date, t.clock_in, t.clock_out
     FROM timecards t
     JOIN users u ON t.user_id = u.id
     WHERE t.clock_out = '18:31:46' AND t.work_date >= '2026-03-22'
     ORDER BY t.work_date, t.user_id"
);
$results['corrupted_clock_out'] = [
    'description' => 'clock_out が 18:31:46 で上書きされたレコード（正しい退勤時刻に手動修正が必要）',
    'count' => count($corrupted),
    'records' => $corrupted
];

echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
