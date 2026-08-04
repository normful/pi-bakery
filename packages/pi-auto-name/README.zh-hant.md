# @normful/pi-auto-name

根據對話自動為你的 Pi 会話和終端複用器表面命名。

支持重命名包含 Pi 的 herdr 面板或 herdr 標籤：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

也支持重命名包含 Pi 的 tmux 窗口：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

并且支持重命名包含 Pi 的 zellij 面板或 zellij 標籤：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

也支持多種語言，例如日語：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name 日語重命名截圖" width="800">
</p>

支持的所有語言：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## 安裝

```bash
pi install npm:@normful/pi-auto-name
```

## 使用方法

該擴展完全自動，無需運行任何內容。

配置一次，即可完成。設置後無需再管。

## 工作原理

在第一次用戶輸入（或第一個 `agent_settled` 事件 — 見下方配置）之後，它會重命名 Pi 会話，並重命名包含的：

- tmux 窗口
- herdr 面板和 herdr 標籤
- zellij 面板和 zellij 標籤

此外，你還可以通過配置 `reRenameEveryNTurns` 來讓擴展在對話進行過程中持續重命名。

## 配置

將配置保存到以下位置：

- 全局：`~/.config/pi-auto-name/config.json`（遵循 `XDG_CONFIG_HOME`）
- 項目級覆蓋：`.pi/pi-auto-name.json`

完整默認配置：

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

每個配置鍵都是可選的。

## 配置參考

| Key | Type | Default | Meaning |
| `enabled` | `boolean` | `true` | `false` 完全禁用此擴展。 |
| `initialRenameTrigger` | `string` | `"first-input"` | 第一次重命名觸發時：<br><ul><li>`"first-input"` — 發送第一個提示後</li><li>`"first-agent-settled"` — 第一次 LLM 運行完成後（在第一個 `agent_settled` 事件之後）。</li></ul> |
| `language` | `string` | `"en"` | 可選值：`en`、`es`、`de`、`fr`、`it`、`nl`、`pt`/`pt-BR`/`pt-PT`、`id`、`vi`、`tr`、`pl`、`uk`、`fa`、`ar`、`hi`、`zh`/`zh-CN`/`zh-Hans`、`zh-Hant`/`zh-TW`/`zh-HK`、`ja`、`ko`、`th` |
| `namingContextDepth` | `string` | `"recent-user-messages"` | 每次重命名提示發送給 LLM 的對話量：<br><ul><li>`"first-user-message"` — 僅第一條用戶消息</li><li>`"recent-user-messages"` — 第一條用戶消息加最後 3 條用戶消息</li><li>`"full-conversation"` — 完整對話（用戶、助手、工具調用和結果），限制約 60k 字符，保留開頭（核心意圖）和最新尾部</li></ul> |
| `namingModel` | `string` | `""` | 重命名 LLM 調用的 `provider/modelId` 覆蓋。示例：`"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"`。留空以使用配置的 Pi 默認模型和提供者。 |
| `namingStyle` | `string` | `"natural"` | 兩種名稱使用的命名風格：<br><ul><li>`"natural"` — 自由形式句子</li><li>`"slug"` — 小寫連字符格式。</li><li>`"topic-project"` — `<topic>｜<project>`，項目從當前工作目錄派生</li></ul> |
| `replaceExistingName` | `string` | `"always"` | 何時覆蓋現有 Pi 会話名稱、tmux 窗口名稱、herdr 面板/標籤名稱、zellij 面板/標籤名稱：<br><ul><li>`"always"` — 始終覆蓋</li><li>`"never"` — 從不覆蓋</li></ul> |
| `reRenameEveryNTurns` | `integer` | `0` | 每 N 輪重命名（每個 `agent_settled` 事件）。`0` 表示從不重命名。 |
| `respectExternalRenames` | `boolean` | `true` | 當 `true` 時，在檢測到外部重命名後禁用此擴展的重命名功能（例如手動運行 `/name` 後）。 |
| `sessionNameMaxLength` | `integer` | `200` | Pi 会話名稱的最大字符限制。 |
| `skipSessionNameDedup` | `boolean` | `false` | `true` 跳過在重命名提示中發送現有 Pi 会話名稱。`false`（默認）發送最多 15 個現有會話名稱以避免重複。 |
| `surfaces.renamePiSession` | `boolean` | `true` | `false` 禁用 Pi 会話重命名。 |
| `surfaces.renameHerdrPane` | `boolean` | `true` | `false` 禁用 Pi 運行的 herdr 面板重命名。 |
| `surfaces.renameHerdrTab` | `boolean` | `true` | `false` 禁用此進程運行的 herdr 標籤重命名。 |
| `surfaces.renameTmuxWindow` | `boolean` | `true` | `false` 禁用此進程運行的 tmux 窗口重命名。 |
| `surfaces.renameZellijPane` | `boolean` | `true` | `false` 禁用此進程運行的 zellij 面板重命名。 |
| `surfaces.renameZellijTab` | `boolean` | `true` | `false` 禁用此進程運行的 zellij 標籤重命名。 |
| `windowNameMaxLength` | `integer` | `30` | 每個終端/框架窗口名稱的最大字符數（herdr 面板/標籤、tmux 窗口、zellij 面板/標籤）。兩個長度調節旋钮之一。 |

## 調試

設置 `PI_AUTO_NAME_DEBUG=1`，擴展將在會話轉錄中追加結構化的 `pi-auto-name:debug` 條目並在 TUI 中渲染它們。（調試條目不會發送給 LLM。）

## 靈感來源

本擴展受以下類似擴展的啟發：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
