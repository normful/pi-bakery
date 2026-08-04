# @normful/pi-auto-name

ตั้งชื่อเซสชัน Pi และพื้นผิวของตัวคูณเทอร์มินัลของคุณโดยอัตโนมัติตามบทสนทนา。

รองรับการเปลี่ยนชื่อแผง herdr หรือแท็บ herdr ที่มี Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

รองรับการเปลี่ยนชื่อหน้าต่าง tmux ที่มี Pi ด้วย：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

และรองรับการเปลี่ยนชื่อแผง zellij หรือแท็บ zellij ที่มี Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

รองรับภาษาต่าง ๆ มากมาย，เช่น ภาษาไทย：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name ภาพหน้าจอการเปลี่ยนชื่อภาษาไทย" width="800">
</p>

รายชื่อภาษาทั้งหมดที่รองรับ：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## การติดตั้ง

```bash
pi install npm:@normful/pi-auto-name
```

## การใช้งาน

ส่วนขยายนี้ทำงานอัตโนมัติอย่างสมบูรณ์; ไม่มีอะไรที่ต้องรัน。

ตั้งค่าครั้งเดียวเสร็จแล้ว。ตั้งค่าแล้วลืมไปได้เลย。

## วิธีการทำงาน

หลังจากข้อมูลนำเข้าของผู้ใช้ครั้งแรก（หรือเหตุการณ์ `agent_settled` ครั้งแรก — ดูการกำหนดค่าด้านล่าง）จะเปลี่ยนชื่อเซสชัน Pi และเปลี่ยนชื่อสิ่งที่อยู่ใน：

- หน้าต่าง tmux
- แผง herdr และแท็บ herdr
- แผง zellij และแท็บ zellij

นอกจากนี้ คุณยังสามารถตั้งค่าให้เปลี่ยนชื่ออย่างต่อเนื่องเมื่อบทสนทนาพัฒนาไปได้ โดยการตั้งค่า `reRenameEveryNTurns`。

## การกำหนดค่า

บันทึกการกำหนดค่าที่：

- ทั่วไป：`~/.config/pi-auto-name/config.json`（เคารพ `XDG_CONFIG_HOME`）
- ทับซ้อนตามโปรเจกต์：`.pi/pi-auto-name.json`

การกำหนดค่าเริ่มต้นเต็มรูปแบบ：

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

กุญแจการกำหนดค่าแต่ละรายการเป็นแบบเลือกได้。

## การอ้างอิงการกำหนดค่า

| Key | Type | Default | Meaning |
| `enabled` | `boolean` | `true` | `false` ปิดใช้งานส่วนขยายนี้อย่างสมบูรณ์。 |
| `initialRenameTrigger` | `string` | <code>"first-input"</code> | การเปลี่ยนชื่อครั้งแรกจะถูกเรียกใช้เมื่อใด：<br><ul><li><code>"first-input"</code> — หลังจากส่ง prompt แรก</li><li><code>"first-agent-settled"</code> — หลังจาก LLM รันครั้งแรกเสร็จสิ้น（หลังจากเหตุการณ์ `agent_settled` ครั้งแรก）。</li></ul> |
| `language` | `string` | `"en"` | หนึ่งใน：<code>en</code>、<code>es</code>、<code>de</code>、<code>fr</code>、<code>it</code>、<code>nl</code>、<code>pt</code>/<code>pt-BR</code>/<code>pt-PT</code>、<code>id</code>、<code>vi</code>、<code>tr</code>、<code>pl</code>、<code>uk</code>、<code>fa</code>、<code>ar</code>、<code>hi</code>、<code>zh</code>/<code>zh-CN</code>/<code>zh-Hans</code>、<code>zh-Hant</code>/<code>zh-TW</code>/<code>zh-HK</code>、<code>ja</code>、<code>ko</code>、<code>th</code> |
| `namingContextDepth` | `string` | <code>"recent-user-messages"</code> | ปริมาณบทสนทนาที่ส่งไปยัง LLM ในแต่ละ prompt การเปลี่ยนชื่อ：<br><ul><li><code>"first-user-message"</code> — เฉพาะข้อความแรกของผู้ใช้</li><li><code>"recent-user-messages"</code> — ข้อความแรกของผู้ใช้บวกกับข้อความผู้ใช้ 3 ข้อความล่าสุด</li><li><code>"full-conversation"</code> — บทสนทนาทั้งหมด（ผู้ใช้ ผู้ช่วย การเรียกใช้เครื่องมือและผลลัพธ์）จำกัดที่ ~60k อักขระ โดยคงทั้งส่วนเปิด（เจตนาหลัก）และส่วนท้ายล่าสุด</li></ul> |
| `namingModel` | `string` | <code>""</code> | การเขียนทับ <code>provider/modelId</code> สำหรับการเรียก LLM การเปลี่ยนชื่อ。ตัวอย่าง：<code>"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"</code>。เว้นว่างเพื่อใช้โมเดลและผู้ให้บริการ Pi ค่าเริ่มต้นที่กำหนดค่าไว้。 |
| `namingStyle` | `string` | <code>"natural"</code> | รูปแบบการตั้งชื่อที่ใช้สำหรับทั้งสองชื่อ：<br><ul><li><code>"natural"</code> — ประโยคอิสระ</li><li><code>"slug"</code> — ตัวอักษรเล็กแยกด้วยขีดกลาง。</li><li><code>"topic-project"</code> — `<หัวข้อ>｜<โปรเจกต์>` โปรเจกต์ที่ได้มาจากไดเรกทอรีการทำงานปัจจุบัน</li></ul> |
| `replaceExistingName` | `string` | <code>"always"</code> | เมื่อใดที่จะเขียนทับชื่อเซสชัน Pi ที่มีอยู่ ชื่อหน้าต่าง tmux ชื่อแผง/แท็บ herdr ชื่อแผง/แท็บ zellij：<br><ul><li><code>"always"</code> — เขียนทับเสมอ</li><li><code>"never"</code> — ไม่เคยเขียนทับ</li></ul> |
| `reRenameEveryNTurns` | `integer` | `0` | เปลี่ยนชื่อทุก N รอบ（ทุกเหตุการณ์ `agent_settled`）。`0` ไม่เคยเปลี่ยนชื่อ。 |
| `respectExternalRenames` | `boolean` | `true` | เมื่อ `true` ปิดใช้งานการเปลี่ยนชื่อของส่วนขยายนี้หลังจากตรวจพบการเปลี่ยนชื่อภายนอก（เช่น หลังจากรัน `/name` ด้วยตนเอง）。 |
| `sessionNameMaxLength` | `integer` | `200` | ขีดจำกัดอักขระสูงสุดสำหรับชื่อเซสชัน Pi。 |
| `skipSessionNameDedup` | `boolean` | `false` | `true` ข้ามการส่งชื่อเซสชัน Pi ที่มีอยู่ใน prompt การเปลี่ยนชื่อ。`false`（ค่าเริ่มต้น）ส่งชื่อเซสชันที่มีอยู่ได้สูงสุด 15 ชื่อเพื่อหลีกเลี่ยงการซ้ำกัน。 |
| `surfaces.renamePiSession` | `boolean` | `true` | `false` ปิดใช้งานการเปลี่ยนชื่อเซสชัน Pi。 |
| `surfaces.renameHerdrPane` | `boolean` | `true` | `false` ปิดใช้งานการเปลี่ยนชื่อแผง herdr ที่ Pi กำลังทำงานอยู่。 |
| `surfaces.renameHerdrTab` | `boolean` | `true` | `false` ปิดใช้งานการเปลี่ยนชื่อแท็บ herdr ที่กระบวนการนี้กำลังทำงานอยู่。 |
| `surfaces.renameTmuxWindow` | `boolean` | `true` | `false` ปิดใช้งานการเปลี่ยนชื่อหน้าต่าง tmux ที่กระบวนการนี้กำลังทำงานอยู่。 |
| `surfaces.renameZellijPane` | `boolean` | `true` | `false` ปิดใช้งานการเปลี่ยนชื่อแผง zellij ที่กระบวนการนี้กำลังทำงานอยู่。 |
| `surfaces.renameZellijTab` | `boolean` | `true` | `false` ปิดใช้งานการเปลี่ยนชื่อแท็บ zellij ที่กระบวนการนี้กำลังทำงานอยู่。 |
| `windowNameMaxLength` | `integer` | `30` | สูงสุดอักขระสำหรับชื่อหน้าต่าง/แผงเทอร์มินัลแต่ละรายการ（แผง/แท็บ herdr หน้าต่าง tmux แผง/แท็บ zellij）。หนึ่งในสวิตช์ความยาวสองคัน。 |

## การแก้ปัญหา

ตั้งค่า `PI_AUTO_NAME_DEBUG=1` และส่วนขยายจะเพิ่มรายการ `pi-auto-name:debug` ที่มีโครงสร้างลงในทรานสคริปต์เซสชันและแสดงผลใน TUI。（รายการดีบักจะไม่ถูกส่งไปยัง LLM。）

## แรงบันดาลใจ

ส่วนขยายนี้ได้รับแรงบันดาลใจจากส่วนขยายที่คล้ายกันอื่น ๆ หลายรายการ：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
