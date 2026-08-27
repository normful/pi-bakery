# @normful/pi-auto-name

Nombra automáticamente tu sesión Pi y las superficies del multiplexor de terminal a partir de la conversación.

Compatible con cambiar el nombre de un panel herdr o pestaña herdr que contenga Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

También compatible con cambiar el nombre de una ventana tmux que contenga Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

Y compatible con cambiar el nombre de un panel zellij o pestaña zellij que contenga Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

También se admiten varios idiomas, como el español：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name captura de pantalla de cambio de nombre en español" width="800">
</p>

Lista de todos los idiomas admitidos：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## Instalación

```bash
pi install npm:@normful/pi-auto-name
```

## Uso

La extensión es totalmente automática; no hay nada que ejecutar。

Configúralo una vez y listo。Configúralo y olvídate。

## Cómo Funciona

Después de la primera entrada del usuario (o el primer evento `agent_settled` — consulta la configuración a continuación)，cambia el nombre de la sesión Pi y cambia el nombre del contenido de：

- ventana tmux
- panel herdr y pestaña herdr
- panel zellij y pestaña zellij

Además，también puedes configurarlo para cambiar el nombre continuamente a medida que evoluciona la conversación，configurando `reRenameEveryNTurns`。

## Configuración

Guarda la configuración en：

- Globalmente：`~/.pi/agent/pi-auto-name.json`（o `<PI_CODING_AGENT_DIR>/pi-auto-name.json` cuando esté configurado）
- Alternativa obsoleta：`~/.config/pi-auto-name/config.json` todavía se lee con la prioridad más baja
- Anulación por proyecto：`.pi/pi-auto-name.json`

Configuración predeterminada completa：

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

Cada clave de configuración es opcional。

## Referencia de Configuración

| Key                         | Type      | Default                             | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------- | --------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `enabled`                   | `boolean` | `true`                              | `false` deshabilita esta extensión por completo。                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `initialRenameTrigger`      | `string`  | <code>"first-input"</code>          | Cuándo se dispara el primer cambio de nombre：<br><ul><li><code>"first-input"</code> — después de enviar el primer prompt</li><li><code>"first-agent-settled"</code> — después de que la primera ejecución LLM termine（después del primer evento `agent_settled`）。</li></ul>                                                                                                                                                                                                                                          |
| `language`                  | `string`  | `"en"`                              | Uno de：<code>en</code>、<code>es</code>、<code>de</code>、<code>fr</code>、<code>it</code>、<code>nl</code>、<code>pt</code>/<code>pt-BR</code>/<code>pt-PT</code>、<code>id</code>、<code>vi</code>、<code>tr</code>、<code>pl</code>、<code>uk</code>、<code>fa</code>、<code>ar</code>、<code>hi</code>、<code>zh</code>/<code>zh-CN</code>/<code>zh-Hans</code>、<code>zh-Hant</code>/<code>zh-TW</code>/<code>zh-HK</code>、<code>ja</code>、<code>ko</code>、<code>th</code>                                      |
| `namingContextDepth`        | `string`  | <code>"recent-user-messages"</code> | Cuánta conversación enviar al LLM en cada prompt de cambio de nombre：<br><ul><li><code>"first-user-message"</code> — solo el primer mensaje del usuario</li><li><code>"recent-user-messages"</code> — primer mensaje del usuario más los últimos 3 mensajes del usuario</li><li><code>"full-conversation"</code> — toda la conversación（usuarios，asistentes，llamadas a herramientas y resultados），limitada a ~60k caracteres manteniendo tanto el inicio（intención principal）como la cola más reciente</li></ul> |
| `namingModel`               | `string`  | <code>""</code>                     | Anulación <code>provider/modelId</code> para la llamada LLM de cambio de nombre。Ejemplo：<code>"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"</code>。Deja vacío para usar el modelo y proveedor predeterminados de Pi。                                                                                                                                                                                                                                                                                              |
| `namingStyle`               | `string`  | <code>"natural"</code>              | El estilo de cambio de nombre utilizado para ambos nombres：<br><ul><li><code>"natural"</code> — oración libre</li><li><code>"slug"</code> — minúsculas con guiones。</li><li><code>"topic-project"</code> — `<tema>｜<proyecto>`，proyecto derivado del directorio de trabajo actual</li></ul>                                                                                                                                                                                                                          |
| `replaceExistingName`       | `string`  | <code>"always"</code>               | Cuándo sobrescribir un nombre de sesión Pi，nombre de ventana tmux，nombre de panel/ pestaña herdr，nombre de panel/ pestaña zellij existentes：<br><ul><li><code>"always"</code> — siempre sobrescribir</li><li><code>"never"</code> — nunca sobrescribir</li></ul>                                                                                                                                                                                                                                                     |
| `reRenameEveryNTurns`       | `integer` | `0`                                 | Cambiar el nombre cada N turnos（cada evento `agent_settled`）。`0` nunca cambia el nombre。                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `respectExternalRenames`    | `boolean` | `true`                              | Cuando es `true`，deshabilita el cambio de nombre de esta extensión después de detectar un cambio de nombre externo（por ejemplo，después de ejecutar manualmente `/name`）。                                                                                                                                                                                                                                                                                                                                            |
| `sessionNameMaxLength`      | `integer` | `200`                               | Límite máximo de caracteres para el nombre de sesión de Pi。                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `skipSessionNameDedup`      | `boolean` | `false`                             | `true` omite enviar nombres de sesión Pi existentes en el prompt de cambio de nombre。`false`（predeterminado）envía hasta 15 nombres de sesión existentes para evitar duplicar。                                                                                                                                                                                                                                                                                                                                        |
| `surfaces.renamePiSession`  | `boolean` | `true`                              | `false` deshabilita el cambio de nombre de la sesión Pi。                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `surfaces.renameHerdrPane`  | `boolean` | `true`                              | `false` deshabilita el cambio de nombre del panel herdr donde se ejecuta Pi。                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `surfaces.renameHerdrTab`   | `boolean` | `true`                              | `false` deshabilita el cambio de nombre de la pestaña herdr en la que se ejecuta este proceso。                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `surfaces.renameTmuxWindow` | `boolean` | `true`                              | `false` deshabilita el cambio de nombre de la ventana tmux en la que se ejecuta este proceso。                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `surfaces.renameZellijPane` | `boolean` | `true`                              | `false` deshabilita el cambio de nombre del panel zellij en el que se ejecuta este proceso。                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `surfaces.renameZellijTab`  | `boolean` | `true`                              | `false` deshabilita el cambio de nombre de la pestaña zellij en la que se ejecuta este proceso。                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `windowNameMaxLength`       | `integer` | `30`                                | Máx de caracteres para cada nombre de ventana terminal/panel（panel/pestaña herdr，ventana tmux，panel/pestaña zellij）。Uno de los dos controles de longitud。                                                                                                                                                                                                                                                                                                                                                          |

## Depuración

Establece `PI_AUTO_NAME_DEBUG=1` y la extensión agregará entradas estructuradas `pi-auto-name:debug` a la transcripción de la sesión y las representará en la TUI。（Las entradas de depuración no se envían al LLM。）

## Inspiración

Esta extensión está inspirada en varias otras extensiones similares：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
