# @normful/pi-auto-name

Automatycznie nadaje nazwy sesji Pi i powierzchniom wielokrotnego użycia terminala na podstawie rozmowy。

Obsługuje zmianę nazwy panelu herdr lub karty herdr zawierającej Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

Obsługuje również zmianę nazwy okna tmux zawierającego Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

I obsługuje zmianę nazwy panelu zellij lub karty zellij zawierającej Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

Obsługiwane są również różne języki，takie jak polski：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name zrzut ekranu zmiany nazwy po polsku" width="800">
</p>

Lista wszystkich obsługiwanych języków：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## Instalacja

```bash
pi install npm:@normful/pi-auto-name
```

## Użycie

Rozszerzenie jest w pełni automatyczne; nie ma nic do uruchomienia。

Skonfiguruj raz i gotowe。Ustaw i zapomnij。

## Jak działa

Po pierwszym wprowadzeniu danych przez użytkownika（lub pierwszym zdarzeniu `agent_settled` — zobacz konfigurację poniżej）zmienia nazwę sesji Pi i zmienia nazwę zawartych elementów：

- okno tmux
- panel herdr i karta herdr
- panel zellij i karta zellij

Dodatkowo możesz też skonfigurować ciągłe zmiany nazw w miarę rozwoju rozmowy，konfigurując `reRenameEveryNTurns`。

## Konfiguracja

Zapisz konfigurację w：

- Globalnie：`~/.config/pi-auto-name/config.json`（szanuje `XDG_CONFIG_HOME`）
- Nadpisanie dla projektu：`.pi/pi-auto-name.json`

Pełna domyślna konfiguracja：

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

Każdy klucz konfiguracji jest opcjonalny。

## Referencja konfiguracji

| Key | Type | Default | Meaning |
| `enabled` | `boolean` | `true` | `false` wyłącza to rozszerzenie w całości。 |
| `initialRenameTrigger` | `string` | `"first-input"` | Kiedy pierwsza zmiana nazwy jest uruchamiana：<br><ul><li>`"first-input"` — po wysłaniu pierwszego promptu</li><li>`"first-agent-settled"` — po zakończeniu pierwszego uruchomienia LLM（po pierwszym zdarzeniu `agent_settled`）。</li></ul> |
| `language` | `string` | `"en"` | Jedno z：`en`、`es`、`de`、`fr`、`it`、`nl`、`pt`/`pt-BR`/`pt-PT`、`id`、`vi`、`tr`、`pl`、`uk`、`fa`、`ar`、`hi`、`zh`/`zh-CN`/`zh-Hans`、`zh-Hant`/`zh-TW`/`zh-HK`、`ja`、`ko`、`th` |
| `namingContextDepth` | `string` | `"recent-user-messages"` | Ile rozmowy wysyłać do LLM w każdym promptzie zmiany nazwy：<br><ul><li>`"first-user-message"` — tylko pierwsza wiadomość użytkownika</li><li>`"recent-user-messages"` — pierwsza wiadomość użytkownika plus ostatnie 3 wiadomości użytkownika</li><li>`"full-conversation"` — cała rozmowa（użytkownicy，asystenci，wywołania narzędzi i wyniki），ograniczona do ~60k znaków z zachowaniem zarówno otwarcia（główna intencja）jak i najnowszego końca</li></ul> |
| `namingModel` | `string` | `""` | Nadpisanie `provider/modelId` dla wywołania LLM zmiany nazwy。Przykład：`"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"`。Zostaw puste，aby użyć domyślnego modelu i dostawcy Pi。 |
| `namingStyle` | `string` | `"natural"` | Styl nadawania nazw używany dla obu nazw：<br><ul><li>`"natural"` — wolne zdanie</li><li>`"slug"` — małe litery rozdzielone myślnikami。</li><li>`"topic-project"` — `<temat>｜<projekt>`，projekt wywodzący się z bieżącego katalogu roboczego</li></ul> |
| `replaceExistingName` | `string` | `"always"` | Kiedy nadpisywać istniejącą nazwę sesji Pi，nazwę okna tmux，nazwę panelu/karty herdr，nazwę panelu/karty zellij：<br><ul><li>`"always"` — zawsze nadpisuj</li><li>`"never"` — nigdy nie nadpisuj</li></ul> |
| `reRenameEveryNTurns` | `integer` | `0` | Zmiana nazwy co N turów（każde zdarzenie `agent_settled`）。`0` nigdy nie zmienia nazwy。 |
| `respectExternalRenames` | `boolean` | `true` | Gdy `true`，wyłącza zmianę nazwy tego rozszerzenia po wykryciu zewnętrznej zmiany nazwy（np。po ręcznym uruchomieniu `/name`）。 |
| `sessionNameMaxLength` | `integer` | `200` | Maksymalne ograniczenie znaków dla nazwy sesji Pi。 |
| `skipSessionNameDedup` | `boolean` | `false` | `true` pomija wysyłanie istniejących nazw sesji Pi w prompcie zmiany nazwy。`false`（domyślnie）wysyła do 15 istniejących nazw sesji，aby uniknąć duplikacji。 |
| `surfaces.renamePiSession` | `boolean` | `true` | `false` wyłącza zmianę nazwy sesji Pi。 |
| `surfaces.renameHerdrPane` | `boolean` | `true` | `false` wyłącza zmianę nazwy panelu herdr，w którym działa Pi。 |
| `surfaces.renameHerdrTab` | `boolean` | `true` | `false` wyłącza zmianę nazwy karty herdr，w której działa ten proces。 |
| `surfaces.renameTmuxWindow` | `boolean` | `true` | `false` wyłącza zmianę nazwy okna tmux，w którym działa ten proces。 |
| `surfaces.renameZellijPane` | `boolean` | `true` | `false` wyłącza zmianę nazwy panelu zellij，w którym działa ten proces。 |
| `surfaces.renameZellijTab` | `boolean` | `true` | `false` wyłącza zmianę nazwy karty zellij，w której działa ten proces。 |
| `windowNameMaxLength` | `integer` | `30` | Maks znaków dla każdej nazwy okna terminala/panelu（panel/karta herdr，okno tmux，panel/karta zellij）。Jeden z dwóch suwaków długości。 |

## Debugowanie

Ustaw `PI_AUTO_NAME_DEBUG=1` i rozszerzenie doda strukturalne wpisy `pi-auto-name:debug` do transkrypcji sesji i wyświetli je w TUI。（Wpisy debug nie są wysyłane do LLM。）

## Inspiracja

To rozszerzenie jest zainspirowane kilkoma innymi podobnymi rozszerzeniami：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
