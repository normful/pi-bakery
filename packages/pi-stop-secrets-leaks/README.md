# @normful/pi-stop-secrets-leaks

Pi extension that detects secrets using [betterleaks](https://github.com/normful/betterleaks)
and redacts them by position before they reach the LLM.

<p align="center">
  <video src="https://github.com/normful/pi-bakery/raw/refs/heads/main/videos/stop-secrets-leaks-demo.mp4" controls width="800"></video>
</p>

- **Project files** — scanned at session start via `betterleaks dir`
- **Environment variables** — scanned at session start via `betterleaks stdin`
- **Tool result text** — scanned reactively on each tool call

Secret values are never stored or logged. All betterleaks invocations use
`--redact=100`; only metadata (positions, rule IDs, fingerprints) is kept.
Redacted spans are replaced with opaque `«🔒 $S_NN»` placeholders.

## Installation

Install [betterleaks](https://github.com/betterleaks/betterleaks). Then:

```bash
pi install npm:@normful/pi-stop-secrets-leaks
```

## Commands

| Command                      | Description                              |
| ---------------------------- | ---------------------------------------- |
| `/stop-secrets-leaks-status` | Show extension status and finding counts |
| `/stop-secrets-leaks-toggle` | Enable or disable redaction              |
| `/stop-secrets-leaks-rescan` | Re-scan project and environment          |
| `/stop-secrets-leaks-config` | Set the betterleaks scan timeout         |

## Warning

This isn't a 100% guaranteed way of preventing all secrets from leaking to the LLM.
Stack this with other countermeasures and secrets management tools to further reduce likelihood of leaked secrets.

## Inspiration

This extension is inspired by these similar Pi extensions:

- https://github.com/arvoreeducacao/arvore-pi-extensions/tree/main/packages/secret-firewall
- https://github.com/spences10/my-pi/tree/main/packages/pi-redact
