<?php
/**
 * データベース設定（本番環境 XServer用）
 *
 * セキュリティ警告:
 * - 本番環境では環境変数からDB認証情報を読み込むことを推奨します
 * - 例: define('DB_PASS', getenv('DB_PASSWORD'));
 * - このファイルはGitの .gitignore に追加してください
 */
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'csm2019_crm');
define('DB_USER', 'csm2019_crm');
define('DB_PASS', 'LPkojihu001');
define('DB_CHARSET', 'utf8mb4');

// セッション設定
define('SESSION_LIFETIME', 86400); // 24時間

/**
 * CORS設定
 *
 * セキュリティ警告:
 * - 本番環境では '*' ではなく、実際のドメインを指定してください
 * - 例: define('ALLOWED_ORIGIN', 'https://csmcloud.xyz');
 */
define('ALLOWED_ORIGIN', 'https://csmcloud.xyz');

// エラー表示（本番環境ではfalse）
define('DEBUG_MODE', false);

// タイムゾーン
date_default_timezone_set('Asia/Tokyo');