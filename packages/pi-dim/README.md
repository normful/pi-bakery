# @normful/pi-dim

Dims the Pi TUI while the agent is working: agent output renders faint/invisible (fg/bg ≈ `#0a0a0a`, zero contrast) so you can keep reading the input editor and idle UI, then everything snaps back to your theme's colors when the agent settles. No theme files are swapped, so custom themes are respected.

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/dim.png" alt="pi-dim screenshot" width="800">
</p>

## Features

- **Agent-run dimming** — on `agent_start`, agent output goes to faint invisible; on `agent_settled` the original colors are restored.
- **Editor stays bright** — the input editor (text/border/accent colors) keeps its idle styling via an editor lane tag, even while everything else is dimmed.
- **Permission gates exempt** — dimming suspends while a `ctx.ui.select/confirm/input/editor` prompt waits for you.
- **Theme-switch safe** — `/theme` swaps mid-dim are detected and the new theme instance is patched in place; restore never smears one theme's colors onto another.
- **Binary-safe stdout lane** — raw LLM streaming text is dimmed with chunk-boundary carry-over of partial escape sequences; CUP row addresses and newlines stay byte-identical.

## Installation

```bash
pi install npm:@normful/pi-dim
```

## Usage

Dim is enabled by default. Commands:

| Command  | Description                                        |
| -------- | -------------------------------------------------- |
| `/dim`   | Enable dimming while the agent is running          |
| `/undim` | Disable dimming (agent output stays fully visible) |

Enabling `/dim` mid-run takes effect immediately; when idle it applies on the next agent run.
