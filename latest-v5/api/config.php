<?php
/**
 * データベース設定（本番環境 XServer用）
 */
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'tsukusu01_csmkanri');
define('DB_USER', 'tsukusu01_csmcus');
define('DB_PASS', 'LPkojihu001');
define('DB_CHARSET', 'utf8mb4');

// セッション設定
define('SESSION_LIFETIME', 86400); // 24時間

// CORS設定
define('ALLOWED_ORIGIN', '*');

// エラー表示（本番環境ではfalse）
define('DEBUG_MODE', false);

// タイムゾーン
date_default_timezone_set('Asia/Tokyo');
