タイムカード バグ修正
====================

修正日: 2026-03-24

■ 修正内容
----------

【致命的バグ】タイムカードの日付がUTC基準になっていた

原因:
  new Date().toISOString().slice(0, 10) はUTC日付を返す。
  日本時間（JST = UTC+9）で午前0時〜8時59分の間、
  UTCではまだ前日のため、サーバーとクライアントで日付がズレる。

  例: JST 2026-03-25 08:52 → UTC 2026-03-24 23:52
  クライアント: date='2026-03-24' でGETリクエスト
  サーバー: date('Y-m-d') = '2026-03-25' でレコード作成
  → 出勤しても昨日のデータが表示される
  → 「本日の打刻完了」と表示され、出勤/退勤ボタンが出ない

修正:
  getLocalDateStr() / getLocalMonthStr() ヘルパー関数を追加し、
  ローカルタイムゾーンの日付を使用するように全箇所を修正。

■ 修正ファイル
--------------

1. app.js → ルートの app.js を置換
   - getLocalDateStr() / getLocalMonthStr() ヘルパー追加
   - getTodayTimecard() のdate引数をローカル日付に修正
   - TimecardView の selectedMonth 初期値をローカル月に修正
   - TimecardView の todayStr 参照（3箇所）をローカル日付に修正
   - TimecardAdminView の selectedMonth 初期値をローカル月に修正

2. index.php → api/index.php を置換
   （PHP側は date('Y-m-d') でサーバーローカル時刻を使用しており問題なし）

■ 置換手順
----------
  cp fixes/app.js ./app.js
  cp fixes/index.php ./api/index.php
