# CLAUDE.md - CSM業務管理システム 開発ガイド

## プロジェクト概要

害虫駆除業（CSM社）向けの業務管理CRMシステム。
XServer上で稼働するPHP + React（CDN）のシングルページアプリケーション。

## 技術スタック

- **フロントエンド**: React 18 + React Router 6 + Tailwind CSS（全てCDN）、Babel in-browser JSXトランスパイル
- **バックエンド**: PHP（フレームワークなし）、PDO + MySQL
- **ビルドツール**: なし（npm/composer不使用）
- **テスト**: なし（手動テストのみ）
- **ホスティング**: XServer（日本）

## ディレクトリ構造

```
/home/user/csmcrm/
├── app.js              # Reactフロントエンド全体（単一ファイル、約360KB）
├── index.html          # HTMLエントリーポイント
├── styles.css          # カスタムCSS
├── api/
│   ├── index.php       # メインAPI（全エンドポイント集約、約3000行）
│   ├── config.php      # DB接続設定（認証情報あり、コミット注意）
│   └── Database.php    # PDO Singletonクラス
├── sql/
│   └── inventory_setup.sql  # 在庫管理DB初期化
├── docs/
│   ├── PROJECT_SUMMARY.md   # 詳細なプロジェクトサマリー（APIエンドポイント一覧等）
│   └── requirements.md      # 要件・決定事項
├── YYYYMMDD/           # 日付別デプロイフォルダ（本番デプロイ用スナップショット）
│   ├── app.js
│   ├── api/index.php
│   └── ...             # index.html, styles.css, manifest.json等のコピー
├── latest-v6/          # 過去のバージョンスナップショット（参考用）
├── latest-v7/          # 過去のバージョンスナップショット（参考用）
└── uploads/photos/     # アップロード写真
```

## 重要な開発ルール

### デプロイ方式
- 修正時は **ルートの `app.js` と `api/index.php`** を直接編集する
- デプロイ時は **`YYYYMMDD/` フォルダ**（例: `20260403/`）を作成し、修正済みファイル一式をコピー
- 日付フォルダには app.js, api/(index.php, config.php, Database.php), index.html, styles.css, manifest.json 等を含める
- XServer上では日付フォルダの内容で本番を置き換える運用

### コードの特徴
- `app.js` は **単一巨大ファイル**（全Reactコンポーネント・ルーティング・API呼び出しが1ファイル）
- `api/index.php` も **単一ファイル**（全エンドポイントがswitch-caseで集約）
- API呼び出し形式: `api/index.php?action={endpoint_name}`
- POSTデータは `php://input` からJSON読み取り（稀に空になるバグあり → `$_GET` フォールバック推奨）

### 既知の注意点
- `config.php` にDB認証情報がハードコードされている（変更時は慎重に）
- `php://input` が空になるケースがあるため、重要なIDはクエリパラメータにもフォールバック送信している
- タイムカード関連テーブルは `timecard_requests`（新）と `time_correction_requests`（旧）の2系統が存在
- 在庫管理は4拠点（大阪営業、阪和営業、京滋営業、神戸営業所）に簡略化済み（カテゴリ・閾値・アラート削除済み）

## APIの構造

```
api.call(action, method, bodyData, queryParams)
```

- `action` → `?action=xxx` としてURLに付与
- `bodyData` → `JSON.stringify()` して `fetch` の `body` に送信
- `queryParams` → URLの追加クエリパラメータ
- PHP側: `$input = json_decode(file_get_contents('php://input'), true);` で受信

## ユーザーロール

| ロール | 権限 |
|--------|------|
| `master` | 全機能 + masterユーザー作成 |
| `admin` | 全機能（master作成以外） |
| `staff` | 日報、タイムカード、在庫、キーボックス、法人編集・削除 |

## 最近の修正履歴（2026年4月）

### 2026-04-03（最新）
- **Bug Fix**: ダッシュボード通知リンクが `/admin-timecard`（存在しないルート）→ `/admin/timecards` に修正
- **Bug Fix**: タイムカード承認・却下で `php://input` が空になり「Invalid request ID」エラー → IDをクエリパラメータにもフォールバック送信
  - `app.js`: `approveTimecardRequest` / `rejectTimecardRequest` でIDを第4引数（queryParams）にも追加
  - `api/index.php`: `timecard-request-approve` / `timecard-request-reject` で `$_GET['id']` フォールバック追加

### 2026-04-01
- 在庫管理を簡略化（4拠点のみ、カテゴリ・閾値・アラート削除、在庫0初期化）
- 法人一覧のソートUI復元
- latest-v7を元に戻し、20260401フォルダに修正済みapp.jsを反映

### 2026年3月以前
- 日報の時間自動計算機能追加
- 時間入力の小数点バグ修正
- スタッフ現場削除権限追加 & 管理者復元機能
- タイムカード修正申請のid=0カスケードバグ修正
- 15件のセキュリティ・データ整合性バグ修正

## 未解決・要注意事項

- `time_correction_requests` テーブル（旧）と `timecard_requests` テーブル（新）が両方存在し、別々のエンドポイントで処理されている → 将来的に統合検討
- `php://input` が空になる根本原因は未特定（XServer環境固有の可能性）→ 当面はクエリパラメータフォールバックで対応
- latest-v6 / latest-v7 フォルダは過去の参考用で、現在のデプロイには使用しない（日付フォルダ方式に統一済み）
