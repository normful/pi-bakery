# pi-bakery

Extensions for the [Pi coding agent](https://pi.dev).

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/refs/heads/main/pi-bakery.png" alt="pi-bakery" width="800">
</p>

## [`@normful/pi-show-files-read`](./packages/pi-show-files-read)

In-session file-read tracker. The `/files-read` command shows every file the agent has read this session.

![pi-show-files-read screenshot](./screenshots/files-read.png)

## [`@normful/pi-show-theme-colors`](./packages/pi-show-theme-colors)

The `/theme-colors` command shows all colors available in the current Pi theme.

![pi-show-theme-colors screenshot](./screenshots/theme-colors.png)

## [`@normful/pi-statusline`](./packages/pi-statusline)

Info-rich TUI header/footer: context %, tokens, streaming CPS, cost, model, git branch.

![pi-statusline screenshot](./screenshots/statusline.png)

## [`@normful/pi-stop-secrets-leaks`](./packages/pi-stop-secrets-leaks)

Detects secrets via [betterleaks](https://github.com/betterleaks/betterleaks) and redacts them before they reach the LLM.

<p align="center">
  <img src="./videos/stop-secrets-leaks-demo.gif" alt="pi-stop-secrets-leaks demo" width="800">
</p>

```bash
pi install npm:@normful/pi-<name>
```

---

See each package's README for more details.
