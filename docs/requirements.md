# CSM業務管理システム 要件・決定事項

最終更新: 2026-04-03

---

## 1. タイムカード修正申請機能

### 概要
スタッフが出退勤時刻の修正を申請し、管理者が承認/却下できる機能。

### 仕様
- **スタッフ側**
  - タイムカード履歴から「修正申請」ボタンで申請可能
  - 申請内容: 日付、出勤時刻、退勤時刻、理由（必須）
  - 同一日付で申請中のものがある場合は重複申請不可
  - 自分の申請一覧を確認可能（ステータス: 申請中/承認済/却下）

- **管理者側**
  - タイムカード管理画面に「修正申請」タブを追加
  - 未処理件数をバッジで表示
  - 各申請に対して「承認」「却下」ボタン
  - 承認時はタイムカードの出退勤時刻を自動更新

### データベース
```sql
CREATE TABLE time_correction_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    work_date DATE NOT NULL,
    requested_clock_in TIME NULL,
    requested_clock_out TIME NULL,
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    processed_by INT NULL,
    processed_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. 在庫管理機能

### 倉庫在庫
- **倉庫支店**: データベースに自動追加（存在しない場合）
- **倉庫列**: 他の営業所と同様にクリックで在庫調整可能
- **表示**: 青色で他の営業所と区別
- **合計**: 全支店（倉庫含む）の合計を表示

### 支店一覧
1. 倉庫（WAREHOUSE）- 青色表示
2. 大阪営業
3. 阪和営業
4. 大阪北営業所
5. 京滋営業
6. 福知山営業
7. 神戸営業所

---

## 3. キーボックス機能

### 権限
- **管理者（admin）**: 登録・編集・削除可能
- **マスター（master）**: 登録・編集・削除可能
- **スタッフ（staff）**: 登録・編集・削除可能

### 仕様
- 全ユーザーがキーボックスの暗証番号と場所を編集可能
- 空欄での保存（削除）も可能
- キーボックス閲覧時はログを記録

---

## 4. キャッシュ制御

### 目的
ログアウト後に古いデータが残らないようにする。

### 実装

#### APIレスポンスヘッダー（api/index.php）
```php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
```

#### HTMLメタタグ（index.html）
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
```

#### ログアウト時の処理（app.js）
- ブラウザCache APIをクリア
- localStorageをクリア
- sessionStorageをクリア
- 強制リロード（window.location.href）

---

## 5. 認証チェック

### 仕様
- 未認証時は401ではなく200で `{authenticated: false}` を返す
- ブラウザコンソールに赤字エラーを表示させない

### APIレスポンス
```json
// 認証済み
{"id": 1, "username": "admin", "name": "管理者", "role": "admin"}

// 未認証
{"authenticated": false}
```

---

## 6. ログインフォーム

### 仕様
- `<form>` タグで囲む（ブラウザのパスワードマネージャー対応）
- `autocomplete="username"` / `autocomplete="current-password"` 属性追加
- Enterキーでログイン可能（onSubmit）

---

## 7. バージョン管理

### ファイル命名規則
- 日付フォルダ: `YYYYMMDD`（例: `20260219`）
- app.jsバージョン: `?v=YYYYMMDD`

### フォルダ構成
```
/csmcrm
├── api/
│   ├── index.php
│   ├── config.php
│   └── Database.php
├── app.js
├── index.html
├── manifest.json
├── docs/
│   └── requirements.md
├── sql/
│   └── inventory_setup.sql
├── 20260218/  (バックアップ)
└── 20260219/  (バックアップ)
```

---

## 8. コンソールエラー対応

### 対応済み
| エラー | 対応 |
|--------|------|
| check-auth 401 | 200で返すよう変更 |
| Password not in form | formタグで囲む |

### 許容（警告のみ）
| 警告 | 理由 |
|------|------|
| Tailwind CDN | 小規模アプリのため許容 |
| Babel in-browser | 開発効率優先 |
| apple-mobile-web-app-capable deprecated | 動作に影響なし |
| icon-192.png not found | PWAアイコン未設定 |

---

## 9. ユーザーロール

| ロール | 権限 |
|--------|------|
| master | 全機能利用可能、masterユーザー作成可能 |
| admin | 全機能利用可能（master作成以外） |
| staff | 基本機能のみ（日報、タイムカード、在庫、キーボックス閲覧/編集） |

---

## 10. 技術スタック

- **フロントエンド**: React 18（CDN）、React Router 6、Tailwind CSS（CDN）、Babel（in-browser）
- **バックエンド**: PHP（フレームワークなし）、PDO
- **データベース**: MySQL
- **ホスティング**: XServer

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-19 | タイムカード修正申請機能を実装 |
| 2026-02-19 | 倉庫在庫の編集機能を追加 |
| 2026-02-19 | キーボックスをスタッフも編集可能に |
| 2026-02-19 | キャッシュ強制クリア機能を追加 |
| 2026-02-19 | check-auth 401エラーを解消 |
| 2026-02-19 | ログインフォームをform化 |
| 2026-02-19 | 在庫管理機能を復旧 |
