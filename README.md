# pi-bakery

Extensions for the [Pi coding agent](https://pi.dev). See each package's README for more details.

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/refs/heads/main/pi-bakery.png" alt="pi-bakery" width="800">
</p>

## Installation

Every extension in this repo is published to npm under the `@normful/` scope. Install one with Pi's installer:

```bash
pi install npm:@normful/pi-auto-name
```

Substitute the name of any package listed below. Some extensions have extra prerequisites — for example, `pi-stop-secrets-leaks` needs [betterleaks](https://github.com/betterleaks/betterleaks) installed first — so check the package's README before installing.

## [`@normful/pi-auto-name`](./packages/pi-auto-name)

Automatically renames Pi sessions and terminal multiplexer surfaces (herdr/tmux/zellij) from the conversation.

Supports renaming a herdr pane or herdr tab containing Pi:

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/auto-name.png" alt="pi-auto-name herdr screenshot" width="800">
</p>

Also supports renaming a tmux window containing Pi:

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_tmux.png" alt="pi-auto-name tmux screenshot" width="800">
</p>

And supports renaming a zellij pane or zellij tab containing Pi:

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-name_zellij.png" alt="pi-auto-name zellij screenshot" width="800">
</p>

Various languages are supported too, such as Japanese:

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/pi-auto-rename_japanese.png" alt="pi-auto-name Japanese renaming screenshot" width="800">
</p>

## [`@normful/pi-show-files-read`](./packages/pi-show-files-read)

In-session file-read tracker. The `/files-read` command shows every file the agent has read this session.

[![pi-show-files-read screenshot](./screenshots/files-read.png)](https://github.com/normful/pi-bakery/tree/main/packages/pi-show-files-read)

## [`@normful/pi-show-theme-colors`](./packages/pi-show-theme-colors)

The `/theme-colors` command shows all colors available in the current Pi theme.

[![pi-show-theme-colors screenshot](./screenshots/theme-colors.png)](https://github.com/normful/pi-bakery/tree/main/packages/pi-show-theme-colors)

## [`@normful/pi-statusline`](./packages/pi-statusline)

Adds colourful info around the editor.

[![pi-statusline screenshot](./screenshots/statusline3.png)](https://github.com/normful/pi-bakery/tree/main/packages/pi-statusline)

<p align="center">
  <a href="https://github.com/normful/pi-bakery/tree/main/packages/pi-statusline">
    <img src="./videos/statusline-demo.gif" alt="pi-statusline-demo" width="800">
  </a>
</p>

## [`@normful/pi-stop-secrets-leaks`](./packages/pi-stop-secrets-leaks)

Detects secrets via [betterleaks](https://github.com/betterleaks/betterleaks) and redacts them before they reach the LLM.

<p align="center">
  <a href="https://github.com/normful/pi-bakery/tree/main/packages/pi-stop-secrets-leaks">
    <img src="./videos/stop-secrets-leaks-demo.gif" alt="pi-stop-secrets-leaks demo" width="800">
  </a>
</p>

## [`@normful/pi-dim`](./packages/pi-dim)

Dims text so it's hidden while agent is running. Helps break a bad habit of reading running agent text.

[![pi-dim screenshot](./screenshots/dim.png)](https://github.com/normful/pi-bakery/tree/main/packages/pi-dim)

## [`@normful/pi-parrot`](./packages/pi-parrot)

The `/parrot` command opens the last AI response in your external editor — save and exit to send the edited text back to the chat.

## [`@normful/pi-socrates`](./packages/pi-socrates)

When Pi needs your input, it asks with an interactive picker instead of making you type a free-form reply. A single question shows a quick picker; multiple questions show tabs with a Submit tab to review everything before sending.

## Development

This repo is an npm workspace: each extension is an independently installable package under `packages/`, published to npm under the `@normful/` scope. It uses **npm**, not pnpm or yarn.

```bash
npm install         # install workspace dependencies
npm test            # run all tests across packages (vp test)
npm run typecheck   # type-check without emitting (tsc)
npm run lint        # lint (vp check)
npm run lint:fix    # lint + autofix (vp check --fix)
```

`test`, `lint`, and `lint:fix` are wrapped by `./run-silent`, which prints only a `✔` line on success and the captured output on failure.

Tests are written with [vitest](https://vitest.dev) and run via [Vite Plus](https://viteplus.dev) (`vp`), which is already configured in the root workspace.

Git hooks are managed with [hk](https://hk.jdx.dev), configured in `hk.pkl`. Install them once per repo:

```bash
hk install
```

Pre-commit and pre-push then run hygiene checks plus project-wide typecheck, lint, and test.

See [`AGENTS.md`](./AGENTS.md) for the package layout rules and [`CONTRIBUTING.md`](./CONTRIBUTING.md) for contribution expectations.

## License

MIT — see [`LICENSE`](./LICENSE).
