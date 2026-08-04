# @normful/pi-auto-name

يقوم تلقائيًا بتسمية جلسة Pi الخاصة بك وأسطح وحدة تعدد الطرفية الخاصة بك بناءً على المحادثة。

يدعم إعادة تسمية لوحة herdr أو تبويب herdr الذي يحتوي على Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

يدعم أيضًا إعادة تسمية نافذة tmux التي تحتوي على Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

ويدعم أيضًا إعادة تسمية لوحة zellij أو تبويب zellij الذي يحتوي على Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

تدعم أيضًا لغات متنوعة،مثل العربية：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name لقطة شاشة إعادة التسمية بالعربية" width="800">
</p>

قائمة جميع اللغات المدعومة：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## التثبيت

```bash
pi install npm:@normful/pi-auto-name
```

## الاستخدام

الإضافة تلقائية بالكامل؛ لا يوجد شيء لتشغيله。

قم بالإعداد مرة واحدة،وانتهي الأمر。اضبطها وانسَه。

## كيف يعمل

بعد أول إدخال من المستخدم（أو أول حدث `agent_settled` — انظر التكوين أدناه）،يقوم بإعادة تسمية جلسة Pi وإعادة تسمية المحتويات：

- نافذة tmux
- لوحة herdr وتبويب herdr
- لوحة zellij وتبويب zellij

بالإضافة إلى ذلك،يمكنك أيضًا تكوينها لإعادة التسمية باستمرار أثناء تطور المحادثة،عن طريق تكوين `reRenameEveryNTurns`。

## التكوين

احفظ التكوين في：

- عام：`~/.config/pi-auto-name/config.json`（يحترم `XDG_CONFIG_HOME`）
- تجاوز لكل مشروع：`.pi/pi-auto-name.json`

التكوين الافتراضي الكامل：

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

مفتاح التكوين كله اختياري。

## مرجع التكوين

| Key | Type | Default | Meaning |
| `enabled` | `boolean` | `true` | `false` يعطل هذا الإضافة بالكامل。 |
| `initialRenameTrigger` | `string` | `"first-input"` | متى يتم تشغيل إعادة التسمية الأولى：<br><ul><li>`"first-input"` — بعد إرسال أول prompt</li><li>`"first-agent-settled"` — بعد اكتمال أول تشغيل LLM（بعد أول حدث `agent_settled`）。</li></ul> |
| `language` | `string` | `"en"` | أحد：`en`、`es`、`de`、`fr`、`it`、`nl`、`pt`/`pt-BR`/`pt-PT`、`id`、`vi`、`tr`、`pl`、`uk`、`fa`、`ar`、`hi`、`zh`/`zh-CN`/`zh-Hans`、`zh-Hant`/`zh-TW`/`zh-HK`、`ja`、`ko`、`th` |
| `namingContextDepth` | `string` | `"recent-user-messages"` | كمية المحادثة التي يتم إرسالها إلى LLM في كل prompt إعادة تسمية：<br><ul><li>`"first-user-message"` — رسالة المستخدم الأولى فقط</li><li>`"recent-user-messages"` — رسالة المستخدم الأولى بالإضافة إلى آخر 3 رسائل مستخدم</li><li>`"full-conversation"` — المحادثة بالكامل（المستخدمون،المساعدون،استدعاءات الأدوات والنتائج），محدودة بـ ~60k حرف مع الحفاظ على كل من البداية（النية الرئيسية）والنهاية الأحدث</li></ul> |
| `namingModel` | `string` | `""` | تجاوز `provider/modelId` لاستدعاء LLM إعادة التسمية。مثال：`"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"`。اتركه فارغًا لاستخدام نموذج Pi الافتراضي والمزود المُعدّ。 |
| `namingStyle` | `string` | `"natural"` | نمط التسمية المستخدم لكلا الاسمين：<br><ul><li>`"natural"` — جملة حرة</li><li>`"slug"` — أحرف صغيرة مفصولة بشرطات。</li><li>`"topic-project"` — `<الموضوع>｜<المشروع>`،المشروع المستمد من دليل العمل الحالي</li></ul> |
| `replaceExistingName` | `string` | `"always"` |متى يتم استبدال اسم جلسة Pi الحالي،واسم نافذة tmux،واسم لوحة/تبويب herdr،واسم لوحة/تبويب zellij：<br><ul><li>`"always"` — دائمًا استبدال</li><li>`"never"` — لا استبدال أبدًا</li></ul> |
| `reRenameEveryNTurns` | `integer` | `0` | إعادة التسمية كل N جولات（كل حدث `agent_settled`）。`0` لا يعيد التسمية أبدًا。 |
| `respectExternalRenames` | `boolean` | `true` | عند `true`،يعطل إعادة تسمية هذا الإضافة بعد اكتشاف إعادة تسمية خارجية（مثلاً بعد تشغيل `/name` يدويًا）。 |
| `sessionNameMaxLength` | `integer` | `200` | الحد الأقصى لعدد الأحرف لاسم جلسة Pi。 |
| `skipSessionNameDedup` | `boolean` | `false` | `true` يتخطى إرسال أسماء جلسات Pi الحالية إلى prompt إعادة التسمية。`false`（افتراضي）يرسل ما يصل إلى 15 اسم جلسة حالي لتجنب التكرار。 |
| `surfaces.renamePiSession` | `boolean` | `true` | `false` يعطل إعادة تسمية جلسة Pi。 |
| `surfaces.renameHerdrPane` | `boolean` | `true` | `false` يعطل إعادة تسمية لوحة herdr التي يعمل فيها Pi。 |
| `surfaces.renameHerdrTab` | `boolean` | `true` | `false` يعطل إعادة تسمية تبويب herdr الذي يعمل فيه هذا الإجراء。 |
| `surfaces.renameTmuxWindow` | `boolean` | `true` | `false` يعطل إعادة تسمية نافذة tmux التي يعمل فيها هذا الإجراء。 |
| `surfaces.renameZellijPane` | `boolean` | `true` | `false` يعطل إعادة تسمية لوحة zellij التي يعمل فيها هذا الإجراء。 |
| `surfaces.renameZellijTab` | `boolean` | `true` | `false` يعطل إعادة تسمية تبويب zellij الذي يعمل فيه هذا الإجراء。 |
| `windowNameMaxLength` | `integer` | `30` | أقصى عدد من الأحرف لاسم كل نافذة/لوحة طرفية（لوحة/تبويب herdr،نافذة tmux،لوحة/تبويب zellij）。واحد من مفاتيح الطول الاثنين。 |

## التصحيح

قم بتعيين `PI_AUTO_NAME_DEBUG=1` وستضيف الإضافة إدخالات `pi-auto-name:debug` منظمة إلى نسخ المحادثة وعرضها في TUI。（لا يتم إرسال إدخالات التصحيح إلى LLM。）

## الإلهام

هذه الإضافة مستوحاة من عدة إضافات مشابهة أخرى：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
