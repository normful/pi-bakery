# @normful/pi-stop-secrets-leaks

Pi extension that detects secrets using [betterleaks](https://github.com/normful/betterleaks)
and redacts them by position before they reach the LLM.

- **Project files** — scanned at session start via `betterleaks dir`
- **Environment variables** — scanned at session start via `betterleaks stdin`
- **Tool result text** — scanned reactively on each tool call

Secret values are never stored or logged. All betterleaks invocations use
`--redact=100`; only metadata (positions, rule IDs, fingerprints) is kept.
Redacted spans are replaced with opaque `«🔒 $S_NN»` placeholders.

## Installation

```bash
npm install @normful/pi-stop-secrets-leaks
```

The extension is loaded automatically by Pi when declared in your Pi configuration.

## Commands

| Command                     | Description                              |
| --------------------------- | ---------------------------------------- |
| `stop-secrets-leaks-status` | Show extension status and finding counts |
| `stop-secrets-leaks-toggle` | Enable or disable redaction              |
| `stop-secrets-leaks-rescan` | Re-scan project and environment          |
| `stop-secrets-leaks-config` | Set the betterleaks scan timeout         |

## Keywords

`pi-extension` `pi-package` `secrets` `security` `betterleaks`
