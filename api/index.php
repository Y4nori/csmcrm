<?php
require_once 'config.php';
require_once 'Database.php';

// エラーハンドリング
if (DEBUG_MODE) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
}

// CORS設定
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=utf-8');

// セキュリティヘッダー
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');

// キャッシュ無効化ヘッダー
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

// OPTIONSリクエストの処理
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// セッション設定
ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_samesite', 'Strict');
session_start();

// リクエストの取得
$method = $_SERVER['REQUEST_METHOD'];
$request = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?? [];

// グローバル例外ハンドラ（未キャッチ例外でもJSONレスポンスを返す）
set_exception_handler(function($e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Internal Server Error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
});

// データベース接続
$db = Database::getInstance();

// マイグレーション（全てtry-catchで囲み、失敗してもAPIは動作させる）
try {
    // 修正申請テーブル自動作成
    $db->query("CREATE TABLE IF NOT EXISTS timecard_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        work_date DATE NOT NULL,
        clock_in TIME NULL,
        clock_out TIME NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        reject_comment TEXT NULL,
        processed_by INT NULL,
        processed_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // timecard_requestsテーブルに不足カラムがあれば追加
    $trMigrations = [
        "ALTER TABLE timecard_requests ADD COLUMN reject_comment TEXT NULL",
        "ALTER TABLE timecard_requests ADD COLUMN processed_by INT NULL",
        "ALTER TABLE timecard_requests ADD COLUMN processed_at DATETIME NULL",
    ];
    foreach ($trMigrations as $sql) {
        try { $db->query($sql); } catch (Exception $e) {}
    }

    // timecardsテーブルに不足カラムがあれば追加
    $tcMigrations = [
        "ALTER TABLE timecards ADD COLUMN clock_in_type VARCHAR(20) DEFAULT 'auto'",
        "ALTER TABLE timecards ADD COLUMN clock_out_type VARCHAR(20) DEFAULT 'auto'",
    ];
    foreach ($tcMigrations as $sql) {
        try { $db->query($sql); } catch (Exception $e) {}
    }

    // ログインログテーブル
    $db->query("CREATE TABLE IF NOT EXISTS login_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        user_name VARCHAR(100),
        username_attempted VARCHAR(100),
        ip_address VARCHAR(45),
        user_agent VARCHAR(500),
        status ENUM('success', 'failed') DEFAULT 'success',
        fail_reason VARCHAR(100) NULL,
        login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ip (ip_address),
        INDEX idx_login_at (login_at),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // login_logsに不足カラムがあれば追加
    $loginLogMigrations = [
        "ALTER TABLE login_logs ADD COLUMN ip_address VARCHAR(45) NULL",
        "ALTER TABLE login_logs ADD COLUMN user_agent VARCHAR(500) NULL",
        "ALTER TABLE login_logs ADD COLUMN status ENUM('success', 'failed') DEFAULT 'success'",
        "ALTER TABLE login_logs ADD COLUMN fail_reason VARCHAR(100) NULL",
        "ALTER TABLE login_logs ADD COLUMN username_attempted VARCHAR(100) NULL",
    ];
    foreach ($loginLogMigrations as $sql) {
        try { $db->query($sql); } catch (Exception $e) {}
    }

    // レートリミットテーブル（ブルートフォース対策）
    $db->query("CREATE TABLE IF NOT EXISTS login_rate_limit (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ip_address VARCHAR(45) NOT NULL,
        attempt_count INT DEFAULT 0,
        first_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        blocked_until DATETIME NULL,
        INDEX idx_ip (ip_address)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 倉庫支店を自動追加
    try {
        $warehouseExists = $db->fetch("SELECT id FROM inventory_branches WHERE name = '倉庫' OR code = 'WAREHOUSE'");
        if (!$warehouseExists) {
            $db->query("INSERT INTO inventory_branches (name, code, is_active) VALUES ('倉庫', 'WAREHOUSE', 1)");
        }
        $branchRenames = [
            ['大阪営業', '大阪支店'],
            ['阪和営業', '阪和営業所'],
            ['京滋営業', '京滋支店'],
            ['福知山営業', '福知山営業所'],
            ['神戸営業所', '神戸支店'],
        ];
        foreach ($branchRenames as $rename) {
            try { $db->update("UPDATE inventory_branches SET name = ? WHERE name = ?", [$rename[1], $rename[0]]); } catch (Exception $e) {}
        }
    } catch (Exception $e) {}
} catch (Exception $e) {
    // マイグレーション失敗してもAPI自体は動作させる
    error_log("Migration error: " . $e->getMessage());
}

// レスポンス関数
function respond($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function error($message, $status = 400) {
    respond(['error' => $message], $status);
}

// 認証チェック
function checkAuth() {
    if (!isset($_SESSION['user_id'])) {
        error('Unauthorized', 401);
    }
    return $_SESSION['user_id'];
}

function checkAdmin() {
    checkAuth();
    if ($_SESSION['role'] !== 'admin' && $_SESSION['role'] !== 'master') {
        error('Forbidden', 403);
    }
}

// マスター専用チェック（操作履歴など機密情報用）
function checkMaster() {
    checkAuth();
    if ($_SESSION['role'] !== 'master') {
        error('Forbidden', 403);
    }
}

// 相対日付計算（第N週の特定曜日を計算）
// $nth: 1-4 or -1(最終), $dayOfWeek: 0(日)-6(土)
function calculateNthDayOfWeek($year, $month, $nth, $dayOfWeek) {
    if ($nth === -1) {
        // 最終の場合：月末から遡る
        $date = new DateTime("$year-$month-01");
        $date->modify('last day of this month');
        while ((int)$date->format('w') !== $dayOfWeek) {
            $date->modify('-1 day');
        }
        return (int)$date->format('d');
    } else {
        // 第N週の場合：月初から数える
        $date = new DateTime("$year-$month-01");
        $count = 0;
        while ((int)$date->format('n') == $month) {
            if ((int)$date->format('w') === $dayOfWeek) {
                $count++;
                if ($count === $nth) {
                    return (int)$date->format('d');
                }
            }
            $date->modify('+1 day');
        }
    }
    return null;
}

// 相対日付パターンから実日を計算
function calculateRelativeDate($year, $month, $pattern) {
    // パターン形式: "first_sun", "second_mon", "last_fri" など
    $parts = explode('_', $pattern);
    if (count($parts) !== 2) return null;

    $nthMap = ['first' => 1, 'second' => 2, 'third' => 3, 'fourth' => 4, 'last' => -1];
    $dayMap = ['sun' => 0, 'mon' => 1, 'tue' => 2, 'wed' => 3, 'thu' => 4, 'fri' => 5, 'sat' => 6];

    $nth = $nthMap[$parts[0]] ?? null;
    $dayOfWeek = $dayMap[$parts[1]] ?? null;

    if ($nth === null || $dayOfWeek === null) return null;

    return calculateNthDayOfWeek($year, $month, $nth, $dayOfWeek);
}

// 監査ログ記録（エラーが発生してもメイン処理は継続）
function logAudit($action, $targetType, $targetId, $targetName, $details = null) {
    global $db;
    try {
        // テーブルが存在しない場合は作成
        $db->query("CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            user_name VARCHAR(100) NOT NULL,
            action VARCHAR(50) NOT NULL,
            target_type VARCHAR(50) NOT NULL,
            target_id INT,
            target_name VARCHAR(255),
            details TEXT,
            ip_address VARCHAR(45),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_id (user_id),
            INDEX idx_target (target_type, target_id),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->insert(
            "INSERT INTO audit_logs (user_id, user_name, action, target_type, target_id, target_name, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                $_SESSION['user_id'] ?? 0,
                $_SESSION['name'] ?? 'Unknown',
                $action,
                $targetType,
                $targetId,
                $targetName,
                $details ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
                $_SERVER['REMOTE_ADDR'] ?? null
            ]
        );
    } catch (Exception $e) {
        // ログ記録に失敗してもメイン処理は継続
        error_log("Audit log error: " . $e->getMessage());
    }
}

// ルーティング
switch ($request) {
    // ========== 認証 ==========
    case 'login':
        if ($method !== 'POST') error('Method not allowed', 405);

        $username = $input['username'] ?? '';
        $password = $input['password'] ?? '';
        $clientIp = isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? $_SERVER['HTTP_X_FORWARDED_FOR'] : (isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown');
        if (strpos($clientIp, ',') !== false) {
            $clientIp = trim(explode(',', $clientIp)[0]);
        }
        $userAgent = isset($_SERVER['HTTP_USER_AGENT']) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 500) : '';

        // レートリミットチェック（失敗してもログイン処理は継続）
        $rateLimit = null;
        try {
            $rateLimit = $db->fetch(
                "SELECT * FROM login_rate_limit WHERE ip_address = ?",
                [$clientIp]
            );
            if ($rateLimit && !empty($rateLimit['blocked_until']) && strtotime($rateLimit['blocked_until']) > time()) {
                $remainMin = ceil((strtotime($rateLimit['blocked_until']) - time()) / 60);
                try {
                    $db->insert(
                        "INSERT INTO login_logs (user_id, user_name, username_attempted, ip_address, user_agent, status, fail_reason) VALUES (?, ?, ?, ?, ?, 'failed', ?)",
                        [null, null, $username, $clientIp, $userAgent, 'rate_limited']
                    );
                } catch (Exception $e) {}
                error("ログイン試行回数が上限を超えました。{$remainMin}分後に再試行してください。", 429);
            }
        } catch (Exception $e) {
            // レートリミットテーブルがない場合は無視して続行
        }

        if (empty($username) || empty($password)) {
            error('ユーザー名とパスワードを入力してください');
        }

        $user = $db->fetch("SELECT * FROM users WHERE username = ?", [$username]);

        if (!$user || !password_verify($password, $user['password'])) {
            // 失敗をログに記録（エラーが出ても無視）
            $failReason = !$user ? 'user_not_found' : 'wrong_password';
            $userId = $user ? $user['id'] : null;
            $userName = $user ? $user['name'] : null;
            try {
                $db->insert(
                    "INSERT INTO login_logs (user_id, user_name, username_attempted, ip_address, user_agent, status, fail_reason) VALUES (?, ?, ?, ?, ?, 'failed', ?)",
                    [$userId, $userName, $username, $clientIp, $userAgent, $failReason]
                );
            } catch (Exception $e) {}

            // レートリミットカウント更新（エラーが出ても無視）
            try {
                if ($rateLimit) {
                    $newCount = $rateLimit['attempt_count'] + 1;
                    $blockedUntil = null;
                    if ($newCount >= 5) {
                        $blockedUntil = date('Y-m-d H:i:s', time() + 900);
                    }
                    $db->query(
                        "UPDATE login_rate_limit SET attempt_count = ?, blocked_until = ? WHERE id = ?",
                        [$newCount, $blockedUntil, $rateLimit['id']]
                    );
                } else {
                    $db->insert(
                        "INSERT INTO login_rate_limit (ip_address, attempt_count) VALUES (?, 1)",
                        [$clientIp]
                    );
                }
            } catch (Exception $e) {}

            error('Invalid credentials', 401);
        }

        // ログイン成功 → レートリミットリセット
        try {
            if ($rateLimit) {
                $db->query("DELETE FROM login_rate_limit WHERE ip_address = ?", [$clientIp]);
            }
        } catch (Exception $e) {}

        // セッション固定化対策
        session_regenerate_id(true);

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['name'] = $user['name'];
        $_SESSION['role'] = $user['role'];

        // ログイン成功履歴を記録（エラーが出ても無視）
        try {
            $db->insert(
                "INSERT INTO login_logs (user_id, user_name, username_attempted, ip_address, user_agent, status) VALUES (?, ?, ?, ?, ?, 'success')",
                [$user['id'], $user['name'], $username, $clientIp, $userAgent]
            );
        } catch (Exception $e) {}

        respond([
            'id' => $user['id'],
            'username' => $user['username'],
            'name' => $user['name'],
            'role' => $user['role']
        ]);
        break;
        
    case 'logout':
        session_destroy();
        respond(['message' => 'Logged out']);
        break;
        
    case 'check-auth':
        if (isset($_SESSION['user_id'])) {
            respond([
                'id' => $_SESSION['user_id'],
                'username' => $_SESSION['username'],
                'name' => $_SESSION['name'],
                'role' => $_SESSION['role']
            ]);
        } else {
            // 未認証時は200で返す（ブラウザコンソールの401エラー表示を回避）
            respond(['authenticated' => false]);
        }
        break;

    // ========== ユーザー管理 ==========
    case 'users':
        checkAdmin();
        
        if ($method === 'GET') {
            $users = $db->fetchAll("SELECT id, username, name, role, created_at FROM users ORDER BY id");
            respond($users);
        } elseif ($method === 'POST') {
            $username = $input['username'] ?? '';
            $password = $input['password'] ?? '';
            $name = $input['name'] ?? '';
            $role = $input['role'] ?? 'staff';
            
            if (empty($username) || empty($password) || empty($name)) {
                error('All fields required');
            }
            
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            $id = $db->insert(
                "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)",
                [$username, $hashedPassword, $name, $role]
            );

            logAudit('create', 'user', $id, $name, ['username' => $username, 'role' => $role]);
            respond(['id' => $id, 'message' => 'User created']);
        }
        break;
        
    case 'user':
        checkAdmin();
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            error('Invalid user ID', 400);
        }

        if ($method === 'PUT') {
            $name = $input['name'] ?? '';
            $username = $input['username'] ?? '';
            $role = $input['role'] ?? 'staff';
            $password = $input['password'] ?? '';
            
            if (!empty($password)) {
                $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
                $db->update(
                    "UPDATE users SET name = ?, username = ?, role = ?, password = ? WHERE id = ?",
                    [$name, $username, $role, $hashedPassword, $id]
                );
            } else {
                $db->update(
                    "UPDATE users SET name = ?, username = ?, role = ? WHERE id = ?",
                    [$name, $username, $role, $id]
                );
            }
            logAudit('update', 'user', $id, $name, ['username' => $username, 'role' => $role]);
            respond(['message' => 'User updated']);
        } elseif ($method === 'DELETE') {
            if ($id == $_SESSION['user_id']) {
                error('Cannot delete yourself');
            }
            $user = $db->fetch("SELECT name FROM users WHERE id = ?", [$id]);
            $db->delete("DELETE FROM users WHERE id = ?", [$id]);
            logAudit('delete', 'user', $id, $user['name'] ?? 'Unknown');
            respond(['message' => 'User deleted']);
        }
        break;

    // ========== 法人管理 ==========
    case 'corporations':
        checkAuth();
        
        if ($method === 'GET') {
            // ========== N+1クエリ問題を解決するバッチロード実装 ==========
            // Before: 4000+ クエリ (100法人 × 5現場 × 8テーブル)
            // After: 12 クエリ

            // 1. 全法人を取得
            $corps = $db->fetchAll("SELECT * FROM corporations ORDER BY name");
            if (empty($corps)) {
                respond([]);
            }

            $corpIds = array_column($corps, 'id');
            $corpIdPlaceholders = implode(',', array_fill(0, count($corpIds), '?'));

            // 2. 全サイトを一括取得
            $allSites = $db->fetchAll(
                "SELECT * FROM sites WHERE corporation_id IN ($corpIdPlaceholders) ORDER BY name",
                $corpIds
            );
            $siteIds = array_column($allSites, 'id');

            // バッチ変数を初期化（サイトがない場合に備える）
            $pestsBySite = [];
            $workTypesBySite = [];
            $workAreasBySite = [];
            $yearlyPlansBySite = [];
            $workLogsBySite = [];
            $photosBySite = [];
            $billingMonthsBySite = [];
            $documentsBySite = [];

            // サイトがある場合のみバッチ取得
            if (!empty($siteIds)) {
                $siteIdPlaceholders = implode(',', array_fill(0, count($siteIds), '?'));

                // 3. サイト関連データを一括取得
                $allPests = $db->fetchAll(
                    "SELECT site_id, pest_name FROM site_pests WHERE site_id IN ($siteIdPlaceholders)",
                    $siteIds
                );
                $allWorkTypes = $db->fetchAll(
                    "SELECT site_id, work_type FROM site_work_types WHERE site_id IN ($siteIdPlaceholders)",
                    $siteIds
                );
                $allWorkAreas = $db->fetchAll(
                    "SELECT site_id, work_area FROM site_work_areas WHERE site_id IN ($siteIdPlaceholders)",
                    $siteIds
                );
                $allYearlyPlans = $db->fetchAll(
                    "SELECT * FROM yearly_plans WHERE site_id IN ($siteIdPlaceholders)",
                    $siteIds
                );
                $allWorkLogs = $db->fetchAll(
                    "SELECT * FROM work_logs WHERE site_id IN ($siteIdPlaceholders) ORDER BY work_date DESC",
                    $siteIds
                );
                $allPhotos = $db->fetchAll(
                    "SELECT * FROM photos WHERE site_id IN ($siteIdPlaceholders) ORDER BY photo_date DESC",
                    $siteIds
                );
                $allBillingMonths = $db->fetchAll(
                    "SELECT site_id, billing_month FROM site_billing_months WHERE site_id IN ($siteIdPlaceholders)",
                    $siteIds
                );
                $allDocuments = $db->fetchAll(
                    "SELECT * FROM site_documents WHERE site_id IN ($siteIdPlaceholders) ORDER BY doc_date DESC",
                    $siteIds
                );

                // サイトIDでインデックス化
                $pestsBySite = [];
                foreach ($allPests as $p) {
                    $pestsBySite[$p['site_id']][] = $p['pest_name'];
                }
                $workTypesBySite = [];
                foreach ($allWorkTypes as $wt) {
                    $workTypesBySite[$wt['site_id']][] = $wt['work_type'];
                }
                $workAreasBySite = [];
                foreach ($allWorkAreas as $wa) {
                    $workAreasBySite[$wa['site_id']][] = $wa['work_area'];
                }
                $yearlyPlansBySite = [];
                foreach ($allYearlyPlans as $plan) {
                    $yearlyPlansBySite[$plan['site_id']][$plan['month']] = [
                        'scheduled' => (bool)$plan['scheduled'],
                        'date' => $plan['day'],
                        'dateType' => $plan['date_type'] ?? 'absolute',
                        'datePattern' => $plan['date_pattern'] ?? null,
                        'workType' => $plan['work_type'],
                        'completed' => !empty($plan['completed'])
                    ];
                }
                $workLogsBySite = [];
                foreach ($allWorkLogs as $log) {
                    $workLogsBySite[$log['site_id']][] = [
                        'id' => $log['id'],
                        'date' => $log['work_date'],
                        'workType' => $log['work_type'],
                        'condition' => $log['condition_status'],
                        'usedChemical' => $log['used_chemical'],
                        'note' => $log['note'],
                        'nextNote' => $log['next_note'],
                        'staff' => $log['staff']
                    ];
                }
                $photosBySite = [];
                foreach ($allPhotos as $photo) {
                    $photosBySite[$photo['site_id']][] = [
                        'id' => $photo['id'],
                        'url' => $photo['url'],
                        'date' => $photo['photo_date'],
                        'note' => $photo['note']
                    ];
                }
                $billingMonthsBySite = [];
                foreach ($allBillingMonths as $bm) {
                    $billingMonthsBySite[$bm['site_id']][] = (int)$bm['billing_month'];
                }
                $documentsBySite = [];
                foreach ($allDocuments as $doc) {
                    $documentsBySite[$doc['site_id']][] = [
                        'id' => $doc['id'],
                        'fileName' => $doc['file_name'],
                        'url' => $doc['url'],
                        'fileType' => $doc['file_type'],
                        'docType' => $doc['doc_type'],
                        'date' => $doc['doc_date']
                    ];
                }
            }

            // 4. 法人関連データを一括取得
            $allInvoices = $db->fetchAll(
                "SELECT * FROM invoice_history WHERE corporation_id IN ($corpIdPlaceholders) ORDER BY `year_month` DESC",
                $corpIds
            );
            $allContactLogs = $db->fetchAll(
                "SELECT * FROM contact_logs WHERE corporation_id IN ($corpIdPlaceholders) ORDER BY contact_date DESC",
                $corpIds
            );

            // 法人IDでインデックス化
            $invoicesByCorp = [];
            foreach ($allInvoices as $inv) {
                $invoicesByCorp[$inv['corporation_id']][] = [
                    'id' => $inv['id'],
                    'yearMonth' => $inv['year_month'],
                    'isSent' => (bool)$inv['is_sent'],
                    'isPaid' => (bool)$inv['is_paid'],
                    'paidDate' => $inv['paid_date']
                ];
            }
            $contactLogsByCorp = [];
            foreach ($allContactLogs as $log) {
                $contactLogsByCorp[$log['corporation_id']][] = [
                    'id' => $log['id'],
                    'date' => $log['contact_date'],
                    'type' => $log['contact_type'],
                    'content' => $log['content'],
                    'staff' => $log['staff']
                ];
            }

            // サイトを法人IDでグループ化
            $sitesByCorp = [];
            foreach ($allSites as $site) {
                $siteId = $site['id'];
                $sitesByCorp[$site['corporation_id']][] = [
                    'id' => $siteId,
                    'corporationId' => $site['corporation_id'],
                    'name' => $site['name'],
                    'address' => $site['address'],
                    'keybox' => $site['keybox'],
                    'keyboxLocation' => $site['keybox_location'],
                    'memo' => $site['memo'],
                    'pests' => $pestsBySite[$siteId] ?? [],
                    'workTypes' => $workTypesBySite[$siteId] ?? [],
                    'workAreas' => $workAreasBySite[$siteId] ?? [],
                    'yearlyPlan' => $yearlyPlansBySite[$siteId] ?? [],
                    'workLogs' => $workLogsBySite[$siteId] ?? [],
                    'photos' => $photosBySite[$siteId] ?? [],
                    'billingMonths' => $billingMonthsBySite[$siteId] ?? [],
                    'documents' => $documentsBySite[$siteId] ?? []
                ];
            }

            // 5. 最終的なレスポンスを組み立て
            foreach ($corps as &$corp) {
                $corpId = $corp['id'];
                $corp['sites'] = $sitesByCorp[$corpId] ?? [];
                $corp['invoiceHistory'] = $invoicesByCorp[$corpId] ?? [];
                $corp['contactLogs'] = $contactLogsByCorp[$corpId] ?? [];

                // キー名をキャメルケースに変換
                $corp['contactPerson'] = $corp['contact_person'];
                $corp['billingCycle'] = $corp['billing_cycle'];
                $corp['billingDay'] = $corp['billing_day'];
                $corp['billingMonth'] = $corp['billing_month'];
                $corp['contractStart'] = $corp['contract_start'];
                $corp['contractEnd'] = $corp['contract_end'];
                $corp['contractAmount'] = (int)$corp['contract_amount'];
                $corp['contractType'] = $corp['contract_type'];
            }

            respond($corps);
        } elseif ($method === 'POST') {
            checkAuth(); // スタッフも法人追加可能

            $name = $input['name'] ?? '';
            if (empty($name)) error('Name required');
            
            $id = $db->insert(
                "INSERT INTO corporations (name, address, contact, contact_person, billing_cycle, billing_day, billing_month, memo, contract_start, contract_end, contract_amount, contract_type) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    $name,
                    $input['address'] ?? '',
                    $input['contact'] ?? '',
                    $input['contactPerson'] ?? '',
                    $input['billingCycle'] ?? '毎月',
                    $input['billingDay'] ?? '25',
                    $input['billingMonth'] ?? '',
                    $input['memo'] ?? '',
                    $input['contractStart'] ?? null,
                    $input['contractEnd'] ?? null,
                    $input['contractAmount'] ?? 0,
                    $input['contractType'] ?? '月額'
                ]
            );
            
            // 現場も一緒に登録
            if (!empty($input['sites'])) {
                foreach ($input['sites'] as $site) {
                    if (empty($site['name'])) continue;
                    
                    $siteId = $db->insert(
                        "INSERT INTO sites (corporation_id, name, address, keybox, keybox_location, memo) VALUES (?, ?, ?, ?, ?, ?)",
                        [$id, $site['name'], $site['address'] ?? '', $site['keybox'] ?? '', $site['keyboxLocation'] ?? '', $site['memo'] ?? '']
                    );
                    
                    if (!empty($site['pests'])) {
                        foreach ($site['pests'] as $pest) {
                            $db->insert("INSERT INTO site_pests (site_id, pest_name) VALUES (?, ?)", [$siteId, $pest]);
                        }
                    }
                    if (!empty($site['workTypes'])) {
                        foreach ($site['workTypes'] as $wt) {
                            $db->insert("INSERT INTO site_work_types (site_id, work_type) VALUES (?, ?)", [$siteId, $wt]);
                        }
                    }
                    if (!empty($site['workAreas'])) {
                        foreach ($site['workAreas'] as $wa) {
                            $db->insert("INSERT INTO site_work_areas (site_id, work_area) VALUES (?, ?)", [$siteId, $wa]);
                        }
                    }
                }
            }

            logAudit('create', 'corporation', $id, $name);
            respond(['id' => $id, 'message' => 'Corporation created']);
        }
        break;

    case 'corporation':
        checkAuth();
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            error('Invalid corporation ID', 400);
        }

        if ($method === 'PUT') {
            checkAuth(); // スタッフも法人編集可能

            $db->update(
                "UPDATE corporations SET name = ?, address = ?, contact = ?, contact_person = ?, 
                 billing_cycle = ?, billing_day = ?, billing_month = ?, memo = ?,
                 contract_start = ?, contract_end = ?, contract_amount = ?, contract_type = ? WHERE id = ?",
                [
                    $input['name'] ?? '',
                    $input['address'] ?? '',
                    $input['contact'] ?? '',
                    $input['contactPerson'] ?? '',
                    $input['billingCycle'] ?? '毎月',
                    $input['billingDay'] ?? '25',
                    $input['billingMonth'] ?? '',
                    $input['memo'] ?? '',
                    $input['contractStart'] ?? null,
                    $input['contractEnd'] ?? null,
                    $input['contractAmount'] ?? 0,
                    $input['contractType'] ?? '月額',
                    $id
                ]
            );
            logAudit('update', 'corporation', $id, $input['name'] ?? '');
            respond(['message' => 'Corporation updated']);
        } elseif ($method === 'DELETE') {
            checkAuth(); // スタッフも法人削除可能
            $corp = $db->fetch("SELECT name FROM corporations WHERE id = ?", [$id]);
            $db->delete("DELETE FROM corporations WHERE id = ?", [$id]);
            logAudit('delete', 'corporation', $id, $corp['name'] ?? 'Unknown');
            respond(['message' => 'Corporation deleted']);
        }
        break;

    // ========== 現場管理 ==========
    case 'sites':
        checkAuth();
        
        if ($method === 'POST') {
            checkAuth(); // スタッフも現場追加可能

            $corpId = $input['corporationId'] ?? 0;
            $name = $input['name'] ?? '';
            if (empty($name)) error('Name required');
            
            $siteId = $db->insert(
                "INSERT INTO sites (corporation_id, name, address, keybox, keybox_location, memo) VALUES (?, ?, ?, ?, ?, ?)",
                [$corpId, $name, $input['address'] ?? '', $input['keybox'] ?? '', $input['keyboxLocation'] ?? '', $input['memo'] ?? '']
            );
            
            if (!empty($input['pests'])) {
                foreach ($input['pests'] as $pest) {
                    $db->insert("INSERT INTO site_pests (site_id, pest_name) VALUES (?, ?)", [$siteId, $pest]);
                }
            }
            if (!empty($input['workTypes'])) {
                foreach ($input['workTypes'] as $wt) {
                    $db->insert("INSERT INTO site_work_types (site_id, work_type) VALUES (?, ?)", [$siteId, $wt]);
                }
            }
            if (!empty($input['workAreas'])) {
                foreach ($input['workAreas'] as $wa) {
                    $db->insert("INSERT INTO site_work_areas (site_id, work_area) VALUES (?, ?)", [$siteId, $wa]);
                }
            }
            if (!empty($input['billingMonths'])) {
                foreach ($input['billingMonths'] as $month) {
                    $db->insert("INSERT INTO site_billing_months (site_id, billing_month) VALUES (?, ?)", [$siteId, $month]);
                }
            }

            logAudit('create', 'site', $siteId, $name);
            respond(['id' => $siteId, 'message' => 'Site created']);
        }
        break;
        
    case 'site':
        checkAuth();
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            error('Invalid site ID', 400);
        }

        if ($method === 'PUT') {
            // 現場の存在確認
            $existingSite = $db->fetch("SELECT id FROM sites WHERE id = ?", [$id]);
            if (!$existingSite) {
                error('Site not found', 404);
            }

            // キーボックス情報の取得
            $keybox = $input['keybox'] ?? '';
            $keyboxLocation = $input['keyboxLocation'] ?? '';

            $db->update(
                "UPDATE sites SET name = ?, address = ?, keybox = ?, keybox_location = ?, memo = ? WHERE id = ?",
                [$input['name'] ?? '', $input['address'] ?? '', $keybox, $keyboxLocation, $input['memo'] ?? '', $id]
            );
            
            // 害虫、作業内容、作業箇所を更新
            $db->delete("DELETE FROM site_pests WHERE site_id = ?", [$id]);
            $db->delete("DELETE FROM site_work_types WHERE site_id = ?", [$id]);
            $db->delete("DELETE FROM site_work_areas WHERE site_id = ?", [$id]);
            
            if (!empty($input['pests'])) {
                foreach ($input['pests'] as $pest) {
                    $db->insert("INSERT INTO site_pests (site_id, pest_name) VALUES (?, ?)", [$id, $pest]);
                }
            }
            if (!empty($input['workTypes'])) {
                foreach ($input['workTypes'] as $wt) {
                    $db->insert("INSERT INTO site_work_types (site_id, work_type) VALUES (?, ?)", [$id, $wt]);
                }
            }
            if (!empty($input['workAreas'])) {
                foreach ($input['workAreas'] as $wa) {
                    $db->insert("INSERT INTO site_work_areas (site_id, work_area) VALUES (?, ?)", [$id, $wa]);
                }
            }

            // 請求月を更新
            $db->delete("DELETE FROM site_billing_months WHERE site_id = ?", [$id]);
            if (!empty($input['billingMonths'])) {
                foreach ($input['billingMonths'] as $month) {
                    $db->insert("INSERT INTO site_billing_months (site_id, billing_month) VALUES (?, ?)", [$id, $month]);
                }
            }

            logAudit('update', 'site', $id, $input['name'] ?? '');
            respond(['message' => 'Site updated']);
        } elseif ($method === 'DELETE') {
            checkAdmin();
            $site = $db->fetch("SELECT name FROM sites WHERE id = ?", [$id]);
            $db->delete("DELETE FROM sites WHERE id = ?", [$id]);
            logAudit('delete', 'site', $id, $site['name'] ?? 'Unknown');
            respond(['message' => 'Site deleted']);
        }
        break;

    // ========== 年間計画 ==========
    case 'yearly-plan':
        checkAuth();
        $siteId = $_GET['site_id'] ?? 0;

        if ($method === 'PUT') {
            checkAdmin();

            $plans = $input['yearlyPlan'] ?? [];

            // テーブルにdate_type, date_pattern, completedカラムがなければ追加
            try {
                $db->query("ALTER TABLE yearly_plans ADD COLUMN date_type VARCHAR(20) DEFAULT 'absolute'");
            } catch (Exception $e) {}
            try {
                $db->query("ALTER TABLE yearly_plans ADD COLUMN date_pattern VARCHAR(50)");
            } catch (Exception $e) {}
            try {
                $db->query("ALTER TABLE yearly_plans ADD COLUMN completed TINYINT DEFAULT 0");
            } catch (Exception $e) {}

            // 既存プランを削除して再作成
            $db->delete("DELETE FROM yearly_plans WHERE site_id = ?", [$siteId]);

            foreach ($plans as $month => $plan) {
                if (!empty($plan['scheduled'])) {
                    $dateType = $plan['dateType'] ?? 'absolute';
                    $datePattern = $plan['datePattern'] ?? null;
                    $actualDay = null;

                    if ($dateType === 'relative' && $datePattern) {
                        // 相対日付を今年の実日に計算
                        $actualDay = calculateRelativeDate(date('Y'), (int)$month, $datePattern);
                    } else {
                        // 固定日
                        $actualDay = (int)($plan['date'] ?? 15);
                        $dateType = 'absolute';
                        $datePattern = null;
                    }

                    $completed = !empty($plan['completed']) ? 1 : 0;
                    $db->insert(
                        "INSERT INTO yearly_plans (site_id, month, scheduled, day, work_type, date_type, date_pattern, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        [$siteId, $month, 1, $actualDay, $plan['workType'] ?? '', $dateType, $datePattern, $completed]
                    );
                }
            }

            respond(['message' => 'Yearly plan updated']);
        }
        break;

    // ========== 作業完了トグル ==========
    case 'yearly-plan-complete':
        checkAuth();
        if ($method === 'PUT') {
            $siteId = (int)($input['siteId'] ?? 0);
            $month = (int)($input['month'] ?? 0);
            $completed = !empty($input['completed']) ? 1 : 0;

            // completedカラムがなければ追加
            try {
                $db->query("ALTER TABLE yearly_plans ADD COLUMN completed TINYINT DEFAULT 0");
            } catch (Exception $e) {}

            $db->update(
                "UPDATE yearly_plans SET completed = ? WHERE site_id = ? AND month = ?",
                [$completed, $siteId, $month]
            );
            respond(['message' => '更新しました']);
        }
        break;

    // ========== 作業履歴 ==========
    case 'work-logs':
        checkAuth();

        if ($method === 'POST') {
            $siteId = $input['siteId'] ?? 0;

            $id = $db->insert(
                "INSERT INTO work_logs (site_id, work_date, work_type, condition_status, used_chemical, note, next_note, staff)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    $siteId,
                    $input['date'] ?? date('Y-m-d'),
                    $input['workType'] ?? '',
                    $input['condition'] ?? '',
                    $input['usedChemical'] ?? '',
                    $input['note'] ?? '',
                    $input['nextNote'] ?? '',
                    $_SESSION['name'] ?? ''
                ]
            );

            respond(['id' => $id, 'message' => 'Work log created']);
        }
        break;

    case 'work-log':
        checkAuth();
        $id = (int)($_GET['id'] ?? 0);

        if ($method === 'PUT') {
            if ($id <= 0) error('IDを指定してください', 400);
            $db->update(
                "UPDATE work_logs SET work_date = ?, work_type = ?, condition_status = ?, used_chemical = ?, note = ?, next_note = ? WHERE id = ?",
                [
                    $input['date'] ?? date('Y-m-d'),
                    $input['workType'] ?? '',
                    $input['condition'] ?? '',
                    $input['usedChemical'] ?? '',
                    $input['note'] ?? '',
                    $input['nextNote'] ?? '',
                    $id
                ]
            );
            respond(['message' => '作業ログを更新しました']);
        } elseif ($method === 'DELETE') {
            if ($id <= 0) error('IDを指定してください', 400);
            $db->delete("DELETE FROM work_logs WHERE id = ?", [$id]);
            respond(['message' => '作業ログを削除しました']);
        }
        break;

    // ========== 写真 ==========
    case 'photos':
        checkAuth();

        // 最大ファイルサイズ（5MB）
        define('MAX_IMAGE_SIZE', 5 * 1024 * 1024);

        if ($method === 'POST') {
            $siteId = (int)($input['siteId'] ?? 0);
            if ($siteId <= 0) {
                error('Invalid site ID', 400);
            }
            $imageData = $input['imageData'] ?? '';
            $photoDate = $input['date'] ?? date('Y-m-d');
            $note = $input['note'] ?? '';

            $url = '';

            // Base64画像データがある場合はファイルとして保存
            if (!empty($imageData) && strpos($imageData, 'data:image') === 0) {
                // アップロードディレクトリを作成
                $uploadDir = __DIR__ . '/../uploads/photos/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }

                // Base64デコード
                $imageData = preg_replace('/^data:image\/\w+;base64,/', '', $imageData);
                $decodedData = base64_decode($imageData, true);
                if ($decodedData === false) {
                    error('Invalid image data', 400);
                }

                // ファイルサイズチェック
                if (strlen($decodedData) > MAX_IMAGE_SIZE) {
                    error('Image too large (max 5MB)', 400);
                }

                // 実際に画像かどうか検証
                $imageInfo = @getimagesizefromstring($decodedData);
                if ($imageInfo === false || !in_array($imageInfo['mime'], ['image/jpeg', 'image/png', 'image/gif', 'image/webp'])) {
                    error('Invalid image format', 400);
                }

                // ファイル名を生成（拡張子を正しく設定）
                $ext = image_type_to_extension($imageInfo[2], false);
                $fileName = 'photo_' . $siteId . '_' . date('YmdHis') . '_' . uniqid() . '.' . $ext;
                $filePath = $uploadDir . $fileName;

                // ファイル保存
                if (file_put_contents($filePath, $decodedData)) {
                    $url = '/uploads/photos/' . $fileName;
                } else {
                    error('Failed to save image');
                }
            } else {
                // URLが渡された場合はそのまま使用
                $url = $input['url'] ?? '';
            }
            
            $id = $db->insert(
                "INSERT INTO photos (site_id, url, photo_date, note) VALUES (?, ?, ?, ?)",
                [$siteId, $url, $photoDate, $note]
            );
            
            respond(['id' => $id, 'url' => $url, 'message' => 'Photo added']);
        } elseif ($method === 'DELETE') {
            $id = (int)($_GET['id'] ?? 0);
            if ($id <= 0) {
                error('Invalid photo ID', 400);
            }

            // 写真情報取得
            $photo = $db->fetch("SELECT * FROM photos WHERE id = ?", [$id]);
            if (!$photo) {
                error('Photo not found', 404);
            }

            // ファイル削除
            if (!empty($photo['url'])) {
                $filePath = __DIR__ . '/..' . $photo['url'];
                if (file_exists($filePath)) {
                    unlink($filePath);
                }
            }

            // DB削除
            $db->delete("DELETE FROM photos WHERE id = ?", [$id]);
            respond(['message' => 'Photo deleted']);
        }
        break;

    // ========== 現場書類 ==========
    case 'site-documents':
        checkAuth();

        // 最大ファイルサイズ（10MB）
        if (!defined('MAX_DOC_SIZE')) {
            define('MAX_DOC_SIZE', 10 * 1024 * 1024);
        }

        if ($method === 'POST') {
            $siteId = (int)($input['siteId'] ?? 0);
            if ($siteId <= 0) {
                error('Invalid site ID', 400);
            }
            $fileName = $input['fileName'] ?? '';
            $fileData = $input['fileData'] ?? '';
            $fileType = $input['fileType'] ?? '';
            $docType = $input['docType'] ?? 'その他';
            $docDate = $input['date'] ?? date('Y-m-d');

            $url = '';

            // Base64データがある場合はファイルとして保存
            if (!empty($fileData) && strpos($fileData, 'data:') === 0) {
                // アップロードディレクトリを作成
                $uploadDir = __DIR__ . '/../uploads/documents/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }

                // Base64デコード
                $fileData = preg_replace('/^data:[^;]+;base64,/', '', $fileData);
                $decodedData = base64_decode($fileData, true);
                if ($decodedData === false) {
                    error('Invalid file data', 400);
                }

                // ファイルサイズチェック
                if (strlen($decodedData) > MAX_DOC_SIZE) {
                    error('File too large (max 10MB)', 400);
                }

                // ファイル拡張子を決定（実際のファイル内容から判定）
                $ext = 'dat';
                $finfo = new finfo(FILEINFO_MIME_TYPE);
                $detectedMime = $finfo->buffer($decodedData);

                // 許可されたMIMEタイプのみ受け入れ
                $allowedMimes = [
                    'application/pdf' => 'pdf',
                    'image/jpeg' => 'jpg',
                    'image/png' => 'png',
                    'image/gif' => 'gif'
                ];
                if (!isset($allowedMimes[$detectedMime])) {
                    error('Invalid file type. Only PDF and images are allowed.', 400);
                }
                $ext = $allowedMimes[$detectedMime];

                // ファイル名を生成
                $savedFileName = 'doc_' . $siteId . '_' . date('YmdHis') . '_' . uniqid() . '.' . $ext;
                $filePath = $uploadDir . $savedFileName;

                // ファイル保存
                if (file_put_contents($filePath, $decodedData)) {
                    $url = '/uploads/documents/' . $savedFileName;
                } else {
                    error('Failed to save document');
                }
            }

            $id = $db->insert(
                "INSERT INTO site_documents (site_id, file_name, url, file_type, doc_type, doc_date) VALUES (?, ?, ?, ?, ?, ?)",
                [$siteId, $fileName, $url, $fileType, $docType, $docDate]
            );

            respond(['id' => $id, 'url' => $url, 'message' => 'Document added']);
        }
        break;

    case 'site-document':
        checkAuth();

        if ($method === 'DELETE') {
            $id = (int)($_GET['id'] ?? 0);
            if ($id <= 0) {
                error('Invalid document ID', 400);
            }

            // 書類情報取得
            $doc = $db->fetch("SELECT * FROM site_documents WHERE id = ?", [$id]);
            if (!$doc) {
                error('Document not found', 404);
            }

            // ファイル削除
            if (!empty($doc['url'])) {
                $filePath = __DIR__ . '/..' . $doc['url'];
                if (file_exists($filePath)) {
                    unlink($filePath);
                }
            }

            // DB削除
            $db->delete("DELETE FROM site_documents WHERE id = ?", [$id]);
            respond(['message' => 'Document deleted']);
        }
        break;

    // ========== 請求履歴 ==========
    case 'invoice':
        checkAdmin();
        $corpId = $_GET['corp_id'] ?? 0;
        
        if ($method === 'PUT') {
            $yearMonth = $input['yearMonth'] ?? '';
            $isSent = $input['isSent'] ?? false;
            $isPaid = $input['isPaid'] ?? false;
            $paidDate = $isPaid ? ($input['paidDate'] ?? date('Y-m-d')) : null;
            
            // UPSERT
            $db->query(
                "INSERT INTO invoice_history (corporation_id, `year_month`, is_sent, is_paid, paid_date) 
                 VALUES (?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE is_sent = VALUES(is_sent), is_paid = VALUES(is_paid), paid_date = VALUES(paid_date)",
                [$corpId, $yearMonth, $isSent ? 1 : 0, $isPaid ? 1 : 0, $paidDate]
            );
            
            respond(['message' => 'Invoice updated']);
        }
        break;

    // ========== 連絡履歴 ==========
    case 'contact-logs':
        checkAuth();
        
        if ($method === 'POST') {
            checkAdmin();
            
            $corpId = $input['corporationId'] ?? 0;
            
            $id = $db->insert(
                "INSERT INTO contact_logs (corporation_id, contact_date, contact_type, content, staff) VALUES (?, ?, ?, ?, ?)",
                [$corpId, $input['date'] ?? date('Y-m-d'), $input['type'] ?? '電話', $input['content'] ?? '', $_SESSION['name'] ?? '']
            );
            
            respond(['id' => $id, 'message' => 'Contact log created']);
        }
        break;

    // ========== マスターデータ ==========
    case 'master-data':
        checkAuth();
        
        if ($method === 'GET') {
            $pests = array_column($db->fetchAll("SELECT name FROM master_pests ORDER BY id"), 'name');
            $workTypes = array_column($db->fetchAll("SELECT name FROM master_work_types ORDER BY id"), 'name');
            $workAreas = array_column($db->fetchAll("SELECT name FROM master_work_areas ORDER BY id"), 'name');
            
            respond([
                'pestTypes' => $pests,
                'workTypes' => $workTypes,
                'workAreas' => $workAreas
            ]);
        } elseif ($method === 'POST') {
            checkAdmin();
            
            $type = $input['type'] ?? '';
            $name = $input['name'] ?? '';
            
            if (empty($name)) error('Name required');
            
            switch ($type) {
                case 'pest':
                    $db->insert("INSERT IGNORE INTO master_pests (name) VALUES (?)", [$name]);
                    break;
                case 'workType':
                    $db->insert("INSERT IGNORE INTO master_work_types (name) VALUES (?)", [$name]);
                    break;
                case 'workArea':
                    $db->insert("INSERT IGNORE INTO master_work_areas (name) VALUES (?)", [$name]);
                    break;
            }
            
            respond(['message' => 'Master data added']);
        } elseif ($method === 'DELETE') {
            checkAdmin();
            
            $type = $_GET['type'] ?? '';
            $name = $_GET['name'] ?? '';
            
            switch ($type) {
                case 'pest':
                    $db->delete("DELETE FROM master_pests WHERE name = ?", [$name]);
                    break;
                case 'workType':
                    $db->delete("DELETE FROM master_work_types WHERE name = ?", [$name]);
                    break;
                case 'workArea':
                    $db->delete("DELETE FROM master_work_areas WHERE name = ?", [$name]);
                    break;
            }
            
            respond(['message' => 'Master data deleted']);
        }
        break;

    // ========== キーボックス閲覧ログ ==========
    case 'keybox-log':
        checkAuth();

        if ($method === 'POST') {
            $siteId = (int)($input['siteId'] ?? 0);
            $siteName = $input['siteName'] ?? '';

            if ($siteId <= 0 || empty($siteName)) {
                error('現場情報が不正です');
            }

            $db->insert(
                "INSERT INTO keybox_logs (site_id, site_name, user_id, user_name) VALUES (?, ?, ?, ?)",
                [$siteId, $siteName, $_SESSION['user_id'], $_SESSION['name']]
            );

            respond(['message' => 'Keybox access logged']);
        } elseif ($method === 'GET') {
            checkAdmin();

            $logs = $db->fetchAll(
                "SELECT * FROM keybox_logs ORDER BY viewed_at DESC LIMIT 100"
            );
            respond($logs);
        }
        break;

    case 'login-logs':
        checkAdmin();

        $limit = intval($_GET['limit'] ?? 200);
        $limit = min($limit, 1000);
        $statusFilter = $_GET['status'] ?? '';

        $sql = "SELECT * FROM login_logs";
        $params = [];
        if ($statusFilter === 'success' || $statusFilter === 'failed') {
            $sql .= " WHERE status = ?";
            $params[] = $statusFilter;
        }
        $sql .= " ORDER BY login_at DESC LIMIT ?";
        $params[] = $limit;

        $logs = $db->fetchAll($sql, $params);

        // 現在ブロック中のIP一覧も取得
        $blockedIps = $db->fetchAll(
            "SELECT ip_address, attempt_count, blocked_until FROM login_rate_limit WHERE blocked_until > NOW()"
        );

        // 直近24時間の統計
        $stats = $db->fetch(
            "SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as fail_count,
                COUNT(DISTINCT ip_address) as unique_ips
             FROM login_logs WHERE login_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)"
        );

        respond([
            'logs' => $logs,
            'blocked_ips' => $blockedIps,
            'stats_24h' => $stats
        ]);
        break;

    case 'login-unblock':
        checkAdmin();
        if ($method !== 'POST') error('Method not allowed', 405);
        $ip = $input['ip'] ?? '';
        if (empty($ip)) error('IP address required');
        $db->query("DELETE FROM login_rate_limit WHERE ip_address = ?", [$ip]);
        respond(['message' => "IP {$ip} のブロックを解除しました"]);
        break;

    // ========== CSVエクスポート ==========
    case 'export':
        checkAdmin();

        // typeパラメータをサニタイズ（英数字のみ許可）
        $type = preg_replace('/[^a-zA-Z0-9]/', '', $_GET['type'] ?? '');
        if (!in_array($type, ['corporations', 'sites', 'workLogs'])) {
            error('Invalid export type', 400);
        }

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $type . '_' . date('Ymd') . '.csv"');
        
        // BOM for Excel
        echo "\xEF\xBB\xBF";
        
        $output = fopen('php://output', 'w');
        
        switch ($type) {
            case 'corporations':
                fputcsv($output, ['法人名', '住所', '電話番号', '担当者', '請求サイクル', '契約開始', '契約終了', '契約金額', '現場数']);
                // サブクエリで現場数を取得（SQL厳格モード対応）
                $corps = $db->fetchAll("SELECT c.*, (SELECT COUNT(*) FROM sites s WHERE s.corporation_id = c.id) as site_count FROM corporations c ORDER BY c.name");
                foreach ($corps as $c) {
                    fputcsv($output, [$c['name'], $c['address'], $c['contact'], $c['contact_person'], $c['billing_cycle'], $c['contract_start'], $c['contract_end'], $c['contract_amount'], $c['site_count']]);
                }
                break;
            case 'sites':
                fputcsv($output, ['法人名', '現場名', '住所', 'キーボックス']);
                $sites = $db->fetchAll("SELECT s.*, c.name as corp_name FROM sites s JOIN corporations c ON s.corporation_id = c.id ORDER BY c.name, s.name");
                foreach ($sites as $s) {
                    fputcsv($output, [$s['corp_name'], $s['name'], $s['address'], $s['keybox']]);
                }
                break;
            case 'workLogs':
                fputcsv($output, ['法人名', '現場名', '施工日', '作業内容', '状況', '使用薬剤', '備考', '担当者']);
                $logs = $db->fetchAll("SELECT w.*, s.name as site_name, c.name as corp_name FROM work_logs w JOIN sites s ON w.site_id = s.id JOIN corporations c ON s.corporation_id = c.id ORDER BY w.work_date DESC");
                foreach ($logs as $l) {
                    fputcsv($output, [$l['corp_name'], $l['site_name'], $l['work_date'], $l['work_type'], $l['condition_status'], $l['used_chemical'], $l['note'], $l['staff']]);
                }
                break;
        }
        
        fclose($output);
        exit;

    // ========== 日報管理 ==========
    case 'daily-reports':
        checkAuth();

        if ($method === 'GET') {
            $yearMonth = $_GET['year_month'] ?? date('Y-m');
            $userId = $_GET['user_id'] ?? null;

            $sql = "SELECT dr.id, dr.user_id, dr.report_date, dr.vehicle, dr.expenses,
                    dr.contact_notes, dr.remarks, dr.status, dr.created_at, dr.updated_at,
                    u.name as user_name
                    FROM daily_reports dr
                    JOIN users u ON dr.user_id = u.id
                    WHERE DATE_FORMAT(dr.report_date, '%Y-%m') = ?";
            $params = [$yearMonth];

            // スタッフは自分のみ、管理者・マスターは全員または指定ユーザー
            if ($_SESSION['role'] !== 'admin' && $_SESSION['role'] !== 'master') {
                $sql .= " AND dr.user_id = ?";
                $params[] = $_SESSION['user_id'];
            } elseif ($userId) {
                $sql .= " AND dr.user_id = ?";
                $params[] = $userId;
            }

            $sql .= " ORDER BY dr.report_date DESC";
            $reports = $db->fetchAll($sql, $params);

            // 各日報の作業明細と時間集計を別クエリで取得
            foreach ($reports as &$report) {
                $report['details'] = $db->fetchAll(
                    "SELECT * FROM daily_report_details WHERE report_id = ? ORDER BY sort_order, start_time",
                    [$report['id']]
                );
                $hours = $db->fetch(
                    "SELECT regular_hours, night_hours, construction_points, other_hours FROM daily_report_hours WHERE report_id = ?",
                    [$report['id']]
                );
                $report['regular_hours'] = $hours['regular_hours'] ?? null;
                $report['night_hours'] = $hours['night_hours'] ?? null;
                $report['construction_points'] = $hours['construction_points'] ?? null;
                $report['other_hours'] = $hours['other_hours'] ?? null;
            }

            respond($reports);
        } elseif ($method === 'POST') {
            $reportDate = $input['reportDate'] ?? date('Y-m-d');
            $vehicle = $input['vehicle'] ?? '';
            $expenses = max(0, floatval($input['expenses'] ?? 0)); // 負の値は0に補正
            $contactNotes = $input['contactNotes'] ?? '';
            $remarks = $input['remarks'] ?? '';
            $status = $input['status'] ?? 'draft';
            $details = $input['details'] ?? [];

            // 既存チェック
            $existing = $db->fetch(
                "SELECT id FROM daily_reports WHERE user_id = ? AND report_date = ?",
                [$_SESSION['user_id'], $reportDate]
            );

            if ($existing) {
                error('この日付の日報は既に存在します。編集から更新してください。');
            }

            // 日報作成
            $reportId = $db->insert(
                "INSERT INTO daily_reports (user_id, report_date, vehicle, expenses, contact_notes, remarks, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [$_SESSION['user_id'], $reportDate, $vehicle, $expenses, $contactNotes, $remarks, $status]
            );

            // 作業明細を追加（空の時刻はNULLに変換）
            foreach ($details as $i => $detail) {
                $startTime = !empty($detail['startTime']) ? $detail['startTime'] : null;
                $endTime = !empty($detail['endTime']) ? $detail['endTime'] : null;
                $siteName = $detail['siteName'] ?? '';

                // 全て空ならスキップ
                if (!$startTime && !$endTime && empty($siteName)) {
                    continue;
                }

                $db->insert(
                    "INSERT INTO daily_report_details (report_id, start_time, end_time, site_id, site_name, worker_count, companions, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [$reportId, $startTime, $endTime, $detail['siteId'] ?: null, $siteName, $detail['workerCount'] ?? 1, $detail['companions'] ?? '', $i]
                );
            }

            // 時間集計レコードを作成（負の値は0に補正）
            $regularHours = max(0, floatval($input['regularHours'] ?? 0));
            $nightHours = max(0, floatval($input['nightHours'] ?? 0));
            $constructionPoints = max(0, floatval($input['constructionPoints'] ?? 0));
            $otherHours = max(0, floatval($input['otherHours'] ?? 0));

            $db->insert(
                "INSERT INTO daily_report_hours (report_id, regular_hours, night_hours, construction_points, other_hours) VALUES (?, ?, ?, ?, ?)",
                [$reportId, $regularHours, $nightHours, $constructionPoints, $otherHours]
            );

            respond(['id' => $reportId, 'message' => '日報を作成しました']);
        }
        break;

    case 'daily-report':
        checkAuth();
        if (!isset($_GET['id']) || $_GET['id'] === '') {
            error('Invalid daily report ID', 400);
        }
        $id = (int)$_GET['id'];

        if ($method === 'GET') {
            $report = $db->fetch(
                "SELECT dr.id, dr.user_id, dr.report_date, dr.vehicle, dr.expenses,
                 dr.contact_notes, dr.remarks, dr.status, dr.created_at, dr.updated_at,
                 u.name as user_name
                 FROM daily_reports dr
                 JOIN users u ON dr.user_id = u.id
                 WHERE dr.id = ?",
                [$id]
            );

            if (!$report) {
                error('日報が見つかりません', 404);
            }

            // 権限チェック
            if ($_SESSION['role'] !== 'admin' && $_SESSION['role'] !== 'master' && $report['user_id'] != $_SESSION['user_id']) {
                error('権限がありません', 403);
            }

            $report['details'] = $db->fetchAll(
                "SELECT * FROM daily_report_details WHERE report_id = ? ORDER BY sort_order, start_time",
                [$id]
            );

            // 時間集計を別クエリで取得
            $hours = $db->fetch(
                "SELECT regular_hours, night_hours, construction_points, other_hours FROM daily_report_hours WHERE report_id = ?",
                [$id]
            );
            $report['regular_hours'] = $hours['regular_hours'] ?? null;
            $report['night_hours'] = $hours['night_hours'] ?? null;
            $report['construction_points'] = $hours['construction_points'] ?? null;
            $report['other_hours'] = $hours['other_hours'] ?? null;

            respond($report);
        } elseif ($method === 'PUT') {
            // 権限チェック
            $report = $db->fetch("SELECT user_id FROM daily_reports WHERE id = ?", [$id]);
            if (!$report) {
                error('日報が見つかりません', 404);
            }
            if ($_SESSION['role'] !== 'admin' && $_SESSION['role'] !== 'master' && $report['user_id'] != $_SESSION['user_id']) {
                error('権限がありません', 403);
            }

            $vehicle = $input['vehicle'] ?? '';
            $expenses = max(0, floatval($input['expenses'] ?? 0)); // 負の値は0に補正
            $contactNotes = $input['contactNotes'] ?? '';
            $remarks = $input['remarks'] ?? '';
            $status = $input['status'] ?? 'draft';
            $details = $input['details'] ?? [];

            $db->update(
                "UPDATE daily_reports SET vehicle = ?, expenses = ?, contact_notes = ?, remarks = ?, status = ? WHERE id = ?",
                [$vehicle, $expenses, $contactNotes, $remarks, $status, $id]
            );

            // 作業明細を削除して再作成（空の時刻はNULLに変換）
            $db->delete("DELETE FROM daily_report_details WHERE report_id = ?", [$id]);
            foreach ($details as $i => $detail) {
                $startTime = !empty($detail['startTime']) ? $detail['startTime'] : null;
                $endTime = !empty($detail['endTime']) ? $detail['endTime'] : null;
                $siteName = $detail['siteName'] ?? '';

                // 全て空ならスキップ
                if (!$startTime && !$endTime && empty($siteName)) {
                    continue;
                }

                $db->insert(
                    "INSERT INTO daily_report_details (report_id, start_time, end_time, site_id, site_name, worker_count, companions, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [$id, $startTime, $endTime, $detail['siteId'] ?: null, $siteName, $detail['workerCount'] ?? 1, $detail['companions'] ?? '', $i]
                );
            }

            // 時間データを更新（負の値は0に補正）
            $regularHours = max(0, floatval($input['regularHours'] ?? 0));
            $nightHours = max(0, floatval($input['nightHours'] ?? 0));
            $constructionPoints = max(0, floatval($input['constructionPoints'] ?? 0));
            $otherHours = max(0, floatval($input['otherHours'] ?? 0));

            $db->update(
                "INSERT INTO daily_report_hours (report_id, regular_hours, night_hours, construction_points, other_hours)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE regular_hours = ?, night_hours = ?, construction_points = ?, other_hours = ?",
                [$id, $regularHours, $nightHours, $constructionPoints, $otherHours,
                 $regularHours, $nightHours, $constructionPoints, $otherHours]
            );

            respond(['message' => '日報を更新しました']);
        } elseif ($method === 'DELETE') {
            // report_dateを取得（id=0の重複レコード対策）
            $reportDate = $_GET['report_date'] ?? null;

            // 権限チェック + 対象レコード特定
            if ($_SESSION['role'] === 'admin' || $_SESSION['role'] === 'master') {
                if ($reportDate) {
                    $report = $db->fetch("SELECT id, user_id FROM daily_reports WHERE id = ? AND report_date = ? LIMIT 1", [$id, $reportDate]);
                } else {
                    $report = $db->fetch("SELECT id, user_id FROM daily_reports WHERE id = ? LIMIT 1", [$id]);
                }
            } else {
                if ($reportDate) {
                    $report = $db->fetch("SELECT id, user_id FROM daily_reports WHERE id = ? AND user_id = ? AND report_date = ? LIMIT 1", [$id, $_SESSION['user_id'], $reportDate]);
                } else {
                    $report = $db->fetch("SELECT id, user_id FROM daily_reports WHERE id = ? AND user_id = ? LIMIT 1", [$id, $_SESSION['user_id']]);
                }
            }
            if (!$report) {
                error('日報が見つかりません', 404);
            }

            // 関連データ削除
            $db->delete("DELETE FROM daily_report_details WHERE report_id = ?", [$id]);
            $db->delete("DELETE FROM daily_report_hours WHERE report_id = ?", [$id]);
            // メインレコードはreport_dateで1件だけ削除
            if ($reportDate) {
                $db->delete("DELETE FROM daily_reports WHERE id = ? AND user_id = ? AND report_date = ? LIMIT 1", [$id, $report['user_id'], $reportDate]);
            } else {
                $db->delete("DELETE FROM daily_reports WHERE id = ? AND user_id = ? LIMIT 1", [$id, $report['user_id']]);
            }
            respond(['message' => '日報を削除しました']);
        }
        break;

    case 'daily-report-hours':
        checkAdmin();
        $id = $_GET['id'] ?? 0;

        if ($method === 'PUT') {
            $regularHours = $input['regularHours'] ?? 0;
            $nightHours = $input['nightHours'] ?? 0;
            $constructionPoints = $input['constructionPoints'] ?? 0;
            $otherHours = $input['otherHours'] ?? 0;

            // UPSERT
            $db->query(
                "INSERT INTO daily_report_hours (report_id, regular_hours, night_hours, construction_points, other_hours)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE regular_hours = VALUES(regular_hours), night_hours = VALUES(night_hours),
                 construction_points = VALUES(construction_points), other_hours = VALUES(other_hours)",
                [$id, $regularHours, $nightHours, $constructionPoints, $otherHours]
            );

            respond(['message' => '時間集計を更新しました']);
        }
        break;

    case 'daily-reports-export':
        checkAdmin();

        $yearMonth = $_GET['year_month'] ?? date('Y-m');
        $userId = $_GET['user_id'] ?? null;

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="daily_reports_' . $yearMonth . '.csv"');
        echo "\xEF\xBB\xBF";

        $output = fopen('php://output', 'w');
        fputcsv($output, ['日付', '氏名', '開始時刻', '終了時刻', '現場名', '人数', '同行者', '車両', '経費', '連絡事項', '備考', '時間', '夜勤時間', '工事P', 'その他']);

        $sql = "SELECT dr.id, dr.user_id, dr.report_date, dr.vehicle, dr.expenses,
                dr.contact_notes, dr.remarks, dr.status, dr.created_at, dr.updated_at,
                u.name as user_name
                FROM daily_reports dr
                JOIN users u ON dr.user_id = u.id
                WHERE DATE_FORMAT(dr.report_date, '%Y-%m') = ?";
        $params = [$yearMonth];
        if ($userId) {
            $sql .= " AND dr.user_id = ?";
            $params[] = $userId;
        }
        $sql .= " ORDER BY dr.report_date, u.name";

        $reports = $db->fetchAll($sql, $params);

        foreach ($reports as $report) {
            $hours = $db->fetch(
                "SELECT regular_hours, night_hours, construction_points, other_hours FROM daily_report_hours WHERE report_id = ?",
                [$report['id']]
            );
            $report['regular_hours'] = $hours['regular_hours'] ?? null;
            $report['night_hours'] = $hours['night_hours'] ?? null;
            $report['construction_points'] = $hours['construction_points'] ?? null;
            $report['other_hours'] = $hours['other_hours'] ?? null;

            $details = $db->fetchAll(
                "SELECT * FROM daily_report_details WHERE report_id = ? ORDER BY sort_order",
                [$report['id']]
            );

            if (empty($details)) {
                fputcsv($output, [
                    $report['report_date'], $report['user_name'], '', '', '', '', '',
                    $report['vehicle'], $report['expenses'], $report['contact_notes'], $report['remarks'],
                    $report['regular_hours'], $report['night_hours'], $report['construction_points'], $report['other_hours']
                ]);
            } else {
                foreach ($details as $i => $detail) {
                    fputcsv($output, [
                        $i === 0 ? $report['report_date'] : '',
                        $i === 0 ? $report['user_name'] : '',
                        $detail['start_time'], $detail['end_time'], $detail['site_name'], $detail['worker_count'], $detail['companions'],
                        $i === 0 ? $report['vehicle'] : '',
                        $i === 0 ? $report['expenses'] : '',
                        $i === 0 ? $report['contact_notes'] : '',
                        $i === 0 ? $report['remarks'] : '',
                        $i === 0 ? $report['regular_hours'] : '',
                        $i === 0 ? $report['night_hours'] : '',
                        $i === 0 ? $report['construction_points'] : '',
                        $i === 0 ? $report['other_hours'] : ''
                    ]);
                }
            }
        }

        fclose($output);
        exit;

    // ========== タイムカード管理 ==========
    case 'timecards':
        checkAuth();

        if ($method === 'GET') {
            $yearMonth = $_GET['year_month'] ?? date('Y-m');
            $userId = $_GET['user_id'] ?? null;

            $sql = "SELECT t.*, u.name as user_name
                    FROM timecards t
                    JOIN users u ON t.user_id = u.id
                    WHERE DATE_FORMAT(t.work_date, '%Y-%m') = ?";
            $params = [$yearMonth];

            if ($_SESSION['role'] !== 'admin' && $_SESSION['role'] !== 'master') {
                $sql .= " AND t.user_id = ?";
                $params[] = $_SESSION['user_id'];
            } elseif ($userId) {
                $sql .= " AND t.user_id = ?";
                $params[] = $userId;
            }

            $sql .= " ORDER BY t.work_date DESC, u.name";
            $timecards = $db->fetchAll($sql, $params);

            respond($timecards);
        }
        break;

    case 'timecard-clock-in':
        checkAuth();

        if ($method === 'POST') {
            $workDate = date('Y-m-d');
            $clockIn = date('H:i:s');
            $clockInType = 'auto';

            // 既存チェック
            $existing = $db->fetch(
                "SELECT id, clock_in FROM timecards WHERE user_id = ? AND work_date = ?",
                [$_SESSION['user_id'], $workDate]
            );

            if ($existing && $existing['clock_in']) {
                error('既に出勤打刻済みです');
            }

            if ($existing) {
                $db->update(
                    "UPDATE timecards SET clock_in = ?, clock_in_type = ? WHERE id = ?",
                    [$clockIn, $clockInType, $existing['id']]
                );
            } else {
                $db->insert(
                    "INSERT INTO timecards (user_id, work_date, clock_in, clock_in_type) VALUES (?, ?, ?, ?)",
                    [$_SESSION['user_id'], $workDate, $clockIn, $clockInType]
                );
            }

            respond(['message' => '出勤を記録しました', 'time' => $clockIn]);
        }
        break;

    case 'timecard-clock-out':
        checkAuth();

        if ($method === 'POST') {
            $workDate = date('Y-m-d');
            $clockOut = date('H:i:s');
            $clockOutType = 'auto';

            // まず当日のレコードを検索
            $existing = $db->fetch(
                "SELECT id, clock_in, clock_out, work_date FROM timecards WHERE user_id = ? AND work_date = ?",
                [$_SESSION['user_id'], $workDate]
            );

            // 当日に有効な出勤レコードがない場合、直近の未退勤レコードを検索（夜勤・日付跨ぎ対応）
            if (!$existing || !$existing['clock_in'] || $existing['clock_out']) {
                $recentUnclosed = $db->fetch(
                    "SELECT id, clock_in, clock_out, work_date FROM timecards
                     WHERE user_id = ? AND work_date >= ? AND work_date < ?
                     AND clock_in IS NOT NULL AND clock_out IS NULL
                     ORDER BY work_date DESC LIMIT 1",
                    [$_SESSION['user_id'],
                     date('Y-m-d', strtotime('-2 days')),
                     $workDate]
                );

                if ($recentUnclosed) {
                    $clockInDateTime = strtotime($recentUnclosed['work_date'] . ' ' . $recentUnclosed['clock_in']);
                    $nowDateTime = strtotime($workDate . ' ' . $clockOut);

                    if (($nowDateTime - $clockInDateTime) <= 36 * 3600) {
                        $existing = $recentUnclosed;
                    }
                }
            }

            if (!$existing || !$existing['clock_in']) {
                error('先に出勤打刻をしてください');
            }

            if ($existing['clock_out']) {
                error('既に退勤打刻済みです');
            }

            $db->update(
                "UPDATE timecards SET clock_out = ?, clock_out_type = ? WHERE id = ?",
                [$clockOut, $clockOutType, $existing['id']]
            );

            respond([
                'message' => '退勤を記録しました',
                'time' => $clockOut,
                'work_date' => $existing['work_date'],
                'is_overnight' => ($existing['work_date'] !== $workDate)
            ]);
        }
        break;

    case 'timecard':
        checkAuth();
        $id = (int)($_GET['id'] ?? 0);

        if ($method === 'GET') {
            // 今日のタイムカード取得（クライアントの日付を優先）
            $workDate = $_GET['date'] ?? date('Y-m-d');
            $timecard = $db->fetch(
                "SELECT * FROM timecards WHERE user_id = ? AND work_date = ?",
                [$_SESSION['user_id'], $workDate]
            );

            // 今日のレコードがあり、出勤済み＆未退勤ならそのまま返す
            if ($timecard && $timecard['clock_in'] && !$timecard['clock_out']) {
                $timecard['is_overnight'] = false;
                respond($timecard);
            }

            // 今日のレコードがない or 未出勤 or 既に退勤済みの場合、
            // 前日・前々日の未退勤レコードを確認（夜勤・日付跨ぎ対応）
            if (!$timecard || !$timecard['clock_in'] || $timecard['clock_out']) {
                $recentUnclosed = $db->fetch(
                    "SELECT * FROM timecards
                     WHERE user_id = ? AND work_date >= ? AND work_date < ?
                     AND clock_in IS NOT NULL AND clock_out IS NULL
                     ORDER BY work_date DESC LIMIT 1",
                    [$_SESSION['user_id'],
                     date('Y-m-d', strtotime('-2 days', strtotime($workDate))),
                     $workDate]
                );

                if ($recentUnclosed) {
                    $clockInDateTime = strtotime($recentUnclosed['work_date'] . ' ' . $recentUnclosed['clock_in']);
                    $now = time();
                    if (($now - $clockInDateTime) <= 36 * 3600) {
                        $recentUnclosed['is_overnight'] = true;
                        respond($recentUnclosed);
                    }
                }
            }

            if ($timecard) {
                $timecard['is_overnight'] = false;
            }
            respond($timecard ?: ['clock_in' => null, 'clock_out' => null, 'is_overnight' => false]);
        } elseif ($method === 'PUT') {
            // 管理者のみ編集可能
            checkAdmin();
            if ($id <= 0) {
                error('Invalid timecard ID', 400);
            }
            $timecard = $db->fetch("SELECT user_id FROM timecards WHERE id = ?", [$id]);
            if (!$timecard) {
                error('タイムカードが見つかりません', 404);
            }

            $clockIn = $input['clockIn'] ?? null;
            $clockOut = $input['clockOut'] ?? null;
            $memo = $input['memo'] ?? '';

            $db->update(
                "UPDATE timecards SET clock_in = ?, clock_out = ?, clock_in_type = 'manual', clock_out_type = 'manual', memo = ? WHERE id = ?",
                [$clockIn, $clockOut, $memo, $id]
            );

            respond(['message' => 'タイムカードを更新しました']);
        } elseif ($method === 'DELETE') {
            // 管理者のみ削除可能
            checkAdmin();
            $timecard = $db->fetch("SELECT user_id, work_date FROM timecards WHERE id = ?", [$id]);
            if (!$timecard) {
                error('タイムカードが見つかりません', 404);
            }

            // 労働基準法: タイムカードは5年間保存義務
            $workDate = new DateTime($timecard['work_date']);
            $fiveYearsAgo = new DateTime();
            $fiveYearsAgo->modify('-5 years');
            if ($workDate > $fiveYearsAgo) {
                error('労働基準法により、タイムカードは5年間保存が必要です。削除できません。', 403);
            }

            $db->delete("DELETE FROM timecards WHERE id = ?", [$id]);
            respond(['message' => 'タイムカードを削除しました']);
        }
        break;

    // ========== タイムカード修正申請 ==========
    case 'time-correction-requests':
        checkAuth();

        if ($method === 'GET') {
            if ($_SESSION['role'] === 'admin' || $_SESSION['role'] === 'master') {
                $status = $_GET['status'] ?? null;
                $sql = "SELECT tcr.*, u.name as user_name
                        FROM time_correction_requests tcr
                        JOIN users u ON tcr.user_id = u.id";
                $params = [];
                if ($status) {
                    $sql .= " WHERE tcr.status = ?";
                    $params[] = $status;
                }
                $sql .= " ORDER BY tcr.created_at DESC";
                $requests = $db->fetchAll($sql, $params);
            } else {
                $sql = "SELECT tcr.*, u.name as user_name
                        FROM time_correction_requests tcr
                        JOIN users u ON tcr.user_id = u.id
                        WHERE tcr.user_id = ?
                        ORDER BY tcr.created_at DESC";
                $requests = $db->fetchAll($sql, [$_SESSION['user_id']]);
            }
            respond($requests);
        } elseif ($method === 'POST') {
            $workDate = $input['work_date'] ?? '';
            $clockIn = $input['clock_in'] ?? null;
            $clockOut = $input['clock_out'] ?? null;
            $reason = $input['reason'] ?? '';

            if (empty($workDate)) error('日付は必須です');
            if (empty($clockIn) && empty($clockOut)) error('出勤または退勤時刻を入力してください');
            if (empty($reason)) error('理由は必須です');

            // 重複チェック
            $existing = $db->fetch(
                "SELECT id FROM time_correction_requests WHERE user_id = ? AND work_date = ? AND status = 'pending'",
                [$_SESSION['user_id'], $workDate]
            );
            if ($existing) {
                error('この日付の修正申請が既に申請中です');
            }

            $db->insert(
                "INSERT INTO time_correction_requests (user_id, work_date, requested_clock_in, requested_clock_out, reason) VALUES (?, ?, ?, ?, ?)",
                [$_SESSION['user_id'], $workDate, $clockIn, $clockOut, $reason]
            );

            respond(['message' => '修正申請を送信しました']);
        }
        break;

    case 'process-time-correction':
        checkAdmin();

        if ($method === 'POST') {
            $requestId = $input['id'] ?? 0;
            $action = $input['action'] ?? '';

            if (!in_array($action, ['approved', 'rejected'])) {
                error('無効なアクションです');
            }

            $request = $db->fetch(
                "SELECT * FROM time_correction_requests WHERE id = ? AND status = 'pending'",
                [$requestId]
            );
            if (!$request) {
                error('修正申請が見つかりません', 404);
            }

            // ステータス更新
            $db->update(
                "UPDATE time_correction_requests SET status = ?, processed_by = ?, processed_at = NOW() WHERE id = ?",
                [$action, $_SESSION['user_id'], $requestId]
            );

            // 承認の場合、タイムカードを更新
            if ($action === 'approved') {
                $existing = $db->fetch(
                    "SELECT id FROM timecards WHERE user_id = ? AND work_date = ?",
                    [$request['user_id'], $request['work_date']]
                );

                if ($existing) {
                    $updates = [];
                    $params = [];
                    if ($request['requested_clock_in']) {
                        $updates[] = "clock_in = ?";
                        $updates[] = "clock_in_type = 'manual'";
                        $params[] = $request['requested_clock_in'];
                    }
                    if ($request['requested_clock_out']) {
                        $updates[] = "clock_out = ?";
                        $updates[] = "clock_out_type = 'manual'";
                        $params[] = $request['requested_clock_out'];
                    }
                    if (!empty($updates)) {
                        $params[] = $existing['id'];
                        $db->update(
                            "UPDATE timecards SET " . implode(', ', $updates) . " WHERE id = ?",
                            $params
                        );
                    }
                } else {
                    $db->insert(
                        "INSERT INTO timecards (user_id, work_date, clock_in, clock_in_type, clock_out, clock_out_type) VALUES (?, ?, ?, 'manual', ?, 'manual')",
                        [$request['user_id'], $request['work_date'], $request['requested_clock_in'], $request['requested_clock_out']]
                    );
                }
            }

            $msg = $action === 'approved' ? '承認しました' : '却下しました';
            respond(['message' => $msg]);
        }
        break;

    case 'timecards-export':
        checkAdmin();

        $yearMonth = $_GET['year_month'] ?? date('Y-m');
        $userId = $_GET['user_id'] ?? null;

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="timecards_' . $yearMonth . '.csv"');
        echo "\xEF\xBB\xBF";

        $output = fopen('php://output', 'w');
        fputcsv($output, ['日付', '氏名', '出勤', '退勤', '勤務時間', 'メモ']);

        $sql = "SELECT t.*, u.name as user_name
                FROM timecards t
                JOIN users u ON t.user_id = u.id
                WHERE DATE_FORMAT(t.work_date, '%Y-%m') = ?";
        $params = [$yearMonth];
        if ($userId) {
            $sql .= " AND t.user_id = ?";
            $params[] = $userId;
        }
        $sql .= " ORDER BY t.work_date, u.name";

        $timecards = $db->fetchAll($sql, $params);

        foreach ($timecards as $tc) {
            $workHours = '';
            if ($tc['clock_in'] && $tc['clock_out']) {
                $in = strtotime($tc['clock_in']);
                $out = strtotime($tc['clock_out']);

                // 日付をまたぐ場合（退勤時刻が出勤時刻より前）
                if ($out < $in) {
                    $out += 36 * 3600; // 24時間を加算
                }

                $diff = ($out - $in) / 3600;
                $workHours = round($diff, 2);
            }
            fputcsv($output, [
                $tc['work_date'], $tc['user_name'], $tc['clock_in'], $tc['clock_out'], $workHours, $tc['memo']
            ]);
        }

        fclose($output);
        exit;

    // ========== 日報PDF出力 ==========
    case 'daily-report-pdf':
        checkAdmin();
        $id = $_GET['id'] ?? 0;

        $report = $db->fetch(
            "SELECT dr.id, dr.user_id, dr.report_date, dr.vehicle, dr.expenses,
             dr.contact_notes, dr.remarks, dr.status, dr.created_at, dr.updated_at,
             u.name as user_name
             FROM daily_reports dr
             JOIN users u ON dr.user_id = u.id
             WHERE dr.id = ?",
            [$id]
        );

        if (!$report) {
            error('日報が見つかりません', 404);
        }

        $hours = $db->fetch(
            "SELECT regular_hours, night_hours, construction_points, other_hours FROM daily_report_hours WHERE report_id = ?",
            [$id]
        );
        $report['regular_hours'] = $hours['regular_hours'] ?? null;
        $report['night_hours'] = $hours['night_hours'] ?? null;
        $report['construction_points'] = $hours['construction_points'] ?? null;
        $report['other_hours'] = $hours['other_hours'] ?? null;

        $details = $db->fetchAll(
            "SELECT * FROM daily_report_details WHERE report_id = ? ORDER BY sort_order, start_time",
            [$id]
        );

        // 日付フォーマット
        $date = new DateTime($report['report_date']);
        $year = $date->format('Y');
        $month = $date->format('n');
        $day = $date->format('j');

        // HTML出力（印刷用）
        header('Content-Type: text/html; charset=utf-8');
        ?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>作業・営業日報 - <?= htmlspecialchars($report['user_name']) ?> <?= $report['report_date'] ?></title>
    <style>
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
            @page { margin: 10mm; }
        }
        body {
            font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
            font-size: 14px;
            line-height: 1.4;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
        }
        h1 {
            text-align: center;
            font-size: 20px;
            margin-bottom: 20px;
            letter-spacing: 0.5em;
        }
        .header-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
            align-items: baseline;
        }
        .header-row .name {
            font-size: 16px;
        }
        .header-row .name span {
            border-bottom: 1px solid #000;
            padding: 0 30px;
            margin-left: 10px;
        }
        .header-row .date {
            font-size: 16px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        th, td {
            border: 1px solid #000;
            padding: 8px;
            text-align: center;
        }
        th {
            background: #f5f5f5;
            font-weight: normal;
        }
        .work-table th:nth-child(1) { width: 25%; }
        .work-table th:nth-child(2) { width: 45%; }
        .work-table th:nth-child(3) { width: 10%; }
        .work-table th:nth-child(4) { width: 20%; }
        .work-table td { height: 30px; }
        .time-cell { font-size: 13px; }
        .hours-table th { width: 25%; }
        .hours-table td { height: 35px; }
        .notes-section {
            margin-bottom: 15px;
        }
        .notes-section .label {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .notes-section .content {
            border: 1px solid #000;
            min-height: 80px;
            padding: 8px;
            white-space: pre-wrap;
        }
        .bottom-section {
            display: flex;
            gap: 20px;
        }
        .bottom-section > div {
            flex: 1;
        }
        .bottom-section .label {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .bottom-section .content {
            border: 1px solid #000;
            min-height: 60px;
            padding: 8px;
        }
        .vehicle-expenses {
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
        }
        .vehicle-expenses > div {
            flex: 1;
        }
        .vehicle-expenses .label {
            display: inline-block;
            margin-right: 10px;
        }
        .vehicle-expenses .value {
            border-bottom: 1px solid #000;
            padding: 0 20px;
        }
        .print-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        }
        .print-btn:hover {
            background: #0056b3;
        }
    </style>
</head>
<body>
    <button class="print-btn no-print" onclick="window.print()">印刷 / PDF保存</button>

    <h1>作業・営業日報</h1>

    <div class="header-row">
        <div class="name">氏名<span><?= htmlspecialchars($report['user_name']) ?></span></div>
        <div class="date"><?= $year ?>年<?= $month ?>月<?= $day ?>日</div>
    </div>

    <table class="work-table">
        <thead>
            <tr>
                <th>作業時間</th>
                <th>現場名</th>
                <th>人数</th>
                <th>同行者</th>
            </tr>
        </thead>
        <tbody>
            <?php $rowCount = max(10, count($details)); ?>
            <?php for ($i = 0; $i < $rowCount; $i++): ?>
            <?php $d = $details[$i] ?? null; ?>
            <tr>
                <td class="time-cell">
                    <?php if ($d && ($d['start_time'] || $d['end_time'])): ?>
                        <?= $d['start_time'] ? substr($d['start_time'], 0, 5) : '' ?> ～ <?= $d['end_time'] ? substr($d['end_time'], 0, 5) : '' ?>
                    <?php endif; ?>
                </td>
                <td><?= $d ? htmlspecialchars($d['site_name']) : '' ?></td>
                <td><?= $d && $d['worker_count'] ? $d['worker_count'] : '' ?></td>
                <td><?= $d ? htmlspecialchars($d['companions']) : '' ?></td>
            </tr>
            <?php endfor; ?>
        </tbody>
    </table>

    <table class="hours-table">
        <thead>
            <tr>
                <th>時間</th>
                <th>夜勤時間</th>
                <th>工事P</th>
                <th>その他</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><?= $report['regular_hours'] ?: '' ?></td>
                <td><?= $report['night_hours'] ?: '' ?></td>
                <td><?= $report['construction_points'] ?: '' ?></td>
                <td><?= $report['other_hours'] ?: '' ?></td>
            </tr>
        </tbody>
    </table>

    <div class="notes-section">
        <div class="label">連絡・報告事項</div>
        <div class="content"><?= htmlspecialchars($report['contact_notes'] ?? '') ?></div>
    </div>

    <div class="vehicle-expenses">
        <div>
            <span class="label">車両</span>
            <span class="value"><?= htmlspecialchars($report['vehicle'] ?? '') ?></span>
        </div>
        <div>
            <span class="label">使用経費</span>
            <span class="value"><?= $report['expenses'] ? number_format($report['expenses']) . '円' : '' ?></span>
        </div>
    </div>

    <div class="notes-section">
        <div class="label">備考</div>
        <div class="content"><?= htmlspecialchars($report['remarks'] ?? '') ?></div>
    </div>

    <script>
        // 印刷ダイアログを自動表示（オプション）
        // window.onload = function() { window.print(); }
    </script>
</body>
</html>
        <?php
        exit;

    // ========== 車両マスター ==========
    case 'vehicles':
        checkAuth();

        if ($method === 'GET') {
            $vehicles = $db->fetchAll("SELECT * FROM master_vehicles WHERE is_active = 1 ORDER BY name");
            respond($vehicles);
        } elseif ($method === 'POST') {
            checkAdmin();
            $name = $input['name'] ?? '';
            if (empty($name)) error('車両名は必須です');

            $db->insert("INSERT IGNORE INTO master_vehicles (name) VALUES (?)", [$name]);
            respond(['message' => '車両を追加しました']);
        }
        break;

    case 'vehicle':
        checkAdmin();
        $id = $_GET['id'] ?? 0;

        if ($method === 'DELETE') {
            $db->update("UPDATE master_vehicles SET is_active = 0 WHERE id = ?", [$id]);
            respond(['message' => '車両を削除しました']);
        }
        break;

    // ========== 監査ログ（管理者以上） ==========
    case 'audit-logs':
        checkAdmin(); // 管理者とmasterの両方がアクセス可能

        if ($method === 'GET') {
            // テーブルが存在しない場合は作成
            try {
                $db->query("CREATE TABLE IF NOT EXISTS audit_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    user_name VARCHAR(100) NOT NULL,
                    action VARCHAR(50) NOT NULL,
                    target_type VARCHAR(50) NOT NULL,
                    target_id INT,
                    target_name VARCHAR(255),
                    details TEXT,
                    ip_address VARCHAR(45),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_id (user_id),
                    INDEX idx_target (target_type, target_id),
                    INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            } catch (Exception $e) {
                // テーブルが既に存在する場合は無視
            }

            $limit = (int)($_GET['limit'] ?? 100);
            $offset = (int)($_GET['offset'] ?? 0);
            $userId = $_GET['user_id'] ?? null;
            $targetType = $_GET['target_type'] ?? null;
            $dateFrom = $_GET['date_from'] ?? null;
            $dateTo = $_GET['date_to'] ?? null;

            $sql = "SELECT * FROM audit_logs WHERE 1=1";
            $params = [];

            if ($userId) {
                $sql .= " AND user_id = ?";
                $params[] = $userId;
            }
            if ($targetType) {
                $sql .= " AND target_type = ?";
                $params[] = $targetType;
            }
            if ($dateFrom) {
                $sql .= " AND DATE(created_at) >= ?";
                $params[] = $dateFrom;
            }
            if ($dateTo) {
                $sql .= " AND DATE(created_at) <= ?";
                $params[] = $dateTo;
            }

            // 管理者の場合、masterの操作履歴を除外（masterのみ全ての履歴を閲覧可能）
            if ($_SESSION['role'] !== 'master') {
                $sql .= " AND user_id NOT IN (SELECT id FROM users WHERE role = 'master')";
            }

            $sql .= " ORDER BY created_at DESC LIMIT ? OFFSET ?";
            $params[] = $limit;
            $params[] = $offset;

            $logs = $db->fetchAll($sql, $params);

            // 日本語変換
            $actionLabels = ['create' => '作成', 'update' => '更新', 'delete' => '削除'];
            $typeLabels = ['user' => 'ユーザー', 'corporation' => '法人', 'site' => '現場'];

            foreach ($logs as &$log) {
                $log['actionLabel'] = $actionLabels[$log['action']] ?? $log['action'];
                $log['targetTypeLabel'] = $typeLabels[$log['target_type']] ?? $log['target_type'];
                $log['details'] = $log['details'] ? json_decode($log['details'], true) : null;
            }

            respond($logs);
        }
        break;

    case 'timecard-request':
        checkAuth();
        if ($method === 'POST') {
            // タイムカード修正申請を作成
            $workDate = $input['work_date'] ?? null;
            $clockIn = $input['clock_in'] ?? null;
            $clockOut = $input['clock_out'] ?? null;
            $reason = $input['reason'] ?? '';

            if (!$workDate) {
                error('日付を指定してください');
            }

            $db->insert(
                "INSERT INTO timecard_requests (user_id, work_date, clock_in, clock_out, reason, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', NOW())",
                [$_SESSION['user_id'], $workDate, $clockIn, $clockOut, $reason]
            );

            respond(['message' => '修正申請を送信しました']);
        } elseif ($method === 'GET') {
            // 自分の申請一覧を取得
            $requests = $db->fetchAll(
                "SELECT tr.*, u.name as user_name FROM timecard_requests tr
                 JOIN users u ON tr.user_id = u.id
                 WHERE tr.user_id = ?
                 ORDER BY tr.created_at DESC",
                [$_SESSION['user_id']]
            );
            respond($requests);
        }
        break;

    case 'timecard-requests':
        checkAdmin();
        if ($method === 'GET') {
            // 全申請一覧を取得（管理者用）
            $status = $_GET['status'] ?? null;
            $sql = "SELECT tr.*, u.name as user_name FROM timecard_requests tr
                    JOIN users u ON tr.user_id = u.id";
            $params = [];

            if ($status) {
                $sql .= " WHERE tr.status = ?";
                $params[] = $status;
            }

            $sql .= " ORDER BY tr.created_at DESC";
            $requests = $db->fetchAll($sql, $params);
            respond($requests);
        }
        break;

    case 'timecard-request-approve':
        checkAdmin();
        if ($method === 'POST') {
            $id = (int)($input['id'] ?? 0);
            if ($id <= 0) {
                error('Invalid request ID');
            }

            $request = $db->fetch("SELECT * FROM timecard_requests WHERE id = ?", [$id]);
            if (!$request) {
                error('申請が見つかりません', 404);
            }

            if ($request['status'] !== 'pending') {
                error('この申請は既に処理済みです');
            }

            try {
                // 申請を承認（processed_byカラムがない場合のフォールバック）
                try {
                    $db->update(
                        "UPDATE timecard_requests SET status = 'approved', processed_by = ?, processed_at = NOW() WHERE id = ?",
                        [$_SESSION['user_id'], $id]
                    );
                } catch (Exception $e) {
                    $db->update(
                        "UPDATE timecard_requests SET status = 'approved' WHERE id = ?",
                        [$id]
                    );
                }

                // タイムカードを更新または作成
                $existing = $db->fetch(
                    "SELECT id FROM timecards WHERE user_id = ? AND work_date = ?",
                    [$request['user_id'], $request['work_date']]
                );

                // clock_in_typeカラムの存在チェック
                $hasTypeColumn = false;
                try {
                    $cols = $db->fetchAll("SHOW COLUMNS FROM timecards LIKE 'clock_in_type'");
                    $hasTypeColumn = !empty($cols);
                } catch (Exception $e) {}

                if ($existing) {
                    if ($hasTypeColumn) {
                        $db->update(
                            "UPDATE timecards SET clock_in = ?, clock_out = ?, clock_in_type = 'corrected', clock_out_type = 'corrected' WHERE id = ?",
                            [$request['clock_in'], $request['clock_out'], $existing['id']]
                        );
                    } else {
                        $db->update(
                            "UPDATE timecards SET clock_in = ?, clock_out = ? WHERE id = ?",
                            [$request['clock_in'], $request['clock_out'], $existing['id']]
                        );
                    }
                } else {
                    if ($hasTypeColumn) {
                        $db->insert(
                            "INSERT INTO timecards (user_id, work_date, clock_in, clock_out, clock_in_type, clock_out_type) VALUES (?, ?, ?, ?, 'corrected', 'corrected')",
                            [$request['user_id'], $request['work_date'], $request['clock_in'], $request['clock_out']]
                        );
                    } else {
                        $db->insert(
                            "INSERT INTO timecards (user_id, work_date, clock_in, clock_out) VALUES (?, ?, ?, ?)",
                            [$request['user_id'], $request['work_date'], $request['clock_in'], $request['clock_out']]
                        );
                    }
                }

                respond(['message' => '申請を承認しました']);
            } catch (Exception $e) {
                // 承認ステータスをロールバック
                try {
                    $db->update(
                        "UPDATE timecard_requests SET status = 'pending' WHERE id = ?",
                        [$id]
                    );
                } catch (Exception $e2) {}
                error('承認処理中にエラーが発生しました: ' . $e->getMessage());
            }
        }
        break;

    case 'timecard-request-reject':
        checkAdmin();
        if ($method === 'POST') {
            $id = (int)($input['id'] ?? 0);
            $comment = $input['comment'] ?? '';

            if ($id <= 0) {
                error('Invalid request ID');
            }

            $request = $db->fetch("SELECT * FROM timecard_requests WHERE id = ?", [$id]);
            if (!$request) {
                error('申請が見つかりません', 404);
            }

            if ($request['status'] !== 'pending') {
                error('この申請は既に処理済みです');
            }

            try {
                $db->update(
                    "UPDATE timecard_requests SET status = 'rejected', reject_comment = ?, processed_by = ?, processed_at = NOW() WHERE id = ?",
                    [$comment, $_SESSION['user_id'], $id]
                );
            } catch (Exception $e) {
                try {
                    $db->update(
                        "UPDATE timecard_requests SET status = 'rejected', processed_by = ?, processed_at = NOW() WHERE id = ?",
                        [$_SESSION['user_id'], $id]
                    );
                } catch (Exception $e2) {
                    $db->update(
                        "UPDATE timecard_requests SET status = 'rejected' WHERE id = ?",
                        [$id]
                    );
                }
            }

            respond(['message' => '申請を却下しました']);
        }
        break;

    case 'timecard-requests-count':
        checkAdmin();
        if ($method === 'GET') {
            $count = $db->fetch(
                "SELECT COUNT(*) as count FROM timecard_requests WHERE status = 'pending'"
            );
            respond(['count' => (int)$count['count']]);
        }
        break;

    // ========== 在庫管理 ==========
    case 'inventory-branches':
        checkAuth();

        if ($method === 'GET') {
            $branches = $db->fetchAll("SELECT * FROM inventory_branches WHERE is_active = 1 ORDER BY id");
            respond($branches);
        }
        break;

    case 'inventory-categories':
        checkAuth();

        if ($method === 'GET') {
            $categories = $db->fetchAll("SELECT * FROM inventory_categories WHERE is_active = 1 ORDER BY sort_order");
            respond($categories);
        }
        break;

    case 'inventory-products':
        checkAuth();

        if ($method === 'GET') {
            $categoryId = $_GET['category_id'] ?? null;
            $sql = "SELECT p.*, c.name as category_name FROM inventory_products p
                    JOIN inventory_categories c ON p.category_id = c.id
                    WHERE p.is_active = 1";
            $params = [];
            if ($categoryId) {
                $sql .= " AND p.category_id = ?";
                $params[] = $categoryId;
            }
            $sql .= " ORDER BY c.sort_order, p.id";
            $products = $db->fetchAll($sql, $params);
            respond($products);
        }
        break;

    case 'inventory-product-update':
        checkAuth();

        if ($method === 'POST') {
            $productId = (int)($input['productId'] ?? 0);
            $alertThreshold = isset($input['alertThreshold']) ? (int)$input['alertThreshold'] : null;
            $name = isset($input['name']) ? trim($input['name']) : null;

            if ($productId <= 0) {
                error('製品IDを指定してください');
            }

            if ($alertThreshold !== null) {
                $db->query(
                    "UPDATE inventory_products SET alert_threshold = ? WHERE id = ?",
                    [$alertThreshold, $productId]
                );
            }

            if ($name !== null && $name !== '') {
                $db->query(
                    "UPDATE inventory_products SET name = ? WHERE id = ?",
                    [$name, $productId]
                );
            }

            respond(['message' => '製品設定を更新しました']);
        }
        break;

    case 'inventory-stock':
        checkAuth();

        if ($method === 'GET') {
            $branchId = $_GET['branch_id'] ?? null;
            $categoryId = $_GET['category_id'] ?? null;

            $sql = "SELECT s.id, s.branch_id, s.product_id, s.quantity,
                           b.name as branch_name,
                           p.name as product_name, p.unit, p.alert_threshold as min_stock,
                           c.id as category_id, c.name as category_name
                    FROM inventory_stocks s
                    JOIN inventory_branches b ON s.branch_id = b.id
                    JOIN inventory_products p ON s.product_id = p.id
                    JOIN inventory_categories c ON p.category_id = c.id
                    WHERE b.is_active = 1 AND p.is_active = 1";
            $params = [];

            if ($branchId) {
                $sql .= " AND s.branch_id = ?";
                $params[] = $branchId;
            }
            if ($categoryId) {
                $sql .= " AND p.category_id = ?";
                $params[] = $categoryId;
            }

            $sql .= " ORDER BY b.id, c.sort_order, p.id";
            $stock = $db->fetchAll($sql, $params);
            respond($stock);
        }
        break;

    case 'inventory-stock-update':
        checkAuth();

        if ($method === 'POST') {
            $branchId = (int)($input['branchId'] ?? 0);
            $productId = (int)($input['productId'] ?? 0);
            $type = $input['type'] ?? 'adjust';
            $quantity = (int)($input['quantity'] ?? 0);
            $note = $input['note'] ?? '';

            if ($branchId <= 0 || $productId <= 0) {
                error('営業所と製品を指定してください');
            }
            if ($quantity == 0 && $type !== 'adjust') {
                error('数量を入力してください');
            }

            // 現在の在庫を取得
            $current = $db->fetch(
                "SELECT quantity FROM inventory_stocks WHERE branch_id = ? AND product_id = ?",
                [$branchId, $productId]
            );
            $currentQty = $current ? (int)$current['quantity'] : 0;

            // 新しい数量を計算
            if ($type === 'in') {
                $newQty = $currentQty + $quantity;
            } elseif ($type === 'out') {
                $newQty = $currentQty - $quantity;
                if ($newQty < 0) {
                    error('在庫が不足しています');
                }
            } elseif ($type === 'adjust') {
                $newQty = $quantity;
            } else {
                error('不正な操作タイプです');
            }

            // 在庫を更新（UPSERT）
            $db->query(
                "INSERT INTO inventory_stocks (branch_id, product_id, quantity) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)",
                [$branchId, $productId, $newQty]
            );

            // 履歴を記録
            $db->insert(
                "INSERT INTO inventory_logs (branch_id, product_id, transaction_type, quantity, quantity_before, quantity_after, note, user_id, user_name)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [$branchId, $productId, $type, $quantity, $currentQty, $newQty, $note, $_SESSION['user_id'], $_SESSION['name']]
            );

            respond(['message' => '在庫を更新しました', 'newQuantity' => $newQty]);
        }
        break;

    case 'inventory-transfer':
        checkAuth();

        if ($method === 'POST') {
            $fromBranchId = (int)($input['fromBranchId'] ?? 0);
            $toBranchId = (int)($input['toBranchId'] ?? 0);
            $productId = (int)($input['productId'] ?? 0);
            $quantity = (int)($input['quantity'] ?? 0);
            $note = $input['note'] ?? '';

            if ($fromBranchId <= 0 || $toBranchId <= 0 || $productId <= 0) {
                error('営業所と製品を指定してください');
            }
            if ($fromBranchId === $toBranchId) {
                error('同じ営業所への移動はできません');
            }
            if ($quantity <= 0) {
                error('数量を入力してください');
            }

            // 元の在庫を確認
            $fromStock = $db->fetch(
                "SELECT quantity FROM inventory_stocks WHERE branch_id = ? AND product_id = ?",
                [$fromBranchId, $productId]
            );
            $fromQty = $fromStock ? (int)$fromStock['quantity'] : 0;

            if ($fromQty < $quantity) {
                error('在庫が不足しています');
            }

            // 先の在庫を取得
            $toStock = $db->fetch(
                "SELECT quantity FROM inventory_stocks WHERE branch_id = ? AND product_id = ?",
                [$toBranchId, $productId]
            );
            $toQty = $toStock ? (int)$toStock['quantity'] : 0;

            // 元の在庫を減らす
            $db->update(
                "UPDATE inventory_stocks SET quantity = quantity - ? WHERE branch_id = ? AND product_id = ?",
                [$quantity, $fromBranchId, $productId]
            );

            // 先の在庫を増やす（UPSERT）
            $db->query(
                "INSERT INTO inventory_stocks (branch_id, product_id, quantity) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)",
                [$toBranchId, $productId, $quantity]
            );

            // 履歴を記録（出庫）
            $db->insert(
                "INSERT INTO inventory_logs (branch_id, product_id, transaction_type, quantity, quantity_before, quantity_after, related_branch_id, note, user_id, user_name)
                 VALUES (?, ?, 'transfer_out', ?, ?, ?, ?, ?, ?, ?)",
                [$fromBranchId, $productId, $quantity, $fromQty, $fromQty - $quantity, $toBranchId, $note, $_SESSION['user_id'], $_SESSION['name']]
            );

            // 履歴を記録（入庫）
            $db->insert(
                "INSERT INTO inventory_logs (branch_id, product_id, transaction_type, quantity, quantity_before, quantity_after, related_branch_id, note, user_id, user_name)
                 VALUES (?, ?, 'transfer_in', ?, ?, ?, ?, ?, ?, ?)",
                [$toBranchId, $productId, $quantity, $toQty, $toQty + $quantity, $fromBranchId, $note, $_SESSION['user_id'], $_SESSION['name']]
            );

            respond(['message' => '在庫を移動しました']);
        }
        break;

    case 'inventory-transactions':
        checkAuth();

        if ($method === 'GET') {
            $branchId = $_GET['branch_id'] ?? null;
            $productId = $_GET['product_id'] ?? null;
            $limit = (int)($_GET['limit'] ?? 100);

            $sql = "SELECT t.*, b.name as branch_name, p.name as product_name, p.unit,
                           rb.name as related_branch_name
                    FROM inventory_logs t
                    JOIN inventory_branches b ON t.branch_id = b.id
                    JOIN inventory_products p ON t.product_id = p.id
                    LEFT JOIN inventory_branches rb ON t.related_branch_id = rb.id
                    WHERE 1=1";
            $params = [];

            if ($branchId) {
                $sql .= " AND t.branch_id = ?";
                $params[] = $branchId;
            }
            if ($productId) {
                $sql .= " AND t.product_id = ?";
                $params[] = $productId;
            }

            $sql .= " ORDER BY t.created_at DESC LIMIT ?";
            $params[] = $limit;

            $transactions = $db->fetchAll($sql, $params);

            // 日本語ラベルを追加
            $typeLabels = [
                'in' => '入庫',
                'out' => '出庫',
                'adjust' => '調整',
                'transfer_in' => '移動入庫',
                'transfer_out' => '移動出庫'
            ];
            foreach ($transactions as &$t) {
                $t['typeLabel'] = $typeLabels[$t['transaction_type']] ?? $t['transaction_type'];
            }

            respond($transactions);
        }
        break;

    case 'inventory-summary':
        checkAuth();

        if ($method === 'GET') {
            // 全営業所の在庫サマリー
            $summary = $db->fetchAll(
                "SELECT p.id as product_id, c.name as category_name, p.name as product_name, p.unit,
                        SUM(COALESCE(s.quantity, 0)) as total_quantity, p.alert_threshold as min_stock
                 FROM inventory_products p
                 JOIN inventory_categories c ON p.category_id = c.id
                 LEFT JOIN inventory_stocks s ON s.product_id = p.id
                 WHERE p.is_active = 1
                 GROUP BY p.id, c.name, p.name, p.unit, p.alert_threshold
                 ORDER BY c.sort_order, p.id"
            );

            // 在庫不足アラート
            $lowStock = $db->fetchAll(
                "SELECT s.branch_id, b.name as branch_name, s.product_id, p.name as product_name,
                        s.quantity, p.alert_threshold as min_stock, p.unit
                 FROM inventory_stocks s
                 JOIN inventory_branches b ON s.branch_id = b.id
                 JOIN inventory_products p ON s.product_id = p.id
                 WHERE p.is_active = 1 AND b.is_active = 1 AND s.quantity <= p.alert_threshold AND p.alert_threshold > 0
                 ORDER BY b.id, p.id"
            );

            respond([
                'summary' => $summary,
                'lowStock' => $lowStock
            ]);
        }
        break;

    case 'inventory-product-create':
        checkAuth();

        if ($method === 'POST') {
            $name = trim($input['name'] ?? '');
            $unit = trim($input['unit'] ?? '個');
            $alertThreshold = isset($input['alertThreshold']) ? (int)$input['alertThreshold'] : 0;

            if (empty($name)) {
                error('製品名を入力してください');
            }

            // デフォルトカテゴリを取得（なければ作成）
            $defaultCategory = $db->fetch("SELECT id FROM inventory_categories WHERE is_active = 1 ORDER BY sort_order LIMIT 1");
            if (!$defaultCategory) {
                $categoryId = $db->insert("INSERT INTO inventory_categories (name, sort_order, is_active) VALUES ('一般', 1, 1)");
            } else {
                $categoryId = $defaultCategory['id'];
            }

            // 製品を追加
            $productId = $db->insert(
                "INSERT INTO inventory_products (name, category_id, unit, alert_threshold, is_active) VALUES (?, ?, ?, ?, 1)",
                [$name, $categoryId, $unit, $alertThreshold]
            );

            // 全営業所に初期在庫0で登録
            $branches = $db->fetchAll("SELECT id FROM inventory_branches WHERE is_active = 1");
            foreach ($branches as $branch) {
                $db->query(
                    "INSERT INTO inventory_stocks (branch_id, product_id, quantity) VALUES (?, ?, 0)",
                    [$branch['id'], $productId]
                );
            }

            respond(['id' => $productId, 'message' => '製品を追加しました']);
        }
        break;

    case 'inventory-product-delete':
        checkAuth();

        if ($method === 'DELETE') {
            $productId = (int)($_GET['id'] ?? 0);

            if ($productId <= 0) {
                error('製品IDを指定してください');
            }

            // 論理削除
            $db->query("UPDATE inventory_products SET is_active = 0 WHERE id = ?", [$productId]);

            respond(['message' => '製品を削除しました']);
        }
        break;

    case 'inventory-product-reorder':
        checkAuth();

        if ($method === 'POST') {
            $productIds = $input['productIds'] ?? [];

            if (empty($productIds) || !is_array($productIds)) {
                error('製品IDリストを指定してください');
            }

            // 並び順を更新
            foreach ($productIds as $index => $productId) {
                $db->query(
                    "UPDATE inventory_products SET sort_order = ? WHERE id = ?",
                    [$index, (int)$productId]
                );
            }

            respond(['message' => '並び順を更新しました']);
        }
        break;

    // ========== 月次締めレポート ==========
    case 'monthly-closing-report':
        checkAuth();

        if ($method === 'GET') {
            $userId = (int)($_GET['user_id'] ?? $_SESSION['user_id']);
            $year = (int)($_GET['year'] ?? date('Y'));
            $month = (int)($_GET['month'] ?? date('n'));

            // 管理者以外は自分のデータのみ
            if ($_SESSION['role'] !== 'admin' && $_SESSION['role'] !== 'master') {
                $userId = (int)$_SESSION['user_id'];
            }

            // 締め日計算（20日、土日祝の場合は前営業日）
            $closingDate = new DateTime("$year-$month-20");
            // 日本の祝日（簡易版）
            $holidays = [];
            // 土日の場合は前営業日に調整
            while (true) {
                $dow = (int)$closingDate->format('w'); // 0=日, 6=土
                $dateStr = $closingDate->format('Y-m-d');
                if ($dow === 0) { // 日曜
                    $closingDate->modify('-2 days');
                } elseif ($dow === 6) { // 土曜
                    $closingDate->modify('-1 day');
                } else {
                    break;
                }
            }

            // 期間：前月21日〜当月20日（締め日）
            $prevMonth = clone $closingDate;
            $prevMonth->modify('-1 month');
            // 開始日を前月21日に設定
            $startYear = $year;
            $startMonth = $month - 1;
            if ($startMonth <= 0) {
                $startMonth = 12;
                $startYear--;
            }
            $periodStart = "$startYear-" . str_pad($startMonth, 2, '0', STR_PAD_LEFT) . "-21";
            $periodEnd = $closingDate->format('Y-m-d');

            // ユーザー名取得
            $user = $db->fetch("SELECT name FROM users WHERE id = ?", [$userId]);
            $userName = $user ? $user['name'] : '不明';

            // 出勤日数（期間内のタイムカード数）
            $attendanceData = $db->fetch(
                "SELECT COUNT(*) as days FROM timecards WHERE user_id = ? AND work_date BETWEEN ? AND ? AND clock_in IS NOT NULL",
                [$userId, $periodStart, $periodEnd]
            );
            $attendanceDays = (int)($attendanceData['days'] ?? 0);

            // 日報の時間集計
            $hoursData = $db->fetch(
                "SELECT
                    COALESCE(SUM(drh.regular_hours), 0) as total_regular,
                    COALESCE(SUM(drh.night_hours), 0) as total_night,
                    COALESCE(SUM(drh.construction_points), 0) as total_construction,
                    COALESCE(SUM(drh.other_hours), 0) as total_other
                 FROM daily_reports dr
                 JOIN daily_report_hours drh ON dr.id = drh.report_id
                 WHERE dr.user_id = ? AND dr.report_date BETWEEN ? AND ?",
                [$userId, $periodStart, $periodEnd]
            );

            $overtimeHours = floatval($hoursData['total_regular'] ?? 0);
            $nightHours = floatval($hoursData['total_night'] ?? 0);
            $constructionPoints = floatval($hoursData['total_construction'] ?? 0);
            $otherHours = floatval($hoursData['total_other'] ?? 0);

            // 作業詳細（営業売上データとして利用）
            $details = $db->fetchAll(
                "SELECT dr.report_date, drd.start_time, drd.end_time, drd.site_name,
                        drd.worker_count, drd.companions, dr.contact_notes
                 FROM daily_reports dr
                 JOIN daily_report_details drd ON dr.id = drd.report_id
                 WHERE dr.user_id = ? AND dr.report_date BETWEEN ? AND ?
                 ORDER BY dr.report_date, drd.sort_order, drd.start_time",
                [$userId, $periodStart, $periodEnd]
            );

            // 報告連絡事項（期間内の全contact_notes）
            $notes = $db->fetchAll(
                "SELECT report_date, contact_notes, remarks FROM daily_reports
                 WHERE user_id = ? AND report_date BETWEEN ? AND ?
                   AND (contact_notes IS NOT NULL AND contact_notes != '' OR remarks IS NOT NULL AND remarks != '')
                 ORDER BY report_date",
                [$userId, $periodStart, $periodEnd]
            );

            // ユーザー一覧（管理者用）
            $users = [];
            if ($_SESSION['role'] === 'admin' || $_SESSION['role'] === 'master') {
                $users = $db->fetchAll("SELECT id, name FROM users WHERE is_active = 1 ORDER BY id");
            }

            respond([
                'userName' => $userName,
                'userId' => $userId,
                'periodStart' => $periodStart,
                'periodEnd' => $periodEnd,
                'closingDate' => $closingDate->format('Y-m-d'),
                'year' => $year,
                'month' => $month,
                'attendanceDays' => $attendanceDays,
                'overtimeHours' => $overtimeHours,
                'nightHours' => $nightHours,
                'constructionPoints' => $constructionPoints,
                'otherHours' => $otherHours,
                'details' => $details,
                'notes' => $notes,
                'users' => $users
            ]);
        }
        break;

    // ========== 月締め日報（スタッフ提出・管理者閲覧） ==========
    case 'monthly-closing-submit':
        checkAuth();

        // テーブル自動作成
        $db->query("CREATE TABLE IF NOT EXISTS monthly_closing_submissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            year INT NOT NULL,
            month INT NOT NULL,
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            attendance_days INT DEFAULT 0,
            overtime_hours DECIMAL(6,1) DEFAULT 0,
            night_hours DECIMAL(6,1) DEFAULT 0,
            construction_points DECIMAL(6,1) DEFAULT 0,
            sales_data JSON,
            status VARCHAR(20) DEFAULT 'submitted',
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            reviewed_by INT NULL,
            reviewed_at DATETIME NULL,
            UNIQUE KEY unique_user_month (user_id, year, month)
        )");

        if ($method === 'POST') {
            $userId = (int)$_SESSION['user_id'];
            $year = (int)($input['year'] ?? date('Y'));
            $month = (int)($input['month'] ?? date('n'));
            $periodStart = $input['periodStart'] ?? '';
            $periodEnd = $input['periodEnd'] ?? '';
            $attendanceDays = (int)($input['attendanceDays'] ?? 0);
            $overtimeHours = floatval($input['overtimeHours'] ?? 0);
            $nightHours = floatval($input['nightHours'] ?? 0);
            $constructionPoints = floatval($input['constructionPoints'] ?? 0);
            $salesData = json_encode($input['salesData'] ?? [], JSON_UNESCAPED_UNICODE);
            $status = $input['status'] ?? 'submitted'; // draft or submitted

            // 既存チェック
            $existing = $db->fetch(
                "SELECT id FROM monthly_closing_submissions WHERE user_id = ? AND year = ? AND month = ?",
                [$userId, $year, $month]
            );

            $statusLabel = $status === 'draft' ? '下書き保存' : '提出';

            if ($existing) {
                // 更新
                $db->query(
                    "UPDATE monthly_closing_submissions SET period_start = ?, period_end = ?, attendance_days = ?,
                     overtime_hours = ?, night_hours = ?, construction_points = ?, sales_data = ?,
                     status = ?, submitted_at = NOW() WHERE id = ?",
                    [$periodStart, $periodEnd, $attendanceDays, $overtimeHours, $nightHours, $constructionPoints, $salesData, $status, $existing['id']]
                );
                respond(['success' => true, 'id' => $existing['id'], 'message' => "月締め日報を{$statusLabel}しました"]);
            } else {
                // 新規
                $id = $db->insert(
                    "INSERT INTO monthly_closing_submissions (user_id, year, month, period_start, period_end, attendance_days, overtime_hours, night_hours, construction_points, sales_data, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [$userId, $year, $month, $periodStart, $periodEnd, $attendanceDays, $overtimeHours, $nightHours, $constructionPoints, $salesData, $status]
                );
                respond(['success' => true, 'id' => $id, 'message' => "月締め日報を{$statusLabel}しました"]);
            }
        }
        break;

    case 'monthly-closing-submissions':
        checkAuth();

        // テーブル自動作成
        $db->query("CREATE TABLE IF NOT EXISTS monthly_closing_submissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            year INT NOT NULL,
            month INT NOT NULL,
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            attendance_days INT DEFAULT 0,
            overtime_hours DECIMAL(6,1) DEFAULT 0,
            night_hours DECIMAL(6,1) DEFAULT 0,
            construction_points DECIMAL(6,1) DEFAULT 0,
            sales_data JSON,
            status VARCHAR(20) DEFAULT 'submitted',
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            reviewed_by INT NULL,
            reviewed_at DATETIME NULL,
            UNIQUE KEY unique_user_month (user_id, year, month)
        )");

        if ($method === 'GET') {
            $year = (int)($_GET['year'] ?? date('Y'));
            $month = (int)($_GET['month'] ?? date('n'));

            if ($_SESSION['role'] === 'admin' || $_SESSION['role'] === 'master') {
                // 管理者：全スタッフ分を取得
                $submissions = $db->fetchAll(
                    "SELECT mcs.*, u.name as user_name
                     FROM monthly_closing_submissions mcs
                     JOIN users u ON mcs.user_id = u.id
                     WHERE mcs.year = ? AND mcs.month = ?
                     ORDER BY mcs.submitted_at DESC",
                    [$year, $month]
                );
            } else {
                // スタッフ：自分のみ
                $submissions = $db->fetchAll(
                    "SELECT mcs.*, u.name as user_name
                     FROM monthly_closing_submissions mcs
                     JOIN users u ON mcs.user_id = u.id
                     WHERE mcs.user_id = ? AND mcs.year = ? AND mcs.month = ?",
                    [(int)$_SESSION['user_id'], $year, $month]
                );
            }

            // sales_dataをデコード
            foreach ($submissions as &$s) {
                $s['sales_data'] = json_decode($s['sales_data'], true) ?? [];
            }

            respond($submissions);
        }
        break;

    case 'monthly-closing-submission':
        checkAuth();

        $id = (int)($_GET['id'] ?? 0);

        if ($method === 'GET') {
            $sub = $db->fetch(
                "SELECT mcs.*, u.name as user_name
                 FROM monthly_closing_submissions mcs
                 JOIN users u ON mcs.user_id = u.id
                 WHERE mcs.id = ?",
                [$id]
            );
            if (!$sub) error('Not found', 404);

            // 管理者以外は自分のデータのみ
            if ($_SESSION['role'] !== 'admin' && $_SESSION['role'] !== 'master' && (int)$sub['user_id'] !== (int)$_SESSION['user_id']) {
                error('Forbidden', 403);
            }

            $sub['sales_data'] = json_decode($sub['sales_data'], true) ?? [];
            respond($sub);
        }

        if ($method === 'PUT') {
            // 管理者がステータスを更新（確認済みにする）
            if ($_SESSION['role'] !== 'admin' && $_SESSION['role'] !== 'master') {
                error('Forbidden', 403);
            }
            $status = $input['status'] ?? 'reviewed';
            $db->query(
                "UPDATE monthly_closing_submissions SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
                [$status, (int)$_SESSION['user_id'], $id]
            );
            respond(['success' => true]);
        }
        break;

    default:
        error('Invalid action', 404);
}