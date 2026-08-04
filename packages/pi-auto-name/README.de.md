# @normful/pi-auto-name

Benennt automatisch deine Pi-Sitzung und Terminal-Multiplexer-Oberflächen basierend auf dem Gespräch。

Unterstützt das Umbenennen eines herdr-Paneels oder herdr-Tabs mit Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

Unterstützt auch das Umbenennen eines tmux-Fensters mit Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

Und unterstützt das Umbenennen eines zellij-Paneels oder zellij-Tabs mit Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

Verschiedene Sprachen werden auch unterstützt，wie zum Beispiel Japanisch：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name japanischer Umbenennungs-Screenshot" width="800">
</p>

Liste aller unterstützten Sprachen：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## Installation

```bash
pi install npm:@normful/pi-auto-name
```

## Verwendung

Die Erweiterung ist vollständig automatisch; es gibt nichts auszuführen。

Einmal konfigurieren，fertig。Einrichten und vergessen。

## Wie es funktioniert

Nach der ersten Benutzereingabe（oder dem ersten `agent_settled`-Ereignis — siehe Konfiguration unten）benennt es die Pi-Sitzung um und benennt das Enthaltene um：

- tmux-Fenster
- herdr-Panel und herdr-Tab
- zellij-Panel und zellij-Tab

Darüber hinaus kannst du auch konfigurieren，dass es kontinuierlich umbenennt，während sich das Gespräch entwickelt，indem du `reRenameEveryNTurns` konfigurierst。

## Konfiguration

Speichere die Konfiguration in：

- Global：`~/.config/pi-auto-name/config.json`（beachtet `XDG_CONFIG_HOME`）
- Projektüberschreibung：`.pi/pi-auto-name.json`

Volle Standardkonfiguration：

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

Jeder Konfigurationsschlüssel ist optional。

## Konfigurationsreferenz

| Key                         | Type      | Default                             | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | --------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                   | `boolean` | `true`                              | `false` deaktiviert diese Erweiterung vollständig。                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `initialRenameTrigger`      | `string`  | <code>"first-input"</code>          | Wann die erste Umbenennung ausgelöst wird：<br><ul><li><code>"first-input"</code> — nachdem du den ersten Prompt gesendet hast</li><li><code>"first-agent-settled"</code> — nachdem der erste LLM-Durchlauf abgeschlossen ist（nach dem ersten `agent_settled`-Ereignis）。</li></ul>                                                                                                                                                                                                                                     |
| `language`                  | `string`  | `"en"`                              | Eines von：<code>en</code>、<code>es</code>、<code>de</code>、<code>fr</code>、<code>it</code>、<code>nl</code>、<code>pt</code>/<code>pt-BR</code>/<code>pt-PT</code>、<code>id</code>、<code>vi</code>、<code>tr</code>、<code>pl</code>、<code>uk</code>、<code>fa</code>、<code>ar</code>、<code>hi</code>、<code>zh</code>/<code>zh-CN</code>/<code>zh-Hans</code>、<code>zh-Hant</code>/<code>zh-TW</code>/<code>zh-HK</code>、<code>ja</code>、<code>ko</code>、<code>th</code>                                    |
| `namingContextDepth`        | `string`  | <code>"recent-user-messages"</code> | Wie viel vom Gespräch bei jedem Umbenennungs-Prompt an den LLM gesendet wird：<br><ul><li><code>"first-user-message"</code> — nur die erste Benutzernachricht</li><li><code>"recent-user-messages"</code> — erste Benutzernachricht plus die letzten 3 Benutzernachrichten</li><li><code>"full-conversation"</code> — das gesamte Gespräch（Benutzer，Assistenten，Tool-Aufrufe und Ergebnisse），auf ~60k Zeichen begrenzt，wobei sowohl der Anfang（Kernabsicht）als auch das neueste Ende beibehalten werden</li></ul> |
| `namingModel`               | `string`  | <code>""</code>                     | <code>provider/modelId</code>-Überschreibung für den Umbenennungs-LLM-Aufruf。Beispiel：<code>"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"</code>。Leer lassen，um dein konfiguriertes Pi-Standardmodell und den -Anbieter zu verwenden。                                                                                                                                                                                                                                                                             |
| `namingStyle`               | `string`  | <code>"natural"</code>              | Der für beide Namen verwendete Benennungsstil：<br><ul><li><code>"natural"</code> — freier Satz</li><li><code>"slug"</code> — Kleinbuchstaben mit Bindestrich。</li><li><code>"topic-project"</code> — `<Thema>｜<Projekt>`，Projekt abgeleitet vom aktuellen Arbeitsverzeichnis</li></ul>                                                                                                                                                                                                                                |
| `replaceExistingName`       | `string`  | <code>"always"</code>               | Wann ein bestehender Pi-Sessionsname，tmux-Fenstername，herdr-Panel/-Tab-Name，zellij-Panel/-Tab-Name überschrieben werden soll：<br><ul><li><code>"always"</code> — immer überschreiben</li><li><code>"never"</code> — nie überschreiben</li></ul>                                                                                                                                                                                                                                                                       |
| `reRenameEveryNTurns`       | `integer` | `0`                                 | Alle N Runden umbenennen（jedes `agent_settled`-Ereignis）。`0` umbenennet nie。                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `respectExternalRenames`    | `boolean` | `true`                              | Wenn `true`，deaktiviert diese Erweiterung das Umbenennen nach Erkennen einer externen Umbenennung（z。b。nachdem du manuell `/name` ausgeführt hast）。                                                                                                                                                                                                                                                                                                                                                                  |
| `sessionNameMaxLength`      | `integer` | `200`                               | Maximales Zeichenlimit für den Pi-Sessionsnamen。                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `skipSessionNameDedup`      | `boolean` | `false`                             | `true` überspringt das Senden vorhandener Pi-Sessionsnamen im Umbenennungs-Prompt。`false`（Standard）sendet bis zu 15 vorhandene Sessionsnamen，um Duplikate zu vermeiden。                                                                                                                                                                                                                                                                                                                                              |
| `surfaces.renamePiSession`  | `boolean` | `true`                              | `false` deaktiviert das Umbenennen der Pi-Sitzung。                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `surfaces.renameHerdrPane`  | `boolean` | `true`                              | `false` deaktiviert das Umbenennen des herdr-Panels，in dem Pi ausgeführt wird。                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `surfaces.renameHerdrTab`   | `boolean` | `true`                              | `false` deaktiviert das Umbenennen des herdr-Tabs，in dem dieser Prozess ausgeführt wird。                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `surfaces.renameTmuxWindow` | `boolean` | `true`                              | `false` deaktiviert das Umbenennen des tmux-Fensters，in dem dieser Prozess ausgeführt wird。                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `surfaces.renameZellijPane` | `boolean` | `true`                              | `false` deaktiviert das Umbenennen des zellij-Panels，in dem dieser Prozess ausgeführt wird。                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `surfaces.renameZellijTab`  | `boolean` | `true`                              | `false` deaktiviert das Umbenennen des zellij-Tabs，in dem dieser Prozess ausgeführt wird。                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `windowNameMaxLength`       | `integer` | `30`                                | Max Zeichen für jeden Terminal/Rahmen-Fensternamen（herdr-Panel/-Tab，tmux-Fenster，zellij-Panel/-Tab）。Einer der beiden Längenregler。                                                                                                                                                                                                                                                                                                                                                                                  |

## Debugging

Setze `PI_AUTO_NAME_DEBUG=1` und die Erweiterung wird sowohl strukturierte `pi-auto-name:debug`-Einträge zur Sitzungstranskription hinzufügen als auch in der TUI darstellen。（Die Debug-Einträge werden nicht an den LLM gesendet。）

## Inspiration

Diese Erweiterung ist von mehreren anderen ähnlichen Erweiterungen inspiriert：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
