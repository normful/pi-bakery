# @normful/pi-statusline

Opinionated, information-rich status line widgets for Pi.

Adds footer lines that show context usage, live streaming metrics, cost, model info, and more — all in real time.

[![pi-statusline screenshot](../../screenshots/statusline3.png)](https://github.com/normful/pi-bakery/tree/main/packages/pi-statusline)

<p align="center">
  <a href="https://github.com/normful/pi-bakery/tree/main/packages/pi-statusline">
    <img src="../../videos/statusline-demo.gif" alt="pi-statusline-demo" width="800">
  </a>
</p>

## Installation

```bash
pi install npm:@normful/pi-statusline
```

## Configuration

None. And I'd like to keep it that way! :)

## UI explanation

### First line above editor

**Working directory**

`cwd` with the last path segment deterministically hash-colored to easily distinguish between similarly named directories, such as Git worktrees.

**Git branch**

Last path segment in each Git branch name is also deterministically hash-colored, to let you distingiush between similarly named branches.

### Second line above editor

**Model ID**

Any inline strings with `omni` or `:free`/`-free` suffixes are colored differently, to quickly indicate to you that you're using a free model

**Thinking level**

The `⟐` symbol means "thinking" (same symbol used in bottom right footer also)

(The extension also hides the built-in working loader row with `setWorkingVisible(false)` for a cleaner look.)

### Left side of footer below editor

Context window usage warning emojis:

- 🟦 when between 20% and 30%
- 🟪 when between 30% and 40%
- 🟧 when between 40% and 50%
- 🟥 when above 50%

Actual context tokens / context window (e.g. `12.5K/200K`) |

Live elapsed timer: ⏱

### Right side of footer below editor

Real-time characters-per-second during streaming, broken down by phase:

- `⟐` thinking CPS speed
- `⚙` tool call CPS speed
- `≡` text output CPS speed

When not streaming, it shows the average of the most recently completed turn.

CPS values use a light color gradient:

- **0–30 CPS**: red → yellow
- **30–50 CPS**: yellow → blue
- **50–100 CPS**: blue → cyan
- **100+ CPS**: green

Cumulative session cost in millicents (1¢ = 1,000 m¢)

Token ratios `3c:2i:1o` means a ratio of: 3 cached input, 2 uncached input: 1 output

Ratios always rounded and normalized so output is 1.

## Contributing (or lack thereof)

Since this package is primarily designed for me, I unfortunately won't merge any pull requests to this particular package unless you coincidentally add something matching my visual tastes.

I don't want this to balloon into complex and highly configurable software that tries to make everybody happy (e.g. starship, powerline, nvim-lualine, etc.)

I'd rather keep this code simple.

If you want some tweak, feel free to fork and modify to your liking.

But if you can improve or fix something without changing the general appearance too much, I _might_ merge your pull request. Don't forget to follow this monorepo's AGENTS.md when coding.
