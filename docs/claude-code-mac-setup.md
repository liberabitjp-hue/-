# MacBookでのClaude Code セットアップ手順

個人の開発効率化(このリポジトリでのコーディング作業)を目的とした、
ターミナル/ファイル/Git操作・ブラウザ自動化・GitHub/Googleカレンダー連携の
セットアップ手順。

## 1. インストール・認証

```bash
npm install -g @anthropic-ai/claude-code
# または: brew install --cask claude-code
claude auth login
```

このリポジトリを clone した後、初回起動時に `.claude/settings.json`
(このリポジトリにコミット済み)が自動的に読み込まれる。確認プロンプトを
減らす設定は済んでいるので、追加の作業は不要。

個人だけの追加設定をしたい場合は `.claude/settings.local.json` を作成する
(gitignore対象なので他の人と共有されない)。

## 2. GitHub連携

このリポジトリの `origin` は GitHub なので、GitHub MCP は自動的に使える
ことが多い。使えない場合は:

```bash
claude mcp list          # 設定済みMCPサーバーの確認
```

を実行し、必要なら claude.ai の Connectors 設定でGitHub連携を有効にする。
PAT(Personal Access Token)を手動発行する場合は、このリポジトリへの
アクセスに必要な最小スコープ(`repo` 程度)に絞ること。

## 3. Googleカレンダー連携

**設定場所**: `claude mcp add` ではなく、**claude.ai の 設定 → Connectors**
でOAuth連携する。同じアカウントでログインしていれば、MacBookのClaude Code
CLIにも自動的に反映される(追加のCLI操作は不要)。

```bash
/mcp    # セッション内でコネクタの接続状況を確認できる
```

**事前に把握しておくべき制約(2026年9月時点)**:

- 有料プラン(Pro/Max/Team)が必要
- 読み取り専用スコープが無い(接続すると書き込み権限も付与される)
- 更新・削除の操作には対応していない(読み取り・作成のみ)
- CLI(ターミナル)からの接続が不安定という報告がある
  (GitHub Issue [#29345](https://github.com/anthropics/claude-code/issues/29345))。
  ターミナルで繋がらない場合は、Desktopアプリまたはclaude.ai Web版を使う

## 4. ブラウザ自動化

Playwright経由でChromiumを操作できる(追加インストール不要な環境もある)。
対象サイトの利用規約を確認し、ログインが必要なサービスへの自動アクセスは
自分のアカウントの範囲内・常識的な頻度に留めること。

## 5. このリポジトリ特有の注意点(重要)

`app/test-fixtures/` には実際の学校のExcelデータ(氏名等のメタデータのみ
削除済み)が含まれる。**カレンダー・メール・Slack等の外部連携が有効な状態で
このリポジトリを扱う際、テストデータやその要約を絶対に外部へ送信しない
こと。** 詳細は `CLAUDE.md` の「機密データの扱い」を参照。

## 6. 権限設定の考え方

`.claude/settings.json` で以下を確認なしに許可している:

- ファイル読み書き、git読み取り + `add`/`commit`(ローカルで可逆)
- `npm install`/`run`/`test`、`vitest`/`tsc`/`oxlint`

以下は毎回確認が必要:

- `git push`(特に `--force`)、`git reset --hard`、`git clean`、`rm -rf`、
  `npm publish`、`sudo`、`chmod`

これは「ローカルで完結し取り消せる操作は自動化し、外部に影響する操作・
不可逆な操作は必ず人が確認する」という方針に基づく。さらに緩めたい/
厳しくしたい場合は `.claude/settings.local.json` で個人ごとに調整できる。
