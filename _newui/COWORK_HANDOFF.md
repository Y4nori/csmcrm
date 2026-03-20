# CSM業務管理システム - Cowork移行 引き継ぎプロンプト

## プロジェクト概要
CSM業務管理（害虫駆除・施設管理CRM）のWebアプリケーション。
React 18 + PHP API + MySQL構成。フロントはCDN読み込みのReact（Babel変換）で、SPA構成。

---

## 環境情報

### 本番環境
- **URL**: https://csmcloud.xyz/
- **DB名**: csm2019_crm
- **DBパスワード**: LPkojihu001
- **phpMyAdmin**: https://phpmyadmin-sv14625.xserver.jp/

### テスト環境
- **URL**: https://csmkanri.tsukusutest.xyz/
- **DB名**: tsukusu01_csmcus
- **DBパスワード**: LPkojihu001
- **phpMyAdmin**: https://phpmyadmin-sv16275.xserver.jp/

---

## 最新コードの場所
- **Gitリポジトリ**: `Y4nori/csmcrm`
- **ブランチ**: `claude/debug-crm-issues-OImw0`
- **最新版（修正済み完全版）**: `_newui/latest/` フォルダ
  - そのままサーバーにアップロードして置換可能な形式

### フォルダ構成
```
_newui/latest/
├── api/
│   ├── Database.php     # DB接続クラス
│   ├── config.php       # DB設定（環境ごとに書き換え必要）
│   ├── index.php        # 全APIエンドポイント（約3100行）
│   └── setup_site_billing_docs.sql
├── sql/
│   └── inventory_setup.sql  # 在庫管理テーブル作成SQL
├── uploads/photos/      # アップ済み写真
├── app.js               # フロントエンド全体（React、約5600行）
├── index.html           # エントリポイント
├── styles.css           # スタイルシート
├── manifest.json        # PWA設定
├── favicon.ico / icon-*.png  # アイコン類
└── robots.txt
```

---

## デプロイ手順

### テスト環境への反映
1. `_newui/latest/` の内容をFTPまたはファイルマネージャーでテスト環境にアップロード
2. `api/config.php` のDB接続情報をテスト環境用に変更：
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'tsukusu01_csmcus');
   define('DB_USER', 'tsukusu01_csmcus');  // ※実際のDBユーザー名を確認
   define('DB_PASS', 'LPkojihu001');
   ```
3. `sql/inventory_setup.sql` を phpMyAdmin で実行（在庫テーブルがない場合のみ）
4. ブラウザでアクセスして動作確認

### 本番環境への反映
1. テスト環境で動作確認後、同様の手順で本番にアップロード
2. `api/config.php` を本番用に変更：
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'csm2019_crm');
   define('DB_USER', 'csm2019_crm');  // ※実際のDBユーザー名を確認
   define('DB_PASS', 'LPkojihu001');
   ```

---

## 今回修正した通知バグの内容

### 修正前の問題
1. **在庫アラートが常に0表示** - `generateNotifications` 関数に在庫通知の生成コードがなかった
2. **ベルアイコンがクリック不可** - ヘッダーのベルアイコンにonClickハンドラがなかった
3. **通知が5件まで** - `slice(0, 5)` で切られ、6件以上の通知が見えなかった

### 修正内容（`app.js`）
1. **在庫データの取得追加**（L231-232, L367-371）
   - App-levelで `lowStockItems` stateを追加
   - `loadData()` で `api.getInventorySummary()` を呼び、低在庫データを保持

2. **`generateNotifications` に在庫アラート追加**（L504-513）
   - `lowStockItems` をループして `type: 'inventory'` の通知を生成
   - 在庫0は `priority: 'high'`、それ以外は `'medium'`

3. **ベルアイコン改善**（L5501-5507）
   - クリックで通知パネルのトグル表示
   - 赤丸バッジ → 件数表示バッジに変更

4. **通知ドロップダウンパネル新設**（L5515-5545）
   - ヘッダー下にオーバーレイ付きドロップダウンで全通知を表示
   - タイプ別ラベル（契約/請求/入金/施工/在庫）
   - クリックで該当ページへ遷移

5. **ダッシュボード通知セクション改善**（L696-725）
   - 5件制限を撤廃し全件表示
   - タイプ別ラベル追加
   - クリックで該当ページへ遷移
   - `max-h-40` → `max-h-60` に拡大

6. **在庫アラートカード改善**（L685-693）
   - クリックで在庫管理画面へ遷移
   - アラート件数が1以上の場合は赤色表示

---

## 主要機能一覧
- ログイン/認証（セッション管理）
- ダッシュボード（サマリー・通知・作業予定）
- 顧客管理（法人・現場CRUD）
- 年間施工計画
- 請求書管理
- 日報管理
- タイムカード（出退勤・修正申請）
- 在庫管理（営業所別在庫・入出庫・移動）
- 写真管理
- 管理者設定（ユーザー管理・マスタデータ）
- 月次締め報告

## 技術スタック
- **フロント**: React 18（CDN）+ React Router 6 + Tailwind CSS（CDN）+ Babel（ブラウザ変換）
- **バックエンド**: PHP（素のPHP、フレームワークなし）
- **DB**: MySQL
- **ホスティング**: Xserver

---

## 注意事項
- `api/config.php` にはDB認証情報が含まれるため、環境ごとに適切に設定すること
- `uploads/photos/` ディレクトリにはサーバー側で書き込み権限が必要
- テーブルの自動マイグレーションは `api/index.php` 内で実行される（ALTER TABLE文のtry-catch）
- ブラウザキャッシュが効いている場合、ハードリロード（Ctrl+Shift+R）で最新版を確認
