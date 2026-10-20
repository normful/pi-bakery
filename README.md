# pi-bakery

Extensions for the [Pi coding agent](https://pi.dev). See each package's README for more details.

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/refs/heads/main/pi-bakery.png" alt="pi-bakery" width="800">
</p>

## Installation

Each extension is published to npm under the `@normful/` scope:

```bash
pi install npm:@normful/pi-auto-name
```

Some extensions need extra setup — `pi-stop-secrets-leaks` needs [betterleaks](https://github.com/betterleaks/betterleaks) — so check the package's README.

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

[![pi-parrot screenshot](./screenshots/parrot.png)](https://github.com/normful/pi-bakery/tree/main/packages/pi-parrot)

## [`@normful/pi-socrates`](./packages/pi-socrates)

When Pi needs your input, it asks with an interactive picker instead of making you type a free-form reply. A single question shows a quick picker; multiple questions show tabs with a Submit tab to review everything before sending.

[![pi-socrates screenshot](./screenshots/socrates.png)](https://github.com/normful/pi-bakery/tree/main/packages/pi-socrates)

## [`@normful/pi-auto-suggest-skill`](./packages/pi-auto-suggest-skill)

Removes Pi's inlined skill list and asks a classifier model which skill the turn needs, then suggests at most one. `/auto-suggest-skill:status` reports what it decided and what it cost.

[![pi-auto-suggest-skill screenshot](./screenshots/auto-suggest-skill.png)](https://github.com/normful/pi-bakery/tree/main/packages/pi-auto-suggest-skill)

## Contributors

Thanks to everyone who has contributed to pi-bakery.

<!-- readme: contributors -start -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="21.42%">
        <a href="https://github.com/AdamsGH"><img src="https://avatars.githubusercontent.com/u/19850062?v=4" width="100px;" alt="AdamsGH"/><br /><sub><b>AdamsGH</b></sub></a><br />
        <sub>code, i18n</sub>
      </td>
      <td align="center" valign="top" width="21.42%">
        <a href="https://github.com/marcoscale98"><img src="https://avatars.githubusercontent.com/u/43850400?v=4" width="100px;" alt="marcoscale98"/><br /><sub><b>marcoscale98</b></sub></a><br />
        <sub>code</sub>
      </td>
    </tr>
  </tbody>
</table>
<!-- readme: contributors -end -->

## Development

See [`AGENTS.md`](./AGENTS.md) for the workspace layout and commands, and [`CONTRIBUTING.md`](./CONTRIBUTING.md) for contribution expectations.

## License

MIT — see [`LICENSE`](./LICENSE).
