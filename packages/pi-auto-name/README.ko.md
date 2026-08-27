# @normful/pi-auto-name

대화에 따라 Pi 세션 및 터미널 멀티플렉서 표면에 자동으로 이름을 지정합니다.

Pi가 포함된 herdr 패널이나 herdr 탭의 이름을 변경하는 기능 지원：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

Pi가 포함된 tmux 창의 이름을 변경하는 기능도 지원：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

Pi가 포함된 zellij 패널이나 zellij 탭의 이름을 변경하는 기능도 지원：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

일본어 등 다양한 언어를 지원합니다：

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name 일본어 리네임 스크린샷" width="800">
</p>

지원되는 모든 언어 목록：English、Español、Deutsch、Français、Italiano、Nederlands、Português、Bahasa Indonesia、Tiếng Việt、Türkçe、Polski、Українська、فارسی、العربية、हिन्दी、简体中文、繁體中文、日本語、한국어、ไทย

## 설치

```bash
pi install npm:@normful/pi-auto-name
```

## 사용 방법

이 확장 기능은 완전히 자동이며 실행할 항목이 없습니다。

한 번 설정하면 끝입니다。설정해 두면 됩니다。

## 작동 방식

첫 번째 사용자 입력(또는 첫 번째 `agent_settled` 이벤트 — 아래 구성을 참조) 이후에 Pi 세션의 이름을 변경하고 포함된 항목의 이름도 변경합니다：

- tmux 창
- herdr 패널 및 herdr 탭
- zellij 패널 및 zellij 탭

또한 `reRenameEveryNTurns`를 구성하여 대화가 진행되는 동안 확장 기능이 계속 이름을 변경하도록 설정할 수도 있습니다。

## 구성

설정을 다음 위치에 저장합니다：

- 전역：`~/.pi/agent/pi-auto-name.json`（설정된 경우 `<PI_CODING_AGENT_DIR>/pi-auto-name.json`）
- 더 이상 권장되지 않는 대체 경로：`~/.config/pi-auto-name/config.json`은 계속 가장 낮은 우선순위로 읽힙니다
- 프로젝트별 오버라이드：`.pi/pi-auto-name.json`

전체 기본 구성：

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

모든 구성 키는 선택 사항입니다。

## 구성 참조

| Key                         | Type      | Default                             | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | --------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                   | `boolean` | `true`                              | `false`는 이 확장 기능을 완전히 비활성화합니다。                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `initialRenameTrigger`      | `string`  | <code>"first-input"</code>          | 첫 번째 리네임이 트리거될 때：<br><ul><li><code>"first-input"</code> — 첫 번째 프롬프트를 보낸 후</li><li><code>"first-agent-settled"</code> — 첫 번째 LLM 실행이 완료된 후（첫 번째 `agent_settled` 이벤트 이후）。</li></ul>                                                                                                                                                                                                                                                            |
| `language`                  | `string`  | `"en"`                              | 다음 중 하나：<code>en</code>、<code>es</code>、<code>de</code>、<code>fr</code>、<code>it</code>、<code>nl</code>、<code>pt</code>/<code>pt-BR</code>/<code>pt-PT</code>、<code>id</code>、<code>vi</code>、<code>tr</code>、<code>pl</code>、<code>uk</code>、<code>fa</code>、<code>ar</code>、<code>hi</code>、<code>zh</code>/<code>zh-CN</code>/<code>zh-Hans</code>、<code>zh-Hant</code>/<code>zh-TW</code>/<code>zh-HK</code>、<code>ja</code>、<code>ko</code>、<code>th</code> |
| `namingContextDepth`        | `string`  | <code>"recent-user-messages"</code> | 각 리네임 프롬프트에서 LLM에 보내는 대화의 양：<br><ul><li><code>"first-user-message"</code> — 첫 번째 사용자 메시지만</li><li><code>"recent-user-messages"</code> — 첫 번째 사용자 메시지와 마지막 3개의 사용자 메시지</li><li><code>"full-conversation"</code> — 전체 대화(사용자, 어시스턴트, 도구 호출 및 결과)，약 60k 문자로 제한，맨 앞(핵심 의도)과 최신 끝부분 모두 유지</li></ul>                                                                                               |
| `namingModel`               | `string`  | <code>""</code>                     | 리네임 LLM 호출의 <code>provider/modelId</code> 오버라이드。예：<code>"openrouter/nvidia/nemotron-3-nano-30b-a3b:free"</code>。비워 두면 구성된 Pi 기본 모델 및 제공자를 사용합니다。                                                                                                                                                                                                                                                                                                     |
| `namingStyle`               | `string`  | <code>"natural"</code>              | 두 이름에 사용되는命名 스타일：<br><ul><li><code>"natural"</code> — 자유 형식 문장</li><li><code>"slug"</code> — 소문자 하이픈 구분。</li><li><code>"topic-project"</code> — `<topic>｜<project>`，현재 작업 디렉토리에서 파생된 프로젝트</li></ul>                                                                                                                                                                                                                                       |
| `replaceExistingName`       | `string`  | <code>"always"</code>               | 기존 Pi 세션 이름、tmux 창 이름、herdr 패널/탭 이름、zellij 패널/탭 이름을 언제 덮어쓸지：<br><ul><li><code>"always"</code> — 항상 덮어쓰기</li><li><code>"never"</code> — 절대 덮어쓰지 않기</li></ul>                                                                                                                                                                                                                                                                                   |
| `reRenameEveryNTurns`       | `integer` | `0`                                 | N턴마다 리네임（각 `agent_settled` 이벤트）。`0`은 리네임하지 않습니다。                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `respectExternalRenames`    | `boolean` | `true`                              | `true`인 경우、외부 리네임이 감지된 후 이 확장 기능의 리네임을 비활성화합니다（예：수동으로 `/name`을 실행한 후）。                                                                                                                                                                                                                                                                                                                                                                       |
| `sessionNameMaxLength`      | `integer` | `200`                               | Pi 세션 이름의 최대 문자 수 제한。                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `skipSessionNameDedup`      | `boolean` | `false`                             | `true`는 리네임 프롬프트에 기존 Pi 세션 이름을 보내지 않습니다。`false`（기본값）는 중복을 방지하기 위해 최대 15개의 기존 세션 이름을 보냅니다。                                                                                                                                                                                                                                                                                                                                          |
| `surfaces.renamePiSession`  | `boolean` | `true`                              | `false`는 Pi 세션 리네임을 비활성화합니다。                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `surfaces.renameHerdrPane`  | `boolean` | `true`                              | `false`는 Pi가 실행 중인 herdr 패널 리네임을 비활성화합니다。                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `surfaces.renameHerdrTab`   | `boolean` | `true`                              | `false`는 이 프로세스가 실행 중인 herdr 탭 리네임을 비활성화합니다。                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `surfaces.renameTmuxWindow` | `boolean` | `true`                              | `false`는 이 프로세스가 실행 중인 tmux 창 리네임을 비활성화합니다。                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `surfaces.renameZellijPane` | `boolean` | `true`                              | `false`는 이 프로세스가 실행 중인 zellij 패널 리네임을 비활성화합니다。                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `surfaces.renameZellijTab`  | `boolean` | `true`                              | `false`는 이 프로세스가 실행 중인 zellij 탭 리네임을 비활성화합니다。                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `windowNameMaxLength`       | `integer` | `30`                                | 각 터미널/프레임 창 이름의 최대 문자 수（herdr 패널/탭、tmux 창、zellij 패널/탭）。두 길이 조절 노브 중 하나。                                                                                                                                                                                                                                                                                                                                                                            |

## 디버깅

`PI_AUTO_NAME_DEBUG=1`을 설정하면 확장 기능은 세션 트랜스크립트에 구조화된 `pi-auto-name:debug` 항목을 추가하고 TUI에서 렌더링합니다。（디버그 항목은 LLM에 전송되지 않습니다。）

## 영감

이 확장 기능은 다음과 유사한 확장 기능에서 영감을 받았습니다：

- <https://github.com/ssdiwu/pi-autoname>
- <https://github.com/byteowlz/pi-agent-extensions/tree/main/pi-auto-rename>
- <https://github.com/mkioutcc/pi-title-renamer>
- <https://github.com/default-anton/pi-tmux-window-name>
