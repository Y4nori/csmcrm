# CSM業務管理システム - セッション引き継ぎドキュメント

> 最終更新: 2026-04-07

---

## このドキュメントの使い方

次のClaude Codeセッション開始時に、下記の「引き継ぎプロンプト」セクション（```で囲まれた部分）をそのままコピーして貼り付けてください。
プロジェクトの全体像・ルール・現状が全て引き継がれます。

---

## 引き継ぎプロンプト

```
CSM業務管理システム（害虫駆除業向けCRM）の開発を引き継いでください。
以下にプロジェクトの全体像・開発ルール・現在の状態をまとめます。
作業前に必ず CLAUDE.md を読んでください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ プロジェクト概要
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

害虫駆除業（CSM社）向けの業務管理CRMシステム。
XServer（日本）上で稼働する PHP + React 18（CDN）のSPA。
ビルドツール・パッケージマネージャー一切不使用（npm/composer なし）。
テストは手動のみ（自動テストなし）。

技術スタック:
- フロントエンド: React 18 + React Router 6 + Tailwind CSS（全CDN）、Babel in-browser JSXトランスパイル
- バックエンド: PHP 7.x以上（フレームワークなし）、PDO + MySQL
- DB: MySQL（tsukusu01_csmkanri）、charset: utf8mb4
- ホスティング: XServer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ ファイル構成（超重要）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2つの巨大な単一ファイルで構成:

- app.js（約6,165行）— Reactフロントエンド全体。全コンポーネント・ルーティング・API呼び出しが1ファイル
- api/index.php（約3,704行）— PHPバックエンドAPI全体。52エンドポイントがswitch-caseで集約
- api/config.php — DB接続設定（認証情報ハードコード、編集注意）
- api/Database.php — PDO Singletonクラス
- index.html — HTMLエントリーポイント
- styles.css — カスタムCSS

修正時はルートの app.js と api/index.php を直接編集する。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 開発ルール（厳守）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【デプロイフォルダ作成ルール — 必須】
app.js または api/index.php を修正した場合、必ず以下を実行してからコミット・プッシュすること：

1. 当日の日付で YYYYMMDD/ フォルダを作成（例: 20260407/）
2. 以下のファイルを全てコピー（本番完全置換用）：
   YYYYMMDD/
   ├── app.js           ← ルートからコピー
   ├── index.html       ← ルートからコピー
   ├── styles.css       ← ルートからコピー
   ├── manifest.json    ← ルートからコピー
   └── api/
       ├── index.php    ← api/ からコピー
       ├── config.php   ← api/ からコピー
       └── Database.php ← api/ からコピー

3. コピーコマンド:
   DATE=$(date +%Y%m%d)
   mkdir -p ${DATE}/api
   cp app.js index.html styles.css manifest.json ${DATE}/
   cp api/index.php api/config.php api/Database.php ${DATE}/api/

4. 日付フォルダも含めてコミット・プッシュする
5. このルールを省略してはならない（日付フォルダがないとXServerへデプロイできない）

【php://input 空問題への対応（必須）】
XServer環境で php://input が稀に空になるバグがある。
POSTで重要なIDを送る場合は、必ずクエリパラメータにもフォールバック送信すること。

app.js側:
  api.call('some-action', 'POST', { id: targetId }, { id: targetId });

api/index.php側:
  $id = $input['id'] ?? $_GET['id'] ?? null;

対応済みエンドポイント: timecard-request-approve, timecard-request-reject

【その他ルール】
- config.php のDB認証情報は変更時に慎重に対応（DB名: csm2019_crm）
- latest-v6/, latest-v7/ は過去の参考用、デプロイには使用しない

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ API呼び出しパターン
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

フロントエンド（app.js）:
  api.call(action, method, bodyData, queryParams)
  → fetch('api/index.php?action=${action}&${queryParams}', { method, body: JSON.stringify(bodyData) })

バックエンド（api/index.php）:
  $input = json_decode(file_get_contents('php://input'), true);

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ ユーザーロール
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- master: 全機能 + masterユーザー作成
- admin: 全機能（master作成以外）
- staff: 日報、タイムカード、在庫、キーボックス、法人編集・削除

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 主要機能
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- 顧客管理: 法人・現場の登録/編集/削除、年間計画、作業ログ、写真、連絡履歴、請求履歴
- タイムカード: 出退勤打刻（夜勤対応）、修正申請（スタッフ→管理者承認/却下）
- 日報: 作成/編集/削除、詳細行、時間自動計算、CSV出力
- 在庫管理: 4拠点（大阪営業、阪和営業、京滋営業、神戸営業所）、入出庫・転送
- キーボックス: 暗証番号・場所管理（全ロール編集可）、アクセスログ
- その他: 車両マスター、CSV一括エクスポート、監査ログ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ データベース主要テーブル
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

法人・現場: corporations, sites, site_pests, site_work_types, site_work_areas, site_billing_months, site_documents, yearly_plans, work_logs, photos, contact_logs, invoice_history
ユーザー: users, login_logs, audit_logs
タイムカード（2系統・要注意）:
  - timecards（出退勤記録）
  - timecard_requests（新・修正申請）
  - time_correction_requests（旧・修正申請、別エンドポイント）→将来統合検討
日報: daily_reports, daily_report_details, daily_report_hours
在庫: inventory_branches, inventory_categories, inventory_products, inventory_stocks, inventory_logs
その他: master_vehicles, master_pests, master_work_types, master_work_areas, keybox_logs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ APIエンドポイント一覧（52個）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

認証: login, logout, check-auth
ユーザー: users, user
法人・現場: corporations, corporation, sites, site, yearly-plan, contact-logs
現場書類: site-documents, site-document
作業履歴: work-logs, photos, invoice
マスター: master-data
キーボックス: keybox-log
ログ: login-logs, audit-logs
CSV: export
日報: daily-reports, daily-report, daily-report-hours, daily-reports-export
タイムカード: timecards, timecard, timecard-clock-in, timecard-clock-out, timecard-request, timecard-requests, timecard-request-approve, timecard-request-reject, timecard-requests-count, process-time-correction
車両: vehicles, vehicle
在庫: inventory-branches, inventory-categories, inventory-products, inventory-product-create, inventory-product-update, inventory-product-delete, inventory-stock, inventory-stock-update, inventory-transfer, inventory-transactions, inventory-summary, inventory-product-reorder

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 既知のバグ・未解決事項
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. php://input が空になる問題（未解決）— XServer固有、クエリパラメータフォールバックで対処中
2. タイムカードテーブル2系統問題（未解決）— timecard_requests(新)とtime_correction_requests(旧)が共存
3. config.php にDB認証情報がハードコード

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 修正履歴（直近）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2026-04-07: 引き継ぎドキュメント作成、デプロイフォルダ作成必須ルールを制定
2026-04-03（最新デプロイ）: 通知リンク修正(/admin-timecard→/admin/timecards)、タイムカード承認・却下のID取得失敗修正
2026-04-01: 在庫管理4拠点簡略化、法人一覧ソートUI復元
2026年3月以前: 日報時間自動計算、小数点バグ修正、スタッフ現場削除権限、タイムカードid=0バグ修正、セキュリティ15件修正

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ セキュリティ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- セッション固定化対策: session_regenerate_id(true)
- パスワード: password_hash() / password_verify()
- Cookie: HttpOnly=true, SameSite=Strict
- ヘッダー: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- 監査ログ: audit_logs テーブルに全操作記録

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 参照ドキュメント
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- CLAUDE.md — 開発ルール（最重要、最初に読む）
- docs/PROJECT_SUMMARY.md — APIエンドポイント詳細、DBスキーマ全容
- docs/requirements.md — 各機能の仕様・決定事項
- docs/HANDOFF.md — この引き継ぎドキュメント

まず CLAUDE.md を読んでから作業を開始してください。
```
