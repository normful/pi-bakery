# @normful/pi-auto-name

会話に基づいて、Pi セッションとターミナルマルチプレクサの表面に自動的に名前を付けます。

Pi を含む herdr パネルや herdr タブの名前を変更するサポート：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

Pi を含む tmux ウィンドウの名前を変更するサポートも：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

Pi を含む zellij パネルや zellij タブの名前を変更するサポートも：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

日本語など、さまざまな言語がサポートされています：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name 日本語リネームスクリーンショット" width="800">
</p>

サポートされている言語一覧：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## インストール

```bash
pi install npm:@normful/pi-auto-name
```

## 使用方法

この拡張機能は完全に自動です。実行するものはありません。

一度設定するだけで完了です。設定して忘れてください。

## 動作方法

最初のユーザー入力（または最初の `agent_settled` イベント — 以下の構成を参照）の後、Pi セッションの名前を変更し、含まれるものの名前も変更します：

- tmux ウィンドウ
- herdr パネルと herdr タブ
- zellij パネルと zellij タブ

また、`reRenameEveryNTurns` を構成して、会話が進行するにつれて拡張機能が継続的に名前を変更するようにすることもできます。

## 構成

設定を以下に保存します：

- グローバル：`~/.config/pi-auto-name/config.json`（`XDG_CONFIG_HOME` を尊重）
- プロジェクト別オーバーライド：`.pi/pi-auto-name.json`

完全なデフォルト構成：

```json
{
  "enabled": true,
  "initialRenameTrigger": "first-input",
  "language": "en",
  "namingContextDepth": "recent-user-messages",
  "namingModel": "",
  "namingStyle": "natural",
  "replaceExistingName": "always",
  "reRenameEveryNTurns": 0,
  "respectExternalRenames": true,
  "sessionNameMaxLength": 200,
  "skipSessionNameDedup": false,
  "surfaces": {
    "renameHerdrPane": true,
    "renameHerdrTab": true,
    "renamePiSession": true,
    "renameTmuxWindow": true,
    "renameZellijPane": true,
    "renameZellijTab": true
  },
  "windowNameMaxLength": 30
}
```

すべての構成キーはオプションです。

## 構成リファレンス

| Key | Type | Default | Meaning |
| `enabled` | `boolean` | `true` | `false` はこの拡張機能を完全に無効にします。 |
| `initialRenameTrigger` | `string` | <code>"first-input"</code> | 最初のリネームが発火するタイミング：<br><ul><li><code>"first-input"</code> — 最初のプロンプトを送信した後</li><li><code>"first-agent-settled"</code> — 最初の LLM 実行が完了した後（最初の `agent_settled` イベントの後）。</li></ul> |
| `language` | `string` | `"en"` | 以下のいずれか：<code>en</code>、<code>es</code>、<code>de</code>、<code>fr</code>、<code>it</code>、<code>nl</code>、<code>pt</code>/<code>pt-BR</code>/<code>pt-PT</code>、<code>id</code>、<code>vi</code>、<code>tr</code>、<code>pl</code>、<code>uk</code>、<code>fa</code>、<code>ar</code>、<code>hi</code>、<code>zh</code>/<code>zh-CN</code>/<code>zh-Hans</code>、<code>zh-Hant</code>/<code>zh-TW</code>/<code>zh-HK</code>、<code>ja</code>、<code>ko</code>、<code>th</code> |
| `namingContextDepth` | `string` | <code>"recent-user-messages"</code> | 各リネームプロンプトで LLM に送信する会話の量：<br><ul><li><code>"first-user-message"</code> — 最初のユーザーメッセージのみ</li><li><code>"recent-user-messages"</code> — 最初のユーザーメッセージと最後の 3 件のユーザーメッセージ</li><li><code>"full-conversation"</code> — 会話全体（ユーザー、アシスタント、ツール呼び出しと結果）、約 60k 文字に制限し、冒頭（コア意図）と最新の末尾の両方を保持</li></ul> |
| `namingModel` | `string` | <code>""</code> | リネーム LLM 呼び出しの <code>provider/modelId</code> オーバーライド。例：<code>"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"</code>。空のままにして、構成済みの Pi デフォルトモデルとプロバイダーを使用してください。 |
| `namingStyle` | `string` | <code>"natural"</code> | 両方の名前に使用される命名スタイル：<br><ul><li><code>"natural"</code> — 自由形式の文</li><li><code>"slug"</code> — 小文字のハイフン区切り。</li><li><code>"topic-project"</code> — `<topic>｜<project>`、現在の作業ディレクトリから派生したプロジェクト</li></ul> |
| `replaceExistingName` | `string` | <code>"always"</code> | 既存の Pi セッション名、tmux ウィンドウ名、herdr パネル/タブ名、zellij パネル/タブ名をいつ上書きするか：<br><ul><li><code>"always"</code> — 常に上書き</li><li><code>"never"</code> — 上書きしない</li></ul> |
| `reRenameEveryNTurns` | `integer` | `0` | N 回ごとにリネーム（各 `agent_settled` イベント）。`0` はリネームしません。 |
| `respectExternalRenames` | `boolean` | `true` | `true` の場合、外部リネームが検出された後にこの拡張機能のリネームを無効にします（例：手動で `/name` を実行した後）。 |
| `sessionNameMaxLength` | `integer` | `200` | Pi セッション名の最大文字数制限。 |
| `skipSessionNameDedup` | `boolean` | `false` | `true` はリネームプロンプトに既存の Pi セッション名を送信しないようにします。`false`（デフォルト）は重複を避けるために最大 15 個の既存セッション名を送信します。 |
| `surfaces.renamePiSession` | `boolean` | `true` | `false` は Pi セッションのリネームを無効にします。 |
| `surfaces.renameHerdrPane` | `boolean` | `true` | `false` は Pi が実行中の herdr パネルのリネームを無効にします。 |
| `surfaces.renameHerdrTab` | `boolean` | `true` | `false` はこのプロセスが実行中の herdr タブのリネームを無効にします。 |
| `surfaces.renameTmuxWindow` | `boolean` | `true` | `false` はこのプロセスが実行中の tmux ウィンドウのリネームを無効にします。 |
| `surfaces.renameZellijPane` | `boolean` | `true` | `false` はこのプロセスが実行中の zellij パネルのリネームを無効にします。 |
| `surfaces.renameZellijTab` | `boolean` | `true` | `false` はこのプロセスが実行中の zellij タブのリネームを無効にします。 |
| `windowNameMaxLength` | `integer` | `30` | 各ターミナル/フレームウィンドウ名の最大文字数（herdr パネル/タブ、tmux ウィンドウ、zellij パネル/タブ）。2 つの長さ調整ノブのうちの 1 つ。 |

## デバッグ

`PI_AUTO_NAME_DEBUG=1` を設定すると、拡張機能はセッション転記に構造化された `pi-auto-name:debug` エントリを追加し、TUI でレンダリングします。（デバッグエントリは LLM に送信されません。）

## インスピレーション

この拡張機能は、いくつかの他の類似拡張機能にインスピレーションを得ています：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
