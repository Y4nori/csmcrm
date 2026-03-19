# CSM業務管理システム - プロジェクトサマリー

> 最終更新: 2026-02-26

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| プロジェクト名 | CSM業務管理システム |
| 用途 | 害虫駆除業向け顧客管理システム |
| ホスティング | XServer（日本） |
| データベース | MySQL（tsukusu01_csmkanri） |

## 2. 技術スタック

### フロントエンド
- **React 18**（CDN経由、production build）
- **React Router DOM v6**（ルーティング）
- **Tailwind CSS**（CDN経由）
- **Babel Standalone**（JSXトランスパイル）
- **PWA対応**（manifest.json）

### バックエンド
- **PHP 7.x以上**（フレームワークなし）
- **PDO**（データベース抽象化）
- **Singleton パターン**（Database クラス）

### データベース
- **MySQL**
- Character Set: utf8mb4
- Session Lifetime: 86400秒（24時間）

## 3. ディレクトリ構造

```
/home/user/csmcrm/
├── api/                          # PHPバックエンドAPI
│   ├── index.php                # メインAPI（2,766行、52エンドポイント）
│   ├── config.php               # DB接続設定
│   ├── Database.php             # PDO Singletonクラス
│   └── setup_site_billing_docs.sql
│
├── docs/                         # ドキュメント
│   ├── requirements.md          # 要件・決定事項
│   └── PROJECT_SUMMARY.md       # 本ファイル
│
├── sql/                          # データベースセットアップ
│   └── inventory_setup.sql      # 在庫管理DB初期化スクリプト
│
├── 20260218/ ~ 20260226/        # 日付バックアップフォルダ
│   └── api/, sql/               # 各日付のスナップショット
│
├── uploads/                      # アップロードファイル
│   └── photos/                  # 写真ファイル
│
├── app.js                        # Reactフロントエンド（254KB）
├── index.html                   # HTMLエントリーポイント
├── manifest.json                # PWAマニフェスト
├── robots.txt                   # SEO設定
├── .htaccess                    # Apache設定・キャッシュ制御
└── README.md                    # 簡易README
```

## 4. 依存関係

### パッケージマネージャー
- **package.json**: 不存在（npm未使用）
- **composer.json**: 不存在（Composer未使用）

### 外部ライブラリ（CDN）
| ライブラリ | バージョン | 用途 |
|-----------|----------|------|
| React | 18.x | UIライブラリ |
| React DOM | 18.x | DOM操作 |
| React Router | 6.x | ルーティング |
| Tailwind CSS | 3.x | CSSフレームワーク |
| Babel Standalone | - | JSXトランスパイル |

## 5. データベーススキーマ

### 法人・現場管理
| テーブル | 説明 |
|---------|------|
| `corporations` | 法人（契約金額、契約期間、請求サイクル） |
| `sites` | 現場 |
| `site_pests` | 現場の害虫 |
| `site_work_types` | 現場の作業タイプ |
| `site_work_areas` | 現場の作業箇所 |
| `site_billing_months` | 請求月設定 |
| `site_documents` | 現場書類 |
| `yearly_plans` | 年間計画（相対日付パターン対応） |
| `work_logs` | 作業ログ |
| `photos` | 写真 |
| `contact_logs` | 連絡履歴 |
| `invoice_history` | 請求履歴 |

### ユーザー・認証
| テーブル | 説明 |
|---------|------|
| `users` | ユーザー（role: staff/admin/master） |
| `login_logs` | ログイン履歴 |
| `audit_logs` | 監査ログ |

### タイムカード
| テーブル | 説明 |
|---------|------|
| `timecards` | 出退勤記録（auto/manual/corrected対応） |
| `time_correction_requests` | タイムカード修正申請 |

### 日報
| テーブル | 説明 |
|---------|------|
| `daily_reports` | 日報 |
| `daily_report_details` | 日報詳細行 |
| `daily_report_hours` | 日報時間集計 |

### 在庫管理
| テーブル | 説明 |
|---------|------|
| `inventory_branches` | 営業所（6拠点） |
| `inventory_categories` | カテゴリ（8種類） |
| `inventory_products` | 製品マスター |
| `inventory_stocks` | 各営業所の在庫数量 |
| `inventory_logs` | 入出庫履歴 |

### マスターデータ
| テーブル | 説明 |
|---------|------|
| `master_vehicles` | 車両マスター |
| `master_pests` | 害虫マスター |
| `master_work_types` | 作業タイプマスター |
| `master_work_areas` | 作業箇所マスター |

### その他
| テーブル | 説明 |
|---------|------|
| `keybox_logs` | キーボックス閲覧ログ |

## 6. APIエンドポイント一覧（52個）

### リクエスト形式
```
api/index.php?action={endpoint_name}&method={HTTP_METHOD}
```

### 認証（3個）
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `login` | POST | ログイン |
| `logout` | POST | ログアウト |
| `check-auth` | GET | 認証状態確認 |

### ユーザー管理（2個）
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `users` | GET/POST | ユーザー一覧・作成 |
| `user` | PUT/DELETE | ユーザー編集・削除 |

### 法人・現場管理（6個）
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `corporations` | GET/POST | 法人一覧・作成 |
| `corporation` | PUT/DELETE | 法人編集・削除 |
| `sites` | POST | 現場作成 |
| `site` | PUT/DELETE | 現場編集・削除 |
| `yearly-plan` | PUT | 年間計画更新 |
| `contact-logs` | POST | 連絡履歴記録 |

### 現場書類（2個）
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `site-documents` | POST | 書類アップロード |
| `site-document` | DELETE | 書類削除 |

### 作業履歴（3個）
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `work-logs` | POST | 作業ログ作成 |
| `photos` | POST/DELETE | 写真アップロード・削除 |
| `invoice` | PUT | 請求履歴更新 |

### マスターデータ（1個）
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `master-data` | GET/POST/DELETE | マスター一覧・追加・削除 |

### キーボックス（1個）
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `keybox-log` | GET/POST | ログ一覧・アクセス記録 |

### ログ・監査（2個）
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `login-logs` | GET | ログイン履歴 |
| `audit-logs` | GET | 監査ログ |

### CSVエクスポート（1個）
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `export` | GET | corporations/sites/workLogs CSV出力 |

### 日報管理（4個）
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `daily-reports` | GET/POST | 日報一覧・作成 |
| `daily-report` | GET/PUT/DELETE | 日報取得・編集・削除 |
| `daily-report-hours` | PUT | 日報時間集計更新 |
| `daily-reports-export` | GET | 日報CSV出力 |

### タイムカード（10個）
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `timecards` | GET | タイムカード一覧 |
| `timecard` | GET/PUT/DELETE | 当日タイムカード操作 |
| `timecard-clock-in` | POST | 出勤打刻 |
| `timecard-clock-out` | POST | 退勤打刻（夜勤対応） |
| `timecard-request` | GET/POST | 修正申請一覧・送信 |
| `timecard-requests` | GET | 全申請一覧（管理者用） |
| `timecard-request-approve` | POST | 修正申請承認 |
| `timecard-request-reject` | POST | 修正申請却下 |
| `timecard-requests-count` | GET | 未処理申請数 |
| `process-time-correction` | POST | 修正申請処理 |

### 車両管理（2個）
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `vehicles` | GET/POST | 車両一覧・追加 |
| `vehicle` | DELETE | 車両削除 |

### 在庫管理（12個）
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `inventory-branches` | GET | 営業所一覧 |
| `inventory-categories` | GET | カテゴリ一覧 |
| `inventory-products` | GET | 製品一覧 |
| `inventory-product-create` | POST | 製品作成 |
| `inventory-product-update` | POST | 製品情報更新 |
| `inventory-product-delete` | DELETE | 製品削除 |
| `inventory-stock` | GET | 在庫状況 |
| `inventory-stock-update` | POST | 在庫数量更新 |
| `inventory-transfer` | POST | 営業所間転送 |
| `inventory-transactions` | GET | 取引履歴 |
| `inventory-summary` | GET | 在庫サマリー・アラート |
| `inventory-product-reorder` | POST | 複数製品再注文 |

## 7. ユーザーロールと権限

| ロール | 説明 | 権限 |
|--------|------|------|
| `master` | 最上位管理者 | 全機能利用可能、masterユーザー作成可能 |
| `admin` | 管理者 | 全機能利用可能（master作成以外） |
| `staff` | スタッフ | 基本機能のみ（日報、タイムカード、在庫、キーボックス、法人編集・削除） |

## 8. 主要機能

### 顧客管理
- 法人・現場の登録・編集・削除
- 年間計画（相対日付パターン対応：first_sun, last_fri 等）
- 作業ログ・写真管理
- 連絡履歴
- 請求履歴管理

### タイムカード
- 出勤・退勤打刻（夜勤対応）
- 修正申請機能（スタッフ申請 → 管理者承認/却下）
- 打刻タイプ: auto/manual/corrected

### 日報
- 日報作成・編集・削除
- 詳細行管理
- 時間集計
- CSV出力

### 在庫管理
- 6営業所 + 倉庫の在庫管理
- 8カテゴリの製品管理
- 入出庫・調整・転送
- 取引履歴
- 在庫アラート

### キーボックス
- 暗証番号と場所の管理
- 全ロールが編集可能
- アクセスログ記録

### その他
- 車両マスター管理
- CSV一括エクスポート
- 監査ログ

## 9. 直近の開発履歴（30件）

```
c8c255e feat: 在庫管理画面に商品フィルターのドロップダウンを追加
8b48d0a feat: 在庫管理画面にカテゴリフィルターのドロップダウンを追加
cb1fce7 feat: 在庫管理画面に資材（カテゴリ）ソート機能を追加
c9bc4e0 fix: 在庫調整で数量0を許可
7222e0d deploy: 20260226 商品選択ドロップダウンからカテゴリ名プレフィックス削除
bc8998a fix: 商品選択ドロップダウンからカテゴリ名プレフィックスを削除
3d35513 deploy: 20260225 法人編集・削除権限のスタッフ開放
f42ca52 fix: 法人の編集・削除権限をスタッフアカウントにも開放
f7436d0 fix: inventory-product-createでDatabase::lastInsertId未定義エラーを修正
693ee33 fix: 顧客詳細ヘッダーの会社名をtruncateからbreak-wordsに変更し折り返し表示
7bc0e21 deploy: 20260223 在庫商品マスタ追加修正 + 現場名折り返し + 日報時刻入力改善
b1de7c1 fix: 日報の時刻入力をキーボード方式からtime picker方式に変更
0eae03e fix: 在庫商品マスタ追加のInvalid actionエラー修正 + 現場名の折り返し表示対応
4e4d248 fix: .htaccessによるキャッシュ制御を追加し、app.jsの手動バージョン管理を廃止
e3f8302 fix: タイムカード承認500エラーの根本修正 + 写真拡大表示機能
579824a deploy: 20260220 タイムカード修正申請の500エラー修正ファイル
73f680d fix: タイムカード修正申請の承認・却下で500エラーが発生する問題を修正
7887187 docs: 要件・決定事項をまとめたドキュメントを追加
6c443df fix: check-authの401エラーを完全に解消
31b28f2 fix: キーボックスの変更・削除ができない問題を修正
96ab8d3 fix: スタッフもキーボックスの編集・登録を可能に
87f000f fix: 倉庫在庫の編集機能追加、スタッフのキーボックス編集を非表示
094a523 fix: 在庫管理機能を復旧、今日の修正を再適用
9cfc5f7 fix: 認証チェックの401エラーをコンソールに出さないよう修正
4a0493c fix: ログインフォームをformタグで囲み、autocomplete属性を追加
f7da8cc fix: ログアウト時のキャッシュ強制クリア機能を追加
c768c01 add: 20260219 日付フォルダを追加（修正申請機能含む最新版）
e25b14a fix: タイムカード修正申請の承認機能を実装
9e59a93 Fix: inventory warehouse column, timecard approval, keybox staff save
2db8817 Fix: auto-add sort_order column if not exists
```

## 10. セキュリティ設定

### 認証
- セッション固定化対策: `session_regenerate_id(true)`
- パスワードハッシュ: `password_hash()`, `password_verify()`
- セッション有効期限: 24時間

### Cookie設定
- HttpOnly: true
- SameSite: Strict

### セキュリティヘッダー
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block

### 監査
- 操作ログ記録（create/update/delete）
- 対象タイプ、対象ID、詳細情報を保存

## 11. バージョン管理戦略

- **日付フォルダ方式**: `YYYYMMDD` 形式のバックアップフォルダ
- **キャッシュ制御**: .htaccessでno-cache設定
- 各日付フォルダに `api/` と `sql/` のスナップショットを保存
