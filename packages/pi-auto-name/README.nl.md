# @normful/pi-auto-name

Benoemt automatisch je Pi-sessie en terminal-multiplexer oppervlakken op basis van het gesprek。

Ondersteunt het hernoemen van een herdr-paneel of herdr-tab met Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

Ondersteunt ook het hernoemen van een tmux-venster met Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

En ondersteunt het hernoemen van een zellij-paneel of zellij-tab met Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

Verschillende talen worden ook ondersteund，zoals Nederlands：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name schermafbeelding van hernoemen in het Nederlands" width="800">
</p>

Lijst van alle ondersteunde talen：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## Installatie

```bash
pi install npm:@normful/pi-auto-name
```

## Gebruik

De extensie is volledig automatisch; er is niets te draaien。

Configureer een keer，en klaar。Stel in en vergeet het。

## Hoe het werkt

Na de eerste gebruikersinvoer（of het eerste `agent_settled`-evenement — zie configuratie hieronder）hernoemt het de Pi-sessie en hernoemt het de inhoud van：

- tmux-venster
- herdr-paneel en herdr-tab
- zellij-paneel en zellij-tab

Bovendien kun je ook configureren dat het blijven hernoemen terwijl het gesprek evolueert，door `reRenameEveryNTurns` te configureren。

## Configuratie

Sla de configuratie op in：

- Globaal：`~/.config/pi-auto-name/config.json`（respecteert `XDG_CONFIG_HOME`）
- Per-project overschrijving：`.pi/pi-auto-name.json`

Volledige standaardconfiguratie：

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

Elke configuratiesleutel is optioneel。

## Configuratierapportage

| Key | Type | Default | Meaning |
| `enabled` | `boolean` | `true` | `false` schakelt deze extensie volledig uit。 |
| `initialRenameTrigger` | `string` | `"first-input"` | Wanneer de eerste hernoeming wordt geactiveerd：<br><ul><li>`"first-input"` — nadat je de eerste prompt hebt verzonden</li><li>`"first-agent-settled"` — nadat de eerste LLM-run is voltooid（na het eerste `agent_settled`-evenement）。</li></ul> |
| `language` | `string` | `"en"` | Eén van：`en`、`es`、`de`、`fr`、`it`、`nl`、`pt`/`pt-BR`/`pt-PT`、`id`、`vi`、`tr`、`pl`、`uk`、`fa`、`ar`、`hi`、`zh`/`zh-CN`/`zh-Hans`、`zh-Hant`/`zh-TW`/`zh-HK`、`ja`、`ko`、`th` |
| `namingContextDepth` | `string` | `"recent-user-messages"` | Hoeveel gesprek naar de LLM sturen in elke hernoem-prompt：<br><ul><li>`"first-user-message"` — alleen het eerste bericht van de gebruiker</li><li>`"recent-user-messages"` — eerste bericht van de gebruiker plus de laatste 3 berichten van de gebruiker</li><li>`"full-conversation"` — het hele gesprek（gebruikers，assistenten，tool-aanroepen en resultaten），beperkt tot ~60k tekens met behoud van zowel het begin（kernintentie）als de nieuwste tail</li></ul> |
| `namingModel` | `string` | `""` | `provider/modelId`-overschrijving voor de hernoem-LLM-aanroep。Voorbeeld：`"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"`。Laat leeg om je geconfigureerde Pi-standaardmodel en -provider te gebruiken。 |
| `namingStyle` | `string` | `"natural"` | De hernoemstijl die voor beide namen wordt gebruikt：<br><ul><li>`"natural"` — vrije zin</li><li>`"slug"` — kleine letters met koppeltekens。</li><li>`"topic-project"` — `<onderwerp>｜<project>`，project afgeleid uit de huidige werkmap</li></ul> |
| `replaceExistingName` | `string` | `"always"` | Wanneer een bestaande Pi-sessienaam，tmux-vensternaam，herdr-paneel/-tab-naam，zellij-paneel/-tab-naam wordt overschreven：<br><ul><li>`"always"` — altijd overschrijven</li><li>`"never"` — nooit overschrijven</li></ul> |
| `reRenameEveryNTurns` | `integer` | `0` | Hernoem elke N beurten（elk `agent_settled`-evenement）。`0` hernoemt nooit。 |
| `respectExternalRenames` | `boolean` | `true` | Wanneer `true`，schakelt deze extensie het hernoemen uit nadat een externe hernoeming is gedetecteerd（bijvoorbeeld nadat je handmatig `/name` hebt uitgevoerd）。 |
| `sessionNameMaxLength` | `integer` | `200` | Maximum tekenslimiet voor de Pi-sessienaam。 |
| `skipSessionNameDedup` | `boolean` | `false` | `true` skip het verzenden van bestaande Pi-sessienamen naar de hernoem-prompt。`false`（standaard）stuurt tot 15 bestaande sessienamen om duplicaten te voorkomen。 |
| `surfaces.renamePiSession` | `boolean` | `true` | `false` schakelt het hernoemen van de Pi-sessie uit。 |
| `surfaces.renameHerdrPane` | `boolean` | `true` | `false` schakelt het hernoemen van het herdr-paneel waar Pi draait uit。 |
| `surfaces.renameHerdrTab` | `boolean` | `true` | `false` schakelt het hernoemen van de herdr-tab waarin dit proces draait uit。 |
| `surfaces.renameTmuxWindow` | `boolean` | `true` | `false` schakelt het hernoemen van het tmux-venster waarin dit proces draait uit。 |
| `surfaces.renameZellijPane` | `boolean` | `true` | `false` schakelt het hernoemen van het zellij-paneel waarin dit proces draait uit。 |
| `surfaces.renameZellijTab` | `boolean` | `true` | `false` schakelt het hernoemen van de zellij-tab waarin dit proces draait uit。 |
| `windowNameMaxLength` | `integer` | `30` | Max tekens voor elke terminal/raam-vensternaam（herdr-paneel/-tab，tmux-venster，zellij-paneel/-tab）。Eén van de twee lengteschakelaars。 |

## Foutopsporing

Stel `PI_AUTO_NAME_DEBUG=1` in en de extensie zal zowel gestructureerde `pi-auto-name:debug`-vermeldingen toevoegen aan de sessietranscript en ze weergeven in de TUI。（De debug-vermeldingen worden niet naar de LLM gestuurd。）

## Inspiratie

Deze extensie is geïnspireerd door verschillende andere vergelijkbare extensies：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
