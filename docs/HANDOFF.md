# CSM業務管理システム - セッション引き継ぎドキュメント

> 最終更新: 2026-04-07

---

## このドキュメントの使い方

次のClaude Codeセッション開始時に、下記の「引き継ぎプロンプト」セクション（```で囲まれた部分）をそのままコピーして貼り付けてください。

---

## 引き継ぎプロンプト

```
CSM業務管理システム（害虫駆除業向けCRM）の開発を引き継ぎます。

■ まず以下の手順でプロジェクトの全体像を把握してください：

1. mainブランチに切り替え（または最新をfetch）してから、以下のファイルを順番に読んでください：
   - CLAUDE.md（開発ルール・プロジェクト概要・デプロイ方式 — 最重要）
   - docs/PROJECT_SUMMARY.md（APIエンドポイント52個の詳細・DBスキーマ全容）
   - docs/requirements.md（各機能の仕様・決定事項）
   - docs/HANDOFF.md（この引き継ぎドキュメント本体 — 修正履歴・既知バグの詳細あり）

2. git log --oneline -20 で直近の修正履歴を確認してください。

3. 主要ファイルの構成を確認してください：
   - app.js（Reactフロントエンド全体、約6000行の単一ファイル）
   - api/index.php（PHPバックエンドAPI全体、約3700行の単一ファイル）

■ 絶対に守るべき開発ルール（3つ）：

【ルール1: デプロイフォルダ作成 — 必須】
app.js または api/index.php を修正したら、必ずコミット前に当日日付のデプロイフォルダを作成：
  DATE=$(date +%Y%m%d)
  mkdir -p ${DATE}/api
  cp app.js index.html styles.css manifest.json ${DATE}/
  cp api/index.php api/config.php api/Database.php ${DATE}/api/
日付フォルダがないとXServerへデプロイできないため、省略禁止。

【ルール2: php://input 空問題への対応 — 必須】
XServer環境でphp://inputが稀に空になる。POSTで重要なIDを送る場合は必ずクエリパラメータにもフォールバック：
  app.js側:  api.call('action', 'POST', { id: targetId }, { id: targetId });
  PHP側:     $id = $input['id'] ?? $_GET['id'] ?? null;

【ルール3: config.php 保護】
api/config.phpにDB認証情報がハードコードされている。変更時は慎重に。

■ 上記ファイルを全て読んだら、作業を開始してください。
```
