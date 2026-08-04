# @normful/pi-auto-name

Автоматично називає вашу сесію Pi та поверхні мультиплексора термінала на основі розмови。

Підтримує перейменування панелі herdr або вкладки herdr, що містять Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

Також підтримує перейменування вікна tmux, що містить Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

І підтримує перейменування панелі zellij або вкладки zellij, що містять Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

Підтримуються різні мови，наприклад українська：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name скріншот перейменування українською" width="800">
</p>

Список усіх підтримуваних мов：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## Встановлення

```bash
pi install npm:@normful/pi-auto-name
```

## Використання

Розширення повністю автоматичне; нічого не потрібно запускати。

Налаштуйте один раз — і готово。Встановіть і забудьте。

## Як це працює

Після першого введення користувача（або першої події `agent_settled` — див. конфігурацію нижче）перейменовує сесію Pi та перейменовує вміст：

- вікно tmux
- панель herdr та вкладка herdr
- панель zellij та вкладка zellij

Крім того，ви також можете налаштувати безперервне перейменування під час розвитку розмови，налаштувавши `reRenameEveryNTurns`。

## Налаштування

Збережіть конфігурацію в：

- Глобально：`~/.config/pi-auto-name/config.json`（поважає `XDG_CONFIG_HOME`）
- Перевизначення для проєкту：`.pi/pi-auto-name.json`

Повна конфігурація за замовчуванням：

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

Кожен ключ конфігурації є необов'язковим。

## Список конфігурації

| Key | Type | Default | Meaning |
| `enabled` | `boolean` | `true` | `false` повністю вимикає це розширення。 |
| `initialRenameTrigger` | `string` | `"first-input"` | Коли перше перейменування спрацьовує：<br><ul><li>`"first-input"` — після надсилання першого промпту</li><li>`"first-agent-settled"` — після завершення першого запуску LLM（після першої події `agent_settled`）。</li></ul> |
| `language` | `string` | `"en"` | Одне з：`en`、`es`、`de`、`fr`、`it`、`nl`、`pt`/`pt-BR`/`pt-PT`、`id`、`vi`、`tr`、`pl`、`uk`、`fa`、`ar`、`hi`、`zh`/`zh-CN`/`zh-Hans`、`zh-Hant`/`zh-TW`/`zh-HK`、`ja`、`ko`、`th` |
| `namingContextDepth` | `string` | `"recent-user-messages"` | Скільки розмови надсилати до LLM у кожному промпті перейменування：<br><ul><li>`"first-user-message"` — лише перше повідомлення користувача</li><li>`"recent-user-messages"` — перше повідомлення користувача плюс останні 3 повідомлення користувача</li><li>`"full-conversation"` — вся розмова（користувачі，асистенти，виклики інструментів та результати），обмежена ~60k символів із збереженням як початку（основна намір），так і останнього кінця</li></ul> |
| `namingModel` | `string` | `""` | Перевизначення `provider/modelId` для виклику LLM перейменування。Приклад：`"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"`。Залиште порожнім， щоб використовувати налаштовану модель Pi за замовчуванням та постачальника。 |
| `namingStyle` | `string` | `"natural"` | Стиль найменування, що використовується для обох імен：<br><ul><li>`"natural"` — вільне речення</li><li>`"slug"` — маленькі літери, розділені дефісами。</li><li>`"topic-project"` — `<тема>｜<проєкт>`，проєкт, виведений із поточного робочого каталогу</li></ul> |
| `replaceExistingName` | `string` | `"always"` | Коли перезаписувати існуючу назву сесії Pi，назву вікна tmux，назву панелі/вкладки herdr，назву панелі/вкладки zellij：<br><ul><li>`"always"` — завжди перезаписувати</li><li>`"never"` — ніколи не перезаписувати</li></ul> |
| `reRenameEveryNTurns` | `integer` | `0` | Перейменовувати кожні N турів（кожна подія `agent_settled`）。`0` ніколи не перейменовує。 |
| `respectExternalRenames` | `boolean` | `true` | Коли `true`，вимикає перейменування цього розширення після виявлення зовнішнього перейменування（наприклад，після ручного запуску `/name`）。 |
| `sessionNameMaxLength` | `integer` | `200` | Максимальний ліміт символів для назви сесії Pi。 |
| `skipSessionNameDedup` | `boolean` | `false` | `true` пропускає надсилання існуючих назв сесій Pi у промпт перейменування。`false`（за замовчуванням）надсилає до 15 існуючих назв сесій，щоб уникнути дублювання。 |
| `surfaces.renamePiSession` | `boolean` | `true` | `false` вимикає перейменування сесії Pi。 |
| `surfaces.renameHerdrPane` | `boolean` | `true` | `false` вимикає перейменування панелі herdr，в якій працює Pi。 |
| `surfaces.renameHerdrTab` | `boolean` | `true` | `false` вимикає перейменування вкладки herdr，в якій працює цей процес。 |
| `surfaces.renameTmuxWindow` | `boolean` | `true` | `false` вимикає перейменування вікна tmux，в якому працює цей процес。 |
| `surfaces.renameZellijPane` | `boolean` | `true` | `false` вимикає перейменування панелі zellij，в якій працює цей процес。 |
| `surfaces.renameZellijTab` | `boolean` | `true` | `false` вимикає перейменування вкладки zellij，в якій працює цей процес。 |
| `windowNameMaxLength` | `integer` | `30` | Макс символів для кожної назви вікна термінала/панелі（панель/вкладка herdr，вікно tmux，панель/вкладка zellij）。Один із двох повзунків довжини。 |

## Налагодження

Встановіть `PI_AUTO_NAME_DEBUG=1` і розширення додасть структуровані записи `pi-auto-name:debug` до транскрипції сесії та відобразить їх у TUI。（Записи налагодження не надсилаються до LLM。）

## Натхнення

Це розширення натхнене кількома іншими подібними розширеннями：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
