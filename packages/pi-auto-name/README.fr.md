# @normful/pi-auto-name

Nomme automatiquement ta session Pi et les surfaces du multiplexeur de terminal en fonction de la conversation。

Prend en charge le renommage d'un panneau herdr ou d'un onglet herdr contenant Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

Prend également en charge le renommage d'une fenêtre tmux contenant Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

Et prend en charge le renommage d'un panneau zellij ou d'un onglet zellij contenant Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

Plusieurs langues sont également prises en charge，comme le français：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name capture d'écran du renommage en français" width="800">
</p>

Liste de toutes les langues prises en charge：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## Installation

```bash
pi install npm:@normful/pi-auto-name
```

## Utilisation

L'extension est entièrement automatique; il n'y a rien à exécuter。

Configure-le une fois，c'est tout。Règle-le et oublie-le。

## Comment ça marche

Après la première entrée utilisateur（ou le premier événement `agent_settled` — voir la config ci-dessous），il renomme la session Pi et renomme ce qui contient：

- fenêtre tmux
- panneau herdr et onglet herdr
- panneau zellij et onglet zellij

De plus，tu peux aussi le configurer pour renommer en continu au fur et à mesure que la conversation évolue，en configurant `reRenameEveryNTurns`。

## Configuration

Enregistre la configuration dans：

- Globalement：`~/.pi/agent/pi-auto-name.json`（ou `<PI_CODING_AGENT_DIR>/pi-auto-name.json` lorsqu'il est configuré）
- Emplacement de secours obsolète：`~/.config/pi-auto-name/config.json` reste lu avec la priorité la plus basse
- Remplacement par projet：`.pi/pi-auto-name.json`

Configuration par défaut complète：

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

Chaque clé de configuration est optionnelle。

## Référence de configuration

| Key                         | Type      | Default                             | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | --------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                   | `boolean` | `true`                              | `false` désactive cette extension entièrement。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `initialRenameTrigger`      | `string`  | <code>"first-input"</code>          | Quand le premier renommage est déclenché：<br><ul><li><code>"first-input"</code> — après avoir envoyé le premier prompt</li><li><code>"first-agent-settled"</code> — après la première exécution LLM est terminée（après le premier événement `agent_settled`）。</li></ul>                                                                                                                                                                                                                                                                        |
| `language`                  | `string`  | `"en"`                              | L'un de：<code>en</code>、<code>es</code>、<code>de</code>、<code>fr</code>、<code>it</code>、<code>nl</code>、<code>pt</code>/<code>pt-BR</code>/<code>pt-PT</code>、<code>id</code>、<code>vi</code>、<code>tr</code>、<code>pl</code>、<code>uk</code>、<code>fa</code>、<code>ar</code>、<code>hi</code>、<code>zh</code>/<code>zh-CN</code>/<code>zh-Hans</code>、<code>zh-Hant</code>/<code>zh-TW</code>/<code>zh-HK</code>、<code>ja</code>、<code>ko</code>、<code>th</code>                                                               |
| `namingContextDepth`        | `string`  | <code>"recent-user-messages"</code> | Quelle quantité de conversation envoyer au LLM dans chaque prompt de renommage：<br><ul><li><code>"first-user-message"</code> — seulement le premier message utilisateur</li><li><code>"recent-user-messages"</code> — premier message utilisateur plus les 3 derniers messages utilisateur</li><li><code>"full-conversation"</code> — toute la conversation（utilisateurs，assistants，appels d'outils et résultats），limitée à ~60k caractères en conservant à la fois l'ouverture（intention principale）et la queue la plus récente</li></ul> |
| `namingModel`               | `string`  | <code>""</code>                     | Remplacement <code>provider/modelId</code> pour l'appel LLM de renommage。Exemple：<code>"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"</code>。Laisse vide pour utiliser ton modèle et fournisseur Pi par défaut configuré。                                                                                                                                                                                                                                                                                                                    |
| `namingStyle`               | `string`  | <code>"natural"</code>              | Le style de renommage utilisé pour les deux noms：<br><ul><li><code>"natural"</code> — phrase libre</li><li><code>"slug"</code> — minuscules avec tirets。</li><li><code>"topic-project"</code> — `<sujet>｜<projet>`，projet dérivé du répertoire de travail actuel</li></ul>                                                                                                                                                                                                                                                                     |
| `replaceExistingName`       | `string`  | <code>"always"</code>               | Quand remplacer un nom de session Pi，nom de fenêtre tmux，nom de panneau/onglet herdr，nom de panneau/onglet zellij existant：<br><ul><li><code>"always"</code> — toujours remplacer</li><li><code>"never"</code> — ne jamais remplacer</li></ul>                                                                                                                                                                                                                                                                                                 |
| `reRenameEveryNTurns`       | `integer` | `0`                                 | Renommer tous les N tours（chaque événement `agent_settled`）。`0` ne renomme jamais。                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `respectExternalRenames`    | `boolean` | `true`                              | Lorsque `true`，désactive le renommage de cette extension après la détection d'un renommage externe（par exemple après avoir exécuté manuellement `/name`）。                                                                                                                                                                                                                                                                                                                                                                                      |
| `sessionNameMaxLength`      | `integer` | `200`                               | Limite maximale de caractères pour le nom de session Pi。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `skipSessionNameDedup`      | `boolean` | `false`                             | `true` saute l'envoi des noms de session Pi existants dans le prompt de renommage。`false`（par défaut）envoie jusqu'à 15 noms de session existants pour éviter les doublons。                                                                                                                                                                                                                                                                                                                                                                     |
| `surfaces.renamePiSession`  | `boolean` | `true`                              | `false` désactive le renommage de la session Pi。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `surfaces.renameHerdrPane`  | `boolean` | `true`                              | `false` désactive le renommage du panneau herdr où Pi s'exécute。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `surfaces.renameHerdrTab`   | `boolean` | `true`                              | `false` désactive le renommage de l'onglet herdr dans lequel ce processus s'exécute。                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `surfaces.renameTmuxWindow` | `boolean` | `true`                              | `false` désactive le renommage de la fenêtre tmux dans laquelle ce processus s'exécute。                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `surfaces.renameZellijPane` | `boolean` | `true`                              | `false` désactive le renommage du panneau zellij dans lequel ce processus s'exécute。                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `surfaces.renameZellijTab`  | `boolean` | `true`                              | `false` désactive le renommage de l'onglet zellij dans lequel ce processus s'exécute。                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `windowNameMaxLength`       | `integer` | `30`                                | Max caractères pour chaque nom de fenêtre terminal/panel（panel/onglet herdr，fenêtre tmux，panel/onglet zellij）。L'un des deux contrôleurs de longueur。                                                                                                                                                                                                                                                                                                                                                                                         |

## Débogage

Définit `PI_AUTO_NAME_DEBUG=1` et l'extension ajoutera des entrées structurées `pi-auto-name:debug` à la transcription de la session et les affichera dans l'interface TUI。（Les entrées de débogage ne sont pas envoyées au LLM。）

## Inspiration

Cette extension est inspirée par plusieurs autres extensions similaires：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
