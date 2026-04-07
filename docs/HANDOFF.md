# CSM業務管理システム - セッション引き継ぎプロンプト

> 作成日: 2026-04-07
> 前回セッション: claude/debug-crm-issues-OImw0

---

## このドキュメントの使い方

次のClaude Codeセッション開始時に、以下のプロンプトをそのまま貼り付けてください：

---

## 引き継ぎプロンプト

```
CSM業務管理システム（害虫駆除業向けCRM）の開発を引き継いでください。
以下にプロジェクトの全体像と現在の状態をまとめます。

## 1. プロジェクト概要

- 害虫駆除業（CSM社）向けの業務管理CRMシステム
- XServer（日本）上で稼働
- PHP（フレームワークなし）+ React 18（CDN）のSPA
- ビルドツール・パッケージマネージャーは一切不使用（npm/composer なし）
- テストは手動のみ（自動テストなし）

## 2. 技術スタック

| 層 | 技術 |
|----|------|
| フロントエンド | React 18 + React Router 6 + Tailwind CSS（全CDN）、Babel in-browser JSXトランスパイル |
| バックエンド | PHP 7.x以上、PDO + MySQL |
| DB | MySQL（tsukusu01_csmkanri）、charset: utf8mb4 |
| ホスティング | XServer |

## 3. ファイル構成（重要）

このプロジェクトは **2つの巨大な単一ファイル** で構成されています：

- `/home/user/csmcrm/app.js` — Reactフロントエンド全体（約6,165行、360KB）
  - 全コンポーネント、ルーティング、API呼び出しが1ファイルに集約
- `/home/user/csmcrm/api/index.php` — PHPバックエンドAPI全体（約3,704行、52エンドポイント）
  - 全エンドポイントがswitch-caseで集約
- `/home/user/csmcrm/api/config.php` — DB接続設定（認証情報ハードコード、編集注意）
- `/home/user/csmcrm/api/Database.php` — PDO Singletonクラス
- `/home/user/csmcrm/index.html` — HTMLエントリーポイント
- `/home/user/csmcrm/styles.css` — カスタムCSS

修正時は **ルートの app.js と api/index.php を直接編集** します。

### デプロイ方式
- デプロイ時は `YYYYMMDD/` フォルダ（例: `20260403/`）を作成し、修正済みファイル一式をコピー
- 最新デプロイフォルダ: `20260403/`
- `latest-v6/`, `latest-v7/` は過去の参考用（使用しない）

## 4. API呼び出しパターン

```javascript
// フロントエンド（app.js）
api.call(action, method, bodyData, queryParams)
// → fetch(`api/index.php?action=${action}&${queryParams}`, { method, body: JSON.stringify(bodyData) })
```

```php
// バックエンド（api/index.php）
$input = json_decode(file_get_contents('php://input'), true);
// ※ php://input が空になるバグあり → $_GET フォールバック必須
```

**重要**: `php://input` がXServer環境で稀に空になるため、重要なIDはクエリパラメータにもフォールバック送信する設計にしています。

## 5. ユーザーロール

| ロール | 権限 |
|--------|------|
| master | 全機能 + masterユーザー作成 |
| admin | 全機能（master作成以外） |
| staff | 日報、タイムカード、在庫、キーボックス、法人編集・削除 |

## 6. 主要機能

- **顧客管理**: 法人・現場の登録/編集/削除、年間計画（相対日付パターン対応）、作業ログ、写真管理、連絡履歴、請求履歴
- **タイムカード**: 出退勤打刻（夜勤対応）、修正申請（スタッフ申請→管理者承認/却下）
- **日報**: 作成/編集/削除、詳細行管理、時間自動計算、CSV出力
- **在庫管理**: 4拠点（大阪営業、阪和営業、京滋営業、神戸営業所）の在庫管理、入出庫・転送
- **キーボックス**: 暗証番号と場所の管理（全ロール編集可）、アクセスログ
- **その他**: 車両マスター、CSV一括エクスポート、監査ログ

## 7. データベース主要テーブル

### 法人・現場
corporations, sites, site_pests, site_work_types, site_work_areas, site_billing_months, site_documents, yearly_plans, work_logs, photos, contact_logs, invoice_history

### ユーザー・認証
users, login_logs, audit_logs

### タイムカード（2系統あり・要注意）
- timecards — 出退勤記録
- timecard_requests — 修正申請（新テーブル）
- time_correction_requests — 修正申請（旧テーブル、別エンドポイントで処理）
→ 将来的に統合検討

### 日報
daily_reports, daily_report_details, daily_report_hours

### 在庫
inventory_branches, inventory_categories, inventory_products, inventory_stocks, inventory_logs

### その他
master_vehicles, master_pests, master_work_types, master_work_areas, keybox_logs

## 8. APIエンドポイント一覧（52個）

### 認証: login, logout, check-auth
### ユーザー: users, user
### 法人・現場: corporations, corporation, sites, site, yearly-plan, contact-logs
### 現場書類: site-documents, site-document
### 作業履歴: work-logs, photos, invoice
### マスター: master-data
### キーボックス: keybox-log
### ログ: login-logs, audit-logs
### CSV: export
### 日報: daily-reports, daily-report, daily-report-hours, daily-reports-export
### タイムカード: timecards, timecard, timecard-clock-in, timecard-clock-out, timecard-request, timecard-requests, timecard-request-approve, timecard-request-reject, timecard-requests-count, process-time-correction
### 車両: vehicles, vehicle
### 在庫: inventory-branches, inventory-categories, inventory-products, inventory-product-create, inventory-product-update, inventory-product-delete, inventory-stock, inventory-stock-update, inventory-transfer, inventory-transactions, inventory-summary, inventory-product-reorder

## 9. 既知のバグ・注意点

1. **php://input が空になる問題**（未解決）
   - XServer環境固有と思われる
   - 対策: 重要なIDはクエリパラメータにもフォールバック送信
   - 既に対応済みのエンドポイント: timecard-request-approve, timecard-request-reject

2. **タイムカードテーブル2系統問題**（未解決）
   - `timecard_requests`（新）と `time_correction_requests`（旧）が共存
   - それぞれ別エンドポイントで処理されている
   - 将来的に統合が望ましい

3. **config.php の認証情報**
   - DB認証情報がハードコード（DB名: csm2019_crm）
   - 変更時は慎重に対応

## 10. 修正履歴（直近）

### 2026-04-03（最新デプロイ）
- ダッシュボード通知リンク修正: `/admin-timecard` → `/admin/timecards`
- タイムカード承認・却下のリクエストID取得失敗修正（php://input空対策）

### 2026-04-01
- 在庫管理を4拠点に簡略化（カテゴリ・閾値・アラート削除、在庫0初期化）
- 法人一覧のソートUI復元

### 2026年3月以前
- 日報の時間自動計算機能追加
- 時間入力の小数点バグ修正
- スタッフ現場削除権限追加 & 管理者復元機能
- タイムカード修正申請のid=0カスケードバグ修正
- 15件のセキュリティ・データ整合性バグ修正

## 11. Git情報

- メインブランチ: main
- 最新コミット: `9f76ee3 docs: CLAUDE.md作成、PROJECT_SUMMARY.md・requirements.md更新`
- CLAUDE.md がリポジトリルートにあり、開発ルールの詳細が記載されています

## 12. セキュリティ設定

- セッション固定化対策: session_regenerate_id(true)
- パスワード: password_hash() / password_verify()
- Cookie: HttpOnly=true, SameSite=Strict
- セキュリティヘッダー: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- 監査ログ: 全操作を audit_logs テーブルに記録

## 13. 参照すべきドキュメント

- `CLAUDE.md` — 開発ルール・コーディング規約（最重要、必ず最初に読んでください）
- `docs/PROJECT_SUMMARY.md` — APIエンドポイント詳細、DBスキーマ
- `docs/requirements.md` — 各機能の仕様・決定事項

作業を始める前に、まず CLAUDE.md を読んでプロジェクトルールを確認してください。
修正対象のファイルは基本的にルートの app.js と api/index.php の2つです。
```

---

## 補足: よくある作業パターン

### バグ修正の流れ
1. ルートの `app.js` と/または `api/index.php` を直接編集
2. 動作確認（手動テスト）
3. デプロイ用に `YYYYMMDD/` フォルダを作成してファイルコピー

### php://input 空問題への対応パターン
```javascript
// app.js側: queryParamsにもIDを渡す
api.call('some-action', 'POST', { id: targetId }, { id: targetId });
```
```php
// api/index.php側: $_GETフォールバック
$id = $input['id'] ?? $_GET['id'] ?? null;
```

### 新エンドポイント追加の流れ
1. `api/index.php` の switch-case に新しい case を追加
2. `app.js` に対応するAPI呼び出し関数・UIコンポーネントを追加
3. 必要に応じて SQLテーブルを `sql/` に追加
