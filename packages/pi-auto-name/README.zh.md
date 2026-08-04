# @normful/pi-auto-name

根据对话自动为你的 Pi 会话和终端复用器表面命名。

支持重命名包含 Pi 的 herdr 面板或 herdr 标签：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

也支持重命名包含 Pi 的 tmux 窗口：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

并且支持重命名包含 Pi 的 zellij 面板或 zellij 标签：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

也支持多种语言，例如日语：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name 日语重命名截图" width="800">
</p>

支持的所有语言：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## 安装

```bash
pi install npm:@normful/pi-auto-name
```

## 使用方法

该扩展完全自动，无需运行任何内容。

配置一次，即可完成。设置后无需再管。

## 工作原理

在第一次用户输入（或第一个 `agent_settled` 事件 — 见下方配置）之后，它会重命名 Pi 会话，并重命名包含的：

- tmux 窗口
- herdr 面板和 herdr 标签
- zellij 面板和 zellij 标签

此外，你还可以通过配置 `reRenameEveryNTurns` 来让扩展在对话进行过程中持续重命名。

## 配置

将配置保存到以下位置：

- 全局：`~/.config/pi-auto-name/config.json`（遵循 `XDG_CONFIG_HOME`）
- 项目级覆盖：`.pi/pi-auto-name.json`

完整默认配置：

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

每个配置键都是可选的。

## 配置参考

| Key                         | Type      | Default                             | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------- | --------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                   | `boolean` | `true`                              | `false` 完全禁用此扩展。                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `initialRenameTrigger`      | `string`  | <code>"first-input"</code>          | 第一次重命名触发时：<br><ul><li><code>"first-input"</code> — 发送第一个提示后</li><li><code>"first-agent-settled"</code> — 第一次 LLM 运行完成后（在第一个 `agent_settled` 事件之后）。</li></ul>                                                                                                                                                                                                                                                                                   |
| `language`                  | `string`  | `"en"`                              | 可选值：<code>en</code>、<code>es</code>、<code>de</code>、<code>fr</code>、<code>it</code>、<code>nl</code>、<code>pt</code>/<code>pt-BR</code>/<code>pt-PT</code>、<code>id</code>、<code>vi</code>、<code>tr</code>、<code>pl</code>、<code>uk</code>、<code>fa</code>、<code>ar</code>、<code>hi</code>、<code>zh</code>/<code>zh-CN</code>/<code>zh-Hans</code>、<code>zh-Hant</code>/<code>zh-TW</code>/<code>zh-HK</code>、<code>ja</code>、<code>ko</code>、<code>th</code> |
| `namingContextDepth`        | `string`  | <code>"recent-user-messages"</code> | 每次重命名提示发送给 LLM 的对话量：<br><ul><li><code>"first-user-message"</code> — 仅第一条用户消息</li><li><code>"recent-user-messages"</code> — 第一条用户消息加最后 3 条用户消息</li><li><code>"full-conversation"</code> — 完整对话（用户、助手、工具调用和结果），限制约 60k 字符，保留开头（核心意图）和最新尾部</li></ul>                                                                                                                                                    |
| `namingModel`               | `string`  | <code>""</code>                     | 重命名 LLM 调用的 <code>provider/modelId</code> 覆盖。示例：<code>"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"</code>。留空以使用配置的 Pi 默认模型和提供者。                                                                                                                                                                                                                                                                                                                   |
| `namingStyle`               | `string`  | <code>"natural"</code>              | 两种名称使用的命名风格：<br><ul><li><code>"natural"</code> — 自由形式句子</li><li><code>"slug"</code> — 小写连字符格式。</li><li><code>"topic-project"</code> — `<topic>｜<project>`，项目从当前工作目录派生</li></ul>                                                                                                                                                                                                                                                              |
| `replaceExistingName`       | `string`  | <code>"always"</code>               | 何时覆盖现有 Pi 会话名称、tmux 窗口名称、herdr 面板/标签名称、zellij 面板/标签名称：<br><ul><li><code>"always"</code> — 始终覆盖</li><li><code>"never"</code> — 从不覆盖</li></ul>                                                                                                                                                                                                                                                                                                  |
| `reRenameEveryNTurns`       | `integer` | `0`                                 | 每 N 轮重命名（每个 `agent_settled` 事件）。`0` 表示从不重命名。                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `respectExternalRenames`    | `boolean` | `true`                              | 当 `true` 时，在检测到外部重命名后禁用此扩展的重命名功能（例如手动运行 `/name` 后）。                                                                                                                                                                                                                                                                                                                                                                                               |
| `sessionNameMaxLength`      | `integer` | `200`                               | Pi 会话名称的最大字符限制。                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `skipSessionNameDedup`      | `boolean` | `false`                             | `true` 跳过在重命名提示中发送现有 Pi 会话名称。`false`（默认）发送最多 15 个现有会话名称以避免重复。                                                                                                                                                                                                                                                                                                                                                                                |
| `surfaces.renamePiSession`  | `boolean` | `true`                              | `false` 禁用 Pi 会话重命名。                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `surfaces.renameHerdrPane`  | `boolean` | `true`                              | `false` 禁用 Pi 运行的 herdr 面板重命名。                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `surfaces.renameHerdrTab`   | `boolean` | `true`                              | `false` 禁用此进程运行的 herdr 标签重命名。                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `surfaces.renameTmuxWindow` | `boolean` | `true`                              | `false` 禁用此进程运行的 tmux 窗口重命名。                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `surfaces.renameZellijPane` | `boolean` | `true`                              | `false` 禁用此进程运行的 zellij 面板重命名。                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `surfaces.renameZellijTab`  | `boolean` | `true`                              | `false` 禁用此进程运行的 zellij 标签重命名。                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `windowNameMaxLength`       | `integer` | `30`                                | 每个终端/框架窗口名称的最大字符数（herdr 面板/标签、tmux 窗口、zellij 面板/标签）。两个长度调节旋钮之一。                                                                                                                                                                                                                                                                                                                                                                           |

## 调试

设置 `PI_AUTO_NAME_DEBUG=1`，扩展将在会话转录中追加结构化的 `pi-auto-name:debug` 条目并在 TUI 中渲染它们。（调试条目不会发送给 LLM。）

## 灵感来源

本扩展受以下类似扩展的启发：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
