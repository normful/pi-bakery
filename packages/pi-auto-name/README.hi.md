# @normful/pi-auto-name

बातचीत के आधार पर अपनी Pi सत्र और टर्मिनल मल्टीप्लेक्सर सतहों को स्वचालित रूप से नाम देता है।

Pi युक्त herdr पैनल या herdr टैब का नाम बदलने का समर्थन करता है：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

Pi युक्त tmux विंडो का नाम बदलने का समर्थन भी करता है：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

और Pi युक्त zellij पैनल या zellij टैब का नाम बदलने का समर्थन करता है：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

जापानी सहित विभिन्न भाषाएं समर्थित हैं：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name हिंदी नाम बदलने का स्क्रीनशॉट" width="800">
</p>

सभी समर्थित भाषाओं की सूची：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## स्थापना

```bash
pi install npm:@normful/pi-auto-name
```

## उपयोग

यह एक्सटेंशन पूर्णतः स्वचालित है; कुछ भी चलाने की आवश्यकता नहीं।

एक बार कॉन्फ़िगर करें, और यहीं तक।सेट करें और भूल जाएं।

## यह कैसे काम करता है

पहले उपयोगकर्ता इनपुट के बाद（या पहले `agent_settled` घटना के बाद — नीचे कॉन्फ़िगरेशन देखें），यह Pi सत्र का नाम बदलता है और निम्नलिखित का नाम बदलता है：

- tmux विंडो
- herdr पैनल और herdr टैब
- zellij पैनल और zellij टैब

इसके अलावा，आप `reRenameEveryNTurns` कॉन्फ़िगर करके बातचीत के विकसित होने के साथ निरंतर नाम बदलने के लिए इसे कॉन्फ़िगर कर सकते हैं।

## कॉन्फ़िगरेशन

कॉन्फ़िगरेशन इसमें सेव करें：

- वैश्विक：`~/.config/pi-auto-name/config.json`（`XDG_CONFIG_HOME` का सम्मान करता है）
- प्रति-परियोजना ओवरराइड：`.pi/pi-auto-name.json`

पूर्ण डिफ़ॉल्ट कॉन्फ़िगरेशन：

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

प्रत्येक कॉन्फ़िगरेशन कुंजी वैकल्पिक है।

## कॉन्फ़िगरेशन संदर्भ

| Key | Type | Default | Meaning |
| `enabled` | `boolean` | `true` | `false` इस एक्सटेंशन को पूरी तरह से अक्षम कर देता है। |
| `initialRenameTrigger` | `string` | <code>"first-input"</code> | पहला नाम बदलना कब ट्रिगर होता है：<br><ul><li><code>"first-input"</code> — पहला prompt भेजने के बाद</li><li><code>"first-agent-settled"</code> — पहला LLM रन पूरा होने के बाद（पहली `agent_settled` घटना के बाद）。</li></ul> |
| `language` | `string` | `"en"` | इनमें से एक：<code>en</code>、<code>es</code>、<code>de</code>、<code>fr</code>、<code>it</code>、<code>nl</code>、<code>pt</code>/<code>pt-BR</code>/<code>pt-PT</code>、<code>id</code>、<code>vi</code>、<code>tr</code>、<code>pl</code>、<code>uk</code>、<code>fa</code>、<code>ar</code>、<code>hi</code>、<code>zh</code>/<code>zh-CN</code>/<code>zh-Hans</code>、<code>zh-Hant</code>/<code>zh-TW</code>/<code>zh-HK</code>、<code>ja</code>、<code>ko</code>、<code>th</code> |
| `namingContextDepth` | `string` | <code>"recent-user-messages"</code> | प्रत्येक नाम बदलने वाले prompt में LLM को कितनी बातचीत भेजी जाती है：<br><ul><li><code>"first-user-message"</code> — केवल पहला उपयोगकर्ता संदेश</li><li><code>"recent-user-messages"</code> — पहला उपयोगकर्ता संदेश अंतिम 3 उपयोगकर्ता संदेशों के साथ</li><li><code>"full-conversation"</code> — पूरी बातचीत（उपयोगकर्ता，सहायक，टूल कॉल और परिणाम），लगभग 60k अक्षरों तक सीमित，जिसमें शुरुआत（मुख्य इरादा）और नवीनतम अंत दोनों को बनाए रखा गया है</li></ul> |
| `namingModel` | `string` | <code>""</code> | नाम बदलने वाले LLM कॉल के लिए <code>provider/modelId</code> ओवरराइड।उदाहरण：<code>"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"</code>।खाली छोड़ें ताकि कॉन्फ़िगर्ड Pi डिफ़ॉल्ट मॉडल और प्रदाता का उपयोग किया जा सके। |
| `namingStyle` | `string` | <code>"natural"</code> | दोनों नामों के लिए उपयोग किया जाने वाला नामकरण शैली：<br><ul><li><code>"natural"</code> — स्वतंत्र वाक्य</li><li><code>"slug"</code> — छोटे अक्षर हाइफ़न से अलग।</li><li><code>"topic-project"</code> — `<विषय>｜<परियोजना>`，वर्तमान कार्य निर्देशिका से व्युत्पन्न परियोजना</li></ul> |
| `replaceExistingName` | `string` | <code>"always"</code> | मौजूदा Pi सत्र नाम，tmux विंडो नाम，herdr पैनल/टैब नाम，zellij पैनल/टैब नाम को कब अधिलेखित किया जाए：<br><ul><li><code>"always"</code> — हमेशा अधिलेखित करें</li><li><code>"never"</code> — कभी अधिलेखित न करें</li></ul> |
| `reRenameEveryNTurns` | `integer` | `0` | हर N टर्न में पुनः नाम बदलें（हर `agent_settled` घटना）。`0` कभी पुनः नाम नहीं बदलता। |
| `respectExternalRenames` | `boolean` | `true` | जब `true`，बाहरी नाम बदलने का पता लगाने के बाद इस एक्सटेंशन का नाम बदलने को अक्षम कर देता है（जैसे，मैन्युअल रूप से `/name` चलाने के बाद）。 |
| `sessionNameMaxLength` | `integer` | `200` | Pi सत्र नाम के लिए अधिकतम अक्षर सीमा। |
| `skipSessionNameDedup` | `boolean` | `false` | `true` नाम बदलने वाले prompt में मौजूदा Pi सत्र नाम भेजने को छोड़ देता है।`false`（डिफ़ॉल्ट）डुप्लिकेट से बचने के लिए अधिकतम 15 मौजूदा सत्र नाम भेजता है। |
| `surfaces.renamePiSession` | `boolean` | `true` | `false` Pi सत्र नाम बदलने को अक्षम कर देता है। |
| `surfaces.renameHerdrPane` | `boolean` | `true` | `false` Pi चल रहे herdr पैनल का नाम बदलने को अक्षम कर देता है। |
| `surfaces.renameHerdrTab` | `boolean` | `true` | `false` इस प्रक्रिया के चल रहे herdr टैब का नाम बदलने को अक्षम कर देता है। |
| `surfaces.renameTmuxWindow` | `boolean` | `true` | `false` इस प्रक्रिया के चल रहे tmux विंडो का नाम बदलने को अक्षम कर देता है। |
| `surfaces.renameZellijPane` | `boolean` | `true` | `false` इस प्रक्रिया के चल रहे zellij पैनल का नाम बदलने को अक्षम कर देता है। |
| `surfaces.renameZellijTab` | `boolean` | `true` | `false` इस प्रक्रिया के चल रहे zellij टैब का नाम बदलने को अक्षम कर देता है। |
| `windowNameMaxLength` | `integer` | `30` | प्रत्येक टर्मिनल/फ्रेम विंडो नाम के लिए अधिकतम अक्षर（herdr पैनल/टैब，tmux विंडो，zellij पैनल/टैब）。दो लंबाई नियंत्रणों में से एक। |

## डिबगging

`PI_AUTO_NAME_DEBUG=1` सेट करें और एक्सटेंशन सत्र ट्रांसक्रिप्ट में संरचित `pi-auto-name:debug` प्रविष्टियां जोड़ेगा और TUI में उन्हें प्रस्तुत करेगा。（डिबग प्रविष्टियां LLM को भेजी नहीं जातीं。）

## प्रेरणा

यह एक्सटेंशन कई अन्य समान एक्सटेंशन से प्रेरित है：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
