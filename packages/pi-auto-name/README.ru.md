# @normful/pi-auto-name

[English](./README.md)

Автоматически создает названия сессий Pi, окон tmux, панелей и вкладок herdr и zellij по содержимому беседы.

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="Названия панелей herdr, созданные pi-auto-name" width="800">
</p>

## Установка

```bash
pi install npm:@normful/pi-auto-name
```

## Использование

Названия создаются автоматически. Достаточно настроить один раз.

Название создается после первого сообщения пользователя или первого события `agent_settled`, в зависимости от `initialRenameTrigger`. Параметр `reRenameEveryNTurns` позволяет обновлять названия по мере развития беседы.

[Ручное переименование](#ручное-переименование)

## Настройка

Источники конфигурации, от наивысшего приоритета. Значения объединяются по полям:

1. Переопределение для проекта: `.pi/pi-auto-name.json`.
2. Глобально: `~/.pi/agent/pi-auto-name.json` (или `<PI_CODING_AGENT_DIR>/pi-auto-name.json`, если задано).
3. XDG: `~/.config/pi-auto-name/config.json` (`XDG_CONFIG_HOME`).

Все параметры необязательны. Полная конфигурация по умолчанию:

```json
{
  "enabled": true,
  "initialRenameTrigger": "first-input",
  "language": "en",
  "namingCase": "title",
  "namingContextDepth": "recent-user-messages",
  "namingInstructions": "",
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

## Параметры конфигурации

| Параметр                    | Тип       | По умолчанию             | Назначение                                                                                                                                                                                                                                                                |
| --------------------------- | --------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                   | `boolean` | `true`                   | `false` полностью отключает расширение.                                                                                                                                                                                                                                   |
| `initialRenameTrigger`      | `string`  | `"first-input"`          | `"first-input"`: после первого сообщения пользователя. `"first-agent-settled"`: после завершения первого запуска агента.                                                                                                                                                  |
| `language`                  | `string`  | `"en"`                   | Язык названий в формате BCP-47. Для русского: `"ru"` или `"ru-RU"`. Другие встроенные языки перечислены в [английском README](./README.md#configuration-reference).                                                                                                       |
| `namingCase`                | `string`  | `"title"`                | Определяет регистр названий в стиле `natural`: `"title"` или `"sentence"`, например `Исправить обратный вызов OAuth`. Сохраняет имена собственные, аббревиатуры и особенности регистра языка. Не действует на другие стили и языки без регистра букв.                     |
| `namingContextDepth`        | `string`  | `"recent-user-messages"` | `"first-user-message"`: только первое сообщение пользователя. `"recent-user-messages"`: первое и три последних. `"full-conversation"`: вся беседа с ответами и вызовами инструментов, до примерно 60 000 символов с сохранением начала и конца.                           |
| `namingInstructions`        | `string`  | `""`                     | Дополнительные указания для модели во всех стилях, например `Упоминай затронутый сервис.` Дополняют встроенный промпт. Сохраняйте формат ответа `WINDOW:` / `SESSION:`. Пустой текст в конфигурации проекта очищает глобальные указания. Не влияет на резервные названия. |
| `namingModel`               | `string`  | `""`                     | Модель для создания названий в формате `provider/modelId`. Пустая строка использует модель и провайдера Pi по умолчанию.                                                                                                                                                  |
| `namingStyle`               | `string`  | `"natural"`              | `"natural"`: обычные названия. `"slug"`: строчные буквы и дефисы между словами. `"topic-project"`: `<тема>｜<проект>`, имя проекта берется из рабочего каталога.                                                                                                          |
| `replaceExistingName`       | `string`  | `"always"`               | `"always"` разрешает замену существующих названий. `"never"` запрещает замену.                                                                                                                                                                                            |
| `reRenameEveryNTurns`       | `integer` | `0`                      | Обновлять названия каждые N событий `agent_settled`. При `0` периодическое обновление отключено.                                                                                                                                                                          |
| `respectExternalRenames`    | `boolean` | `true`                   | Остановить автоматическое переименование после внешней смены имени, например командой `/name`.                                                                                                                                                                            |
| `sessionNameMaxLength`      | `integer` | `200`                    | Максимальное число символов в названии сессии Pi.                                                                                                                                                                                                                         |
| `skipSessionNameDedup`      | `boolean` | `false`                  | Не передавать модели существующие названия сессий. По умолчанию передаются до 15 названий, чтобы избежать повторов.                                                                                                                                                       |
| `surfaces.renameHerdrPane`  | `boolean` | `true`                   | Переименовывать панель herdr, в которой запущен Pi.                                                                                                                                                                                                                       |
| `surfaces.renameHerdrTab`   | `boolean` | `true`                   | Переименовывать вкладку herdr, в которой запущен Pi.                                                                                                                                                                                                                      |
| `surfaces.renamePiSession`  | `boolean` | `true`                   | Переименовывать сессию Pi.                                                                                                                                                                                                                                                |
| `surfaces.renameTmuxWindow` | `boolean` | `true`                   | Переименовывать окно tmux, в котором запущен Pi.                                                                                                                                                                                                                          |
| `surfaces.renameZellijPane` | `boolean` | `true`                   | Переименовывать панель zellij, в которой запущен Pi.                                                                                                                                                                                                                      |
| `surfaces.renameZellijTab`  | `boolean` | `true`                   | Переименовывать вкладку zellij, в которой запущен Pi.                                                                                                                                                                                                                     |
| `windowNameMaxLength`       | `integer` | `30`                     | Максимальное число символов в названиях окон, панелей и вкладок терминала.                                                                                                                                                                                                |

<a id="ручное-переименование"></a>

## Ручное переименование

Запустите `/rename` без аргументов, чтобы создать названия заново по текущей беседе с вашими настройками. Чтобы задать произвольное название, используйте команду Pi `/name`.

## Отладка

При `PI_AUTO_NAME_DEBUG=1` расширение записывает диагностические события `pi-auto-name:debug` в журнал сессии и показывает их в TUI. Эти записи не передаются модели.

## Источники идей

- Ручное переименование по команде `/rename` вдохновлено [pi-session-rename](https://github.com/Mieluoxxx/pi-ext/tree/main/extensions/pi-session-rename).
- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
