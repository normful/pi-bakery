# @normful/pi-auto-name

Automatically names your Pi session and terminal multiplexer surfaces from the conversation.

Supports renaming a herdr pane or herdr tab containing Pi:

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

Also supports renaming a tmux window containing Pi:

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

And supports renaming a zellij pane or zellij tab containing Pi:

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

Various languages are supported too, such as Japanese:

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name Japanese renaming screenshot" width="800">
</p>

List of all supported human languages: English, Español, Deutsch, Français, Italiano,
Nederlands, Português, Bahasa Indonesia, Tiếng Việt, Türkçe, Polski,
Українська, فارسی, العربية, हिन्दी, 简体中文, 繁體中文, 日本語, 한국어, ไทย

## Installation

```bash
pi install npm:@normful/pi-auto-name
```

## Usage

The extension is fully automatic; there is nothing to run.

Configure it once, and that's it. Set it and forget it.

## How It Works

After the first user input (or the first `agent_settled` event — see config
below), it renames the Pi session and renames the containing:

- tmux window
- herdr pane and herdr tab
- zellij pane and zellij tab

Additionally, you can also configure it to continually rename as the conversation evolves, by configuring `reRenameEveryNTurns`.

## Configuration

Save config to either:

- Globally: `~/.config/pi-auto-name/config.json` (respects `XDG_CONFIG_HOME`)
- Per-project override: `.pi/pi-auto-name.json`

Full default configuration:

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

Every configuration key is optional.

## Configuration Reference

| Key                         | Type      | Default                  | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | --------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                   | `boolean` | `true`                   | `false` disables this extension entirely.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `initialRenameTrigger`      | `string`  | `"first-input"`          | When the first rename fires:<br><ul><li><code>"first-input"</code> — after you send first prompt</li><li><code>"first-agent-settled"</code> — after the first LLM run finishes (after the first `agent_settled` event).</li></ul>                                                                                                                                                                                                                         |
| `language`                  | `string`  | `"en"`                   | One of: `en`, `es`, `de`, `fr`, `it`, `nl`, `pt`/`pt-BR`/`pt-PT`, `id`, `vi`, `tr`, `pl`, `uk`, `fa`, `ar`, `hi`, `zh`/`zh-CN`/`zh-Hans`, `zh-Hant`/`zh-TW`/`zh-HK`, `ja`, `ko`, `th`                                                                                                                                                                                                                                                                     |
| `namingContextDepth`        | `string`  | `"recent-user-messages"` | How much of the conversation to send to LLM in each renaming prompt:<br><ul><li><code>"first-user-message"</code> — only the first user message</li><li><code>"recent-user-messages"</code> — first user message plus the last 3 user messages</li><li><code>"full-conversation"</code> — the whole conversation (users, assistants, tool calls &amp; results), capped to ~60k chars keeping both the opening (core intent) and the latest tail</li></ul> |
| `namingModel`               | `string`  | `""`                     | `provider/modelId` override for the naming LLM call. Example: `"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"`. Leave empty to use your configured Pi default model and provider.                                                                                                                                                                                                                                                                       |
| `namingStyle`               | `string`  | `"natural"`              | The naming style used for both names:<br><ul><li><code>"natural"</code> — free-form sentence</li><li><code>"slug"</code> — lowercase kebab-case.</li><li><code>"topic-project"</code> — <code>&lt;topic&gt;｜&lt;project&gt;</code>, project derived from current working directory</li></ul>                                                                                                                                                             |
| `replaceExistingName`       | `string`  | `"always"`               | When to overwrite an existing Pi session name, tmux window name, herdr pane/tab name, zellij pane/tab name:<br><ul><li><code>"always"</code> — always overwrite</li><li><code>"never"</code> — never overwrite</li></ul>                                                                                                                                                                                                                                  |
| `reRenameEveryNTurns`       | `integer` | `0`                      | Re-rename every N turns (every N `agent_settled` events). `0` never re-renames.                                                                                                                                                                                                                                                                                                                                                                           |
| `respectExternalRenames`    | `boolean` | `true`                   | When `true`, disables this extension's renaming after an external rename is detected (e.g. after you manually run `/name`)                                                                                                                                                                                                                                                                                                                                |
| `sessionNameMaxLength`      | `integer` | `200`                    | Max character limit for the Pi session name.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `skipSessionNameDedup`      | `boolean` | `false`                  | `true` skips sending existing Pi session names into the renaming prompt. `false` (default) sends up to 15 existing session names as names to avoid duplicating.                                                                                                                                                                                                                                                                                           |
| `surfaces.renamePiSession`  | `boolean` | `true`                   | `false` disables renaming of Pi session                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `surfaces.renameHerdrPane`  | `boolean` | `true`                   | `false` disables renaming of the herdr pane Pi is running in                                                                                                                                                                                                                                                                                                                                                                                              |
| `surfaces.renameHerdrTab`   | `boolean` | `true`                   | `false` disables renaming of the herdr tab this process runs in.                                                                                                                                                                                                                                                                                                                                                                                          |
| `surfaces.renameTmuxWindow` | `boolean` | `true`                   | `false` disables renaming of the tmux window this process runs in.                                                                                                                                                                                                                                                                                                                                                                                        |
| `surfaces.renameZellijPane` | `boolean` | `true`                   | `false` disables renaming of the zellij pane this process runs in.                                                                                                                                                                                                                                                                                                                                                                                        |
| `surfaces.renameZellijTab`  | `boolean` | `true`                   | `false` disables renaming of the zellij tab this process runs in.                                                                                                                                                                                                                                                                                                                                                                                         |
| `windowNameMaxLength`       | `integer` | `30`                     | Max chars for every terminal/frame window name (herdr pane/tab, tmux window, zellij pane/tab). One of the two length knobs.                                                                                                                                                                                                                                                                                                                               |

## Debugging

Set `PI_AUTO_NAME_DEBUG=1` and the extension will both append structured `pi-auto-name:debug` entries to
the session transcript and render them in the TUI. (The debug entries are not sent to the LLM.)

## Inspiration

This extension is inspired by several other similar extensions:

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
