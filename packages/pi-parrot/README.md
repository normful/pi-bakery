# @normful/pi-parrot

Edit the last AI response in your editor. Saving and exiting your editor will automatically send your next as the next chat message.

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/parrot.png" alt="pi-parrot screenshot" width="800">
</p>

## Installation

```bash
pi install npm:@normful/pi-parrot
```

## Usage

```
/parrot
```

Additionally, you can launch it a keyboard shortcut (see `shortcut` configuration below).

## Configuration

The configuration file is entirely optional. Save it to `~/.config/pi-parrot/config.json` with contents like:

```json
{
  "shortcut": "alt+r",
  "editor": "nvim"
}
```

`shortcut` accepts any keys that Pi accepts in keybindings docs.

If `editor` is unset, the extension uses the `$VISUAL` or `$EDITOR` environment variables.
