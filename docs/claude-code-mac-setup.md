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

## 4. Remote Control(MacBookのセッションをスマホ/ブラウザから操作)

**これはMacBook実機でしか設定できない**(このクラウド環境からは設定不可)。
「私(Claude)が勝手にMacBookを操作できるようになる」機能ではなく、
**あなた自身がMacBookで動かしているClaude Codeセッションを、外出先の
スマホ・ブラウザから操作できるようにする**機能。実行自体は常にMacBook上
で行われる。

**前提条件**:

- Pro/Max/Team/Enterpriseプランでログイン(APIキー認証では利用不可)
- `claude` → `/login` でclaude.aiアカウントにログイン済み
- Bedrock/Vertex/独自エンドポイント(`ANTHROPIC_BASE_URL`)を使っていない

**起動方法(いずれか)**:

```bash
claude remote-control   # このリポジトリのディレクトリで実行
```

初回のみ `Enable Remote Control? (y/n)` に `y` で応答すると、セッション
URLとQRコードが表示される。表示されたURL(またはQRコード)をスマホ/
ブラウザで開けば接続完了。追加のペアリング認証は不要。

他の方法:
- 通常セッション開始時に `claude --remote-control`(または `--rc`)
- 既存セッション内で `/remote-control` と入力

**停止・無効化**: `/remote-control` を再度実行しステータスパネルから切断、
またはMacBook側のプロセスを終了。停止後約4時間でセッションは自動アーカイブ。

**注意(このリポジトリ特有)**: 接続した端末はローカルのファイルシステム・
シェルにフルアクセスできる(`.claude/settings.json` の許可・確認ルールは
Remote Control経由でも同様に適用される)。このリポジトリには実際の学校
データが含まれるため、`remoteControlAtStartup: true` によるセッション
起動時の自動有効化はおすすめしない(個人設定 `~/.claude/settings.json`
に書く場合も同様)。必要なときだけ手動で `claude remote-control` を
起動する運用にすること。プロジェクト共有の `.claude/settings.json` には
この設定を含めていない(cloneした全員に強制されてしまうため)。

## 6. ブラウザ自動化

Playwright経由でChromiumを操作できる(追加インストール不要な環境もある)。
対象サイトの利用規約を確認し、ログインが必要なサービスへの自動アクセスは
自分のアカウントの範囲内・常識的な頻度に留めること。

## 7. このリポジトリ特有の注意点(重要)

`app/test-fixtures/` には実際の学校のExcelデータ(氏名等のメタデータのみ
削除済み)が含まれる。**カレンダー・メール・Slack等の外部連携が有効な状態で
このリポジトリを扱う際、テストデータやその要約を絶対に外部へ送信しない
こと。** 詳細は `CLAUDE.md` の「機密データの扱い」を参照。

## 8. 権限設定の考え方

`.claude/settings.json` で以下を確認なしに許可している:

- ファイル読み書き、git読み取り + `add`/`commit`(ローカルで可逆)
- `npm install`/`run`/`test`、`vitest`/`tsc`/`oxlint`

以下は毎回確認が必要:

- `git push`(特に `--force`)、`git reset --hard`、`git clean`、`rm -rf`、
  `npm publish`、`sudo`、`chmod`

これは「ローカルで完結し取り消せる操作は自動化し、外部に影響する操作・
不可逆な操作は必ず人が確認する」という方針に基づく。さらに緩めたい/
厳しくしたい場合は `.claude/settings.local.json` で個人ごとに調整できる。
