# CLAUDE.md

開発の全体像は `README.md`、技術詳細は `app/README.md` を参照。ここでは
Claude Code をこのリポジトリで使う上での運用ルールのみを記載する。

## このリポジトリでの Claude Code 運用ルール

- ビルド成果物の反映は README.md の手順どおり: `app/` で `npm run build` →
  `dist/index.html` を `release/index.html` にコピー。`release/` を手で
  直接編集しない。
- `docs/assumptions.md` に前提条件の一覧がある。仕様に関わる変更をする際は
  先にここを確認する。

## 機密データの扱い(重要)

`app/test-fixtures/` には実際にお預かりした学校のExcelファイル(作成者名等の
メタデータのみ削除、セル内容は実データ)が含まれる。テスト実行(`npm test`)で
ローカルに読み込むのは問題ないが、**このリポジトリの内容やテスト出力を
Googleカレンダー・メール・Slack等の外部連携(MCPコネクタ)に自動で渡したり
送信したりしないこと**。要約・スクリーンショット・診断情報の書き出しも同様。

## Claude Code 権限設定 (.claude/settings.json)

このリポジトリでは確認プロンプトを減らすため、以下を確認なしで許可している:

- ファイル読み取り・編集(Read/Grep/Glob/Edit/Write)
- git の読み取り系コマンド、`git add`/`git commit`(ローカルなので可逆)
- `npm install`/`npm run *`/`npm test`、`npx vitest`/`tsc`/`oxlint`
- `ls`/`mkdir`/`cp`(release/ へのビルド成果物コピー用)

一方で以下は毎回確認が必要(意図的に自動化していない):

- `git push`(特に `--force`)、`git reset --hard`、`git clean`
- `rm -rf`、`npm publish`、`sudo`、`chmod`

個人の好みでさらに調整したい場合は `.claude/settings.local.json`
(gitignore対象、コミットされない)に追記する。

## MacBookでの利用・外部連携

GitHub連携(PR作成・CI確認等)・Googleカレンダー連携・Remote Control
(MacBookのセッションをスマホ/ブラウザから操作)の設定手順は
`docs/claude-code-mac-setup.md` にまとめてある。特にカレンダーは
書き込み権限込みでの連携になる点、CLIでの接続不具合が既知である点に注意。
Remote Controlはこのクラウド環境からは設定できず、MacBook実機での作業が
必要。接続した端末はローカルのファイルシステム・シェルにフルアクセス
できるため、実際の学校データを含むこのリポジトリでは常時自動有効化
(`remoteControlAtStartup: true`)はしないこと。
