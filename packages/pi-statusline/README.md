# @normful/pi-statusline

Opinionated, information-rich status line widgets for the Pi TUI. Replaces the built-in footer and adds an above-editor widget that surfaces context usage, live streaming metrics, cost, model info, and more — all in real time.

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/statusline.png" alt="pi-statusline screenshot" width="800">
</p>

## Features

### Above-editor widget (two-line header)

- **Working directory** — Shows the current `cwd` with each path segment deterministically hash-colored from a 64-color HSL palette. The home directory is abbreviated as `~`.
- **Git branch** — Displayed next to the directory with `⎇` prefix; the branch name suffix gets its own hash color for quick visual scanning.
- **Model + thinking level** — Shows the active model ID (with `omni` highlighted via syntax coloring and `:free`/`-free` suffixes accented) and the current extended thinking level (`⟐`).

### Footer

The footer aggregates session telemetry in a compact, color-coded layout:

| Section                | What it shows                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context %**          | Context window fill percentage with color-coded emoji (🟦 / 🟪 / 🟧 / 🟥) as it fills                                                                               |
| **Token usage**        | Actual context tokens / context window (e.g., `12.5K/200K`)                                                                                                         |
| **Live elapsed**       | ⏱ timer showing how long the current agent turn has been running                                                                                                    |
| **Streaming CPS**      | Real-time characters-per-second during streaming, broken down by phase: `⟐` thinking, `⚙` tool calls, `≡` text — with a slow→fast color gradient (dull red → green) |
| **Last-turn averages** | Per-phase average CPS from the most recent completed turn                                                                                                           |
| **Cost**               | Cumulative session cost in millicents (1¢ = 1,000 m¢)                                                                                                               |
| **Token ratio**        | Cache : non-cache-input : output ratio, normalized so output = 1 (e.g., `3c:2i:1o`)                                                                                 |

### Color-coded speed visualization

The CPS metrics use a custom LUT that maps speed values to a muted, stylish gradient:

- **0–30 CPS**: dull red → dull yellow
- **30–50 CPS**: dull yellow → dull blue
- **50–100 CPS**: dull blue → dull cyan
- **100+ CPS**: dull green (plateau)

### Path and branch hashing

Every directory and git branch suffix gets a deterministic color derived from a 64-color HSL palette, giving each workspace/branch a consistent distinct hue across the session.

## Installation

```bash
pi install npm:@normful/pi-statusline
```

## Usage

The header and footer appear automatically in TUI mode (`ctx.hasUI`). No commands to remember — the information is always visible.

The extension:

- Hides the built-in working loader row (`setWorkingVisible(false)`) for a cleaner look
- Replaces the default footer
- Adds a two-line widget above the editor

All timers and meters reset cleanly on session start, reload, fork, and shutdown.
