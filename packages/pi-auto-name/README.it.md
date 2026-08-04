# @normful/pi-auto-name

Assegna automaticamente nomi alla tua sessione Pi e alle superfici del multiplexer del terminale in base alla conversazione。

Supporta la rinomina di un pannello herdr o scheda herdr contenente Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

Supporta anche la rinomina di una finestra tmux contenente Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

E supporta la rinomina di un pannello zellij o scheda zellij contenente Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

Sono supportate anche varie lingue，come l'italiano：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name screenshot rinomina in italiano" width="800">
</p>

Elenco di tutte le lingue supportate：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## Installazione

```bash
pi install npm:@normful/pi-auto-name
```

## Utilizzo

L'estensione è completamente automatica; non c'è nulla da eseguire。

Configuralo una volta e basta。Impostalo e dimenticalo。

## Come Funziona

Dopo il primo input dell'utente（o il primo evento `agent_settled` — vedi la configurazione qui sotto），rinomina la sessione Pi e rinomina ciò che contiene：

- finestra tmux
- pannello herdr e scheda herdr
- pannello zellij e scheda zellij

Inoltre，puoi anche configurarlo per rinominare continuamente man mano che la conversazione evolve，configurando `reRenameEveryNTurns`。

## Configurazione

Salva la configurazione in：

- Globalmente：`~/.config/pi-auto-name/config.json`（rispetta `XDG_CONFIG_HOME`）
- Sovrascrittura per progetto：`.pi/pi-auto-name.json`

Configurazione predefinita completa：

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

Ogni chiave di configurazione è opzionale。

## Riferimento Configurazione

| Key | Type | Default | Meaning |
| `enabled` | `boolean` | `true` | `false` disabilita questa estensione completamente。 |
| `initialRenameTrigger` | `string` | `"first-input"` | Quando viene attivata la prima rinomina：<br><ul><li>`"first-input"` — dopo aver inviato il primo prompt</li><li>`"first-agent-settled"` — dopo il completamento della prima esecuzione LLM（dopo il primo evento `agent_settled`）。</li></ul> |
| `language` | `string` | `"en"` | Uno di：`en`、`es`、`de`、`fr`、`it`、`nl`、`pt`/`pt-BR`/`pt-PT`、`id`、`vi`、`tr`、`pl`、`uk`、`fa`、`ar`、`hi`、`zh`/`zh-CN`/`zh-Hans`、`zh-Hant`/`zh-TW`/`zh-HK`、`ja`、`ko`、`th` |
| `namingContextDepth` | `string` | `"recent-user-messages"` | Quanta conversazione inviare al LLM in ogni prompt di rinomina：<br><ul><li>`"first-user-message"` — solo il primo messaggio utente</li><li>`"recent-user-messages"` — primo messaggio utente più gli ultimi 3 messaggi utente</li><li>`"full-conversation"` — tutta la conversazione（utenti，assistenti，chiamate agli strumenti e risultati），limitata a ~60k caratteri mantenendo sia l'apertura（intento principale）che la coda più recente</li></ul> |
| `namingModel` | `string` | `""` | Sostituzione `provider/modelId` per la chiamata LLM di rinomina。Esempio：`"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"`。Lascia vuoto per utilizzare il modello e fornitore Pi predefiniti configurati。 |
| `namingStyle` | `string` | `"natural"` | Lo stile di rinomina utilizzato per entrambi i nomi：<br><ul><li>`"natural"` — frase libera</li><li>`"slug"` — minuscolo con trattini。</li><li>`"topic-project"` — `<argomento>｜<progetto>`，progetto derivato dalla directory di lavoro corrente</li></ul> |
| `replaceExistingName` | `string` | `"always"` | Quando sovrascrivere un nome di sessione Pi esistente，nome finestra tmux，nome pannello/scheda herdr，nome pannello/scheda zellij：<br><ul><li>`"always"` — sempre sovrascrivere</li><li>`"never"` — non sovrascrivere mai</li></ul> |
| `reRenameEveryNTurns` | `integer` | `0` | Rinomina ogni N turni（ogni evento `agent_settled`）。`0` non rinomina mai。 |
| `respectExternalRenames` | `boolean` | `true` | Quando `true`，disabilita la rinomina di questa estensione dopo il rilevamento di una rinomina esterna（ad esempio dopo aver eseguito manualmente `/name`）。 |
| `sessionNameMaxLength` | `integer` | `200` | Limite massimo di caratteri per il nome della sessione Pi。 |
| `skipSessionNameDedup` | `boolean` | `false` | `true` salta l'invio dei nomi delle sessioni Pi esistenti nel prompt di rinomina。`false`（predefinito）invia fino a 15 nomi di sessione esistenti per evitare duplicati。 |
| `surfaces.renamePiSession` | `boolean` | `true` | `false` disabilita la rinomina della sessione Pi。 |
| `surfaces.renameHerdrPane` | `boolean` | `true` | `false` disabilita la rinomina del pannello herdr in cui è in esecuzione Pi。 |
| `surfaces.renameHerdrTab` | `boolean` | `true` | `false` disabilita la rinomina della scheda herdr in cui è in esecuzione questo processo。 |
| `surfaces.renameTmuxWindow` | `boolean` | `true` | `false` disabilita la rinomina della finestra tmux in cui è in esecuzione questo processo。 |
| `surfaces.renameZellijPane` | `boolean` | `true` | `false` disabilita la rinomina del pannello zellij in cui è in esecuzione questo processo。 |
| `surfaces.renameZellijTab` | `boolean` | `true` | `false` disabilita la rinomina della scheda zellij in cui è in esecuzione questo processo。 |
| `windowNameMaxLength` | `integer` | `30` | Max caratteri per ogni nome finestra/pannello terminale（pannello/scheda herdr，finestra tmux，pannello/scheda zellij）。Uno dei due interruttori di lunghezza。 |

## Debugging

Imposta `PI_AUTO_NAME_DEBUG=1` e l'estensione aggiungerà voci strutturate `pi-auto-name:debug` alla trascrizione della sessione e le renderizzerà nella TUI。（Le voci di debug non vengono inviate al LLM。）

## Ispirazione

Questa estensione è ispirata da diverse altre estensioni simili：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
