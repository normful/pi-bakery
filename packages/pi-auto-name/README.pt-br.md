# @normful/pi-auto-name

Nomeia automaticamente sua sessão Pi e superfícies do multiplexador de terminal a partir da conversa.

Compatível com renomear um painel herdr ou aba herdr contendo Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

Também compatível com renomear uma janela tmux contendo Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

E compatível com renomear um painel zellij ou aba zellij contendo Pi：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

Vários idiomas também são compatíveis, como japonês：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name captura de tela de renomeação em japonês" width="800">
</p>

Lista de todos os idiomas compatíveis：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## Instalação

```bash
pi install npm:@normful/pi-auto-name
```

## Uso

A extensão é totalmente automática; não há nada para executar。

Configure uma vez e pronto。Configure e esqueça。

## Como Funciona

Após a primeira entrada do usuário (ou o primeiro evento `agent_settled` — veja a configuração abaixo), ele renomeia a sessão Pi e renomeia o contido em：

- janela tmux
- painel herdr e aba herdr
- painel zellij e aba zellij

Além disso, você também pode configurá-lo para renomear continuamente conforme a conversa evolui, configurando `reRenameEveryNTurns`.

## Configuração

Salve a configuração em：

- Globalmente：`~/.config/pi-auto-name/config.json`（respeita `XDG_CONFIG_HOME`）
- Substituição por projeto：`.pi/pi-auto-name.json`

Configuração padrão completa：

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

Cada chave de configuração é opcional。

## Referência de Configuração

| Key | Type | Default | Meaning |
| `enabled` | `boolean` | `true` | `false` desabilita esta extensão completamente。 |
| `initialRenameTrigger` | `string` | `"first-input"` | Quando o primeiro renomeamento é acionado：<br><ul><li>`"first-input"` — após enviar o primeiro prompt</li><li>`"first-agent-settled"` — após a primeira execução LLM ser concluída (após o primeiro evento `agent_settled`)。</li></ul> |
| `language` | `string` | `"en"` | Um de：`en`、`es`、`de`、`fr`、`it`、`nl`、`pt`/`pt-BR`/`pt-PT`、`id`、`vi`、`tr`、`pl`、`uk`、`fa`、`ar`、`hi`、`zh`/`zh-CN`/`zh-Hans`、`zh-Hant`/`zh-TW`/`zh-HK`、`ja`、`ko`、`th` |
| `namingContextDepth` | `string` | `"recent-user-messages"` | Quanto da conversa enviar ao LLM em cada prompt de renomeação：<br><ul><li>`"first-user-message"` — apenas a primeira mensagem do usuário</li><li>`"recent-user-messages"` — primeira mensagem do usuário mais as últimas 3 mensagens do usuário</li><li>`"full-conversation"` — toda a conversa (usuários, assistentes, chamadas de ferramenta e resultados)，limitada a ~60k caracteres mantendo tanto a abertura (intenção principal) quanto a cauda mais recente</li></ul> |
| `namingModel` | `string` | `""` | Substituição `provider/modelId` para a chamada LLM de renomeação。Exemplo：`"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"`。Deixe vazio para usar o modelo e provedor padrão do Pi configurado。 |
| `namingStyle` | `string` | `"natural"` | O estilo de nomeação usado para ambos os nomes：<br><ul><li>`"natural"` — frase livre</li><li>`"slug"` — minúsculas com hífen。</li><li>`"topic-project"` — `<tópico>｜<projeto>`，projeto derivado do diretório de trabalho atual</li></ul> |
| `replaceExistingName` | `string` | `"always"` | Quando substituir um nome existente de sessão Pi, nome de janela tmux, nome de painel/aba herdr, nome de painel/aba zellij：<br><ul><li>`"always"` — sempre substituir</li><li>`"never"` — nunca substituir</li></ul> |
| `reRenameEveryNTurns` | `integer` | `0` | Renomear a cada N turnos (cada evento `agent_settled`)。`0` nunca renomeia。 |
| `respectExternalRenames` | `boolean` | `true` | Quando `true`，desabilita o renomeamento desta extensão após um renomeamento externo ser detectado（por exemplo，após executar manualmente `/name`）。 |
| `sessionNameMaxLength` | `integer` | `200` | Limite máximo de caracteres para o nome da sessão Pi。 |
| `skipSessionNameDedup` | `boolean` | `false` | `true` pula o envio de nomes de sessão Pi existentes no prompt de renomeação。`false`（padrão）envia até 15 nomes de sessão existentes para evitar duplicação。 |
| `surfaces.renamePiSession` | `boolean` | `true` | `false` desabilita o renomeamento da sessão Pi。 |
| `surfaces.renameHerdrPane` | `boolean` | `true` | `false` desabilita o renomeamento do painel herdr onde o Pi está rodando。 |
| `surfaces.renameHerdrTab` | `boolean` | `true` | `false` desabilita o renomeamento da aba herdr em que este processo está rodando。 |
| `surfaces.renameTmuxWindow` | `boolean` | `true` | `false` desabilita o renomeamento da janela tmux em que este processo está rodando。 |
| `surfaces.renameZellijPane` | `boolean` | `true` | `false` desabilita o renomeamento do painel zellij em que este processo está rodando。 |
| `surfaces.renameZellijTab` | `boolean` | `true` | `false` desabilita o renomeamento da aba zellij em que este processo está rodando。 |
| `windowNameMaxLength` | `integer` | `30` | Máx de caracteres para cada nome de janela terminal/painel（painel/aba herdr，janela tmux，painel/aba zellij）。Um dos dois controles de comprimento。 |

## Depuração

Defina `PI_AUTO_NAME_DEBUG=1` e a extensão adicionará entradas estruturadas `pi-auto-name:debug` à transcrição da sessão e as renderizará na TUI。（As entradas de depuração não são enviadas ao LLM。）

## Inspiração

Esta extensão é inspirada por várias outras extensões semelhantes：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
