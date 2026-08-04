# @normful/pi-auto-name

بر اساس مکالمه، به‌طور خودکار نام جلسه Pi و سطوح چندپارچه‌ی ترمینال شما را تعیین می‌کند。

از تغییر نام پنل herdr یا تب herdr که Pi را در خود دارد پشتیبانی می‌کند：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

همچنین از تغییر نام پنجره tmux که Pi را در خود دارد پشتیبانی می‌کند：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

و از تغییر نام پنل zellij یا تب zellij که Pi را در خود دارد پشتیبانی می‌کند：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

زبان‌های مختلفی نیز پشتیبانی می‌شوند،مانند فارسی：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name اسکرین‌شات تغییر نام فارسی" width="800">
</p>

فهرست تمام زبان‌های پشتیبانی‌شده：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## نصب

```bash
pi install npm:@normful/pi-auto-name
```

## استفاده

این افزونه کاملاً خودکار است؛ هیچ چیزی برای اجرا نیست。

یک‌بار تنظیم کنید، تمام است。تنظیم کنید و فراموش کنید。

## نحوه کار

پس از اولین ورودی کاربر（یا اولین رویداد `agent_settled` — پیکربندی زیر را ببینید）،نام جلسه Pi را تغییر می‌دهد و موارد زیر را نیز تغییر نام می‌دهد：

- پنجره tmux
- پنل herdr و تب herdr
- پنل zellij و تب zellij

علاوه بر این،می‌توانید آن را طوری پیکربندی کنید که در طول پیشرفت مکالمه به‌طور مداوم نام‌ها را تغییر دهد،با پیکربندی `reRenameEveryNTurns`。

## پیکربندی

پیکربندی را در ذخیره کنید：

- سراسری：`~/.config/pi-auto-name/config.json`（از `XDG_CONFIG_HOME` پیروی می‌کند）
- جایگزین به ازای هر پروژه：`.pi/pi-auto-name.json`

پیکربندی پیش‌فرض کامل：

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

هر کلید پیکربندی اختیاری است。

## مرجع پیکربندی

| Key | Type | Default | Meaning |
| `enabled` | `boolean` | `true` | `false` این افزونه را کاملاً غیرفعال می‌کند。 |
| `initialRenameTrigger` | `string` | `"first-input"` | زمانی که اولین تغییر نام فعال می‌شود：<br><ul><li>`"first-input"` — پس از ارسال اولین prompt</li><li>`"first-agent-settled"` — پس از تکمیل اولین اجرای LLM（پس از اولین رویداد `agent_settled`）。</li></ul> |
| `language` | `string` | `"en"` | یکی از：`en`、`es`、`de`、`fr`、`it`、`nl`、`pt`/`pt-BR`/`pt-PT`、`id`、`vi`、`tr`、`pl`、`uk`、`fa`、`ar`、`hi`、`zh`/`zh-CN`/`zh-Hans`、`zh-Hant`/`zh-TW`/`zh-HK`、`ja`、`ko`、`th` |
| `namingContextDepth` | `string` | `"recent-user-messages"` | مقدار مکالمه‌ای که در هر prompt تغییر نام به LLM ارسال می‌شود：<br><ul><li>`"first-user-message"` — فقط اولین پیام کاربر</li><li>`"recent-user-messages"` — اولین پیام کاربر به همراه آخرین 3 پیام کاربر</li><li>`"full-conversation"` — کل مکالمه（کاربران،دستیارها،فراخوان‌های ابزار و نتایج），محدود به ~60k کاراکتر با حفظ هم بخش شروع（نیت اصلی）و هم آخرین انتهای جدید</li></ul> |
| `namingModel` | `string` | `""` | جایگزینی `provider/modelId` برای فراخوان LLM تغییر نام。مثال：`"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"`。خالی بگذارید تا از مدل و ارائه‌دهنده پیش‌فرض Pi استفاده کنید。 |
| `namingStyle` | `string` | `"natural"` | سبک نام‌گذاری مورد استفاده برای هر دو نام：<br><ul><li>`"natural"` — جمله آزاد</li><li>`"slug"` — حروف کوچک جدا شده با خط تیره。</li><li>`"topic-project"` — `<موضوع>｜<پروژه>`،پروژه استخراج شده از دایرکتوری کار فعلی</li></ul> |
| `replaceExistingName` | `string` | `"always"` | کدام زمان نام فعلی جلسه Pi،نام پنجره tmux،نام پنل/تب herdr،نام پنل/تب zellij را بازنویسی کند：<br><ul><li>`"always"` — همیشه بازنویسی کند</li><li>`"never"` — هرگز بازنویسی نکند</li></ul> |
| `reRenameEveryNTurns` | `integer` | `0` | تغییر نام هر N دور（هر رویداد `agent_settled`）。`0` هرگز تغییر نام نمی‌دهد。 |
| `respectExternalRenames` | `boolean` | `true` | وقتی `true`،تغییر نام این افزونه را پس از تشخیص تغییر نام خارجی غیرفعال می‌کند（مثلاً پس از اجرای دستی `/name`）。 |
| `sessionNameMaxLength` | `integer` | `200` | حداکثر تعداد کاراکتر برای نام جلسه Pi。 |
| `skipSessionNameDedup` | `boolean` | `false` | `true` ارسال نام‌های فعلی جلسه Pi به prompt تغییر نام را نادیده می‌گیرد。`false`（پیش‌فرض）حداکثر 15 نام فعلی جلسه ارسال می‌کند تا از تکرار جلوگیری شود。 |
| `surfaces.renamePiSession` | `boolean` | `true` | `false` تغییر نام جلسه Pi را غیرفعال می‌کند。 |
| `surfaces.renameHerdrPane` | `boolean` | `true` | `false` تغییر نام پنل herdr که Pi در آن اجرا می‌شود را غیرفعال می‌کند。 |
| `surfaces.renameHerdrTab` | `boolean` | `true` | `false` تغییر نام تب herdr که این فرآیند در آن اجرا می‌شود را غیرفعال می‌کند。 |
| `surfaces.renameTmuxWindow` | `boolean` | `true` | `false` تغییر نام پنجره tmux که این فرآیند در آن اجرا می‌شود را غیرفعال می‌کند。 |
| `surfaces.renameZellijPane` | `boolean` | `true` | `false` تغییر نام پنل zellij که این فرآیند در آن اجرا می‌شود را غیرفعال می‌کند。 |
| `surfaces.renameZellijTab` | `boolean` | `true` | `false` تغییر نام تب zellij که این فرآیند در آن اجرا می‌شود را غیرفعال می‌کند。 |
| `windowNameMaxLength` | `integer` | `30` | حداکثر کاراکتر برای هر نام پنجره/پنل ترمینال（پنل/تب herdr،پنجره tmux،پنل/تب zellij）。یکی از دو کنترل‌کننده طول。 |

## عیب‌یابی

`PI_AUTO_NAME_DEBUG=1` را تنظیم کنید و افزونه همچنین ورودی‌های ساختاریافته `pi-auto-name:debug` را به رونویسی جلسه اضافه کرده و در TUI نمایش می‌دهد。（ورودی‌های عیب‌یابی به LLM ارسال نمی‌شوند。）

## الهام‌بخش

این افزونه از چند افزونه مشابه دیگر الهام گرفته است：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
