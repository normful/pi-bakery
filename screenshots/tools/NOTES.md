# Screenshot capture

tuishot scenes for the three screenshots that `pi.image` in
`packages/pi-*/package.json` points at. `tuishot` spawns the real pi TUI under a
PTY, waits on rendered text rather than a sleep, types into it, and rasterizes
the captured cell grid.

    bunx @tuishot/cli@0.2.1 run <scene.toml>

Nothing is installed; the npm package carries prebuilt binaries for macOS and
Linux. Shots land in the parent directory (`output_dir = ".."`), overwriting the
committed PNGs.

## Scenes

| Scene                     | Produces                    | Depends on                            |
| ------------------------- | --------------------------- | ------------------------------------- |
| `auto-suggest-skill.toml` | `../auto-suggest-skill.png` | the real `~/.pi/agent` stats file     |
| `parrot.toml`             | `../parrot.png`             | a regenerated seed session (below)    |
| `socrates.toml`           | `../socrates.png`           | one real model call; nondeterministic |

## Path rules

A relative `command` program resolves against the scene's `cwd`, **not** against
the scene file's directory, so `auto-suggest-skill.toml` and `parrot.toml` name
`node_modules/.bin/pi` relative to the repo root. `socrates.toml` runs with a
`cwd` outside the repo, hence its absolute program path. Relative `cwd` and
`output_dir` _do_ resolve from the scene file's directory. Command _arguments_
are passed literally and resolve against `cwd`.

The `fallback_fonts` are host paths. macOS: Hack Nerd Font Mono plus
`/System/Library/Fonts/Apple Symbols.ttf`. Without them the bundled JetBrains
Mono renders pi's `⟐` thinking marker (U+27D0) and nvim's statusline icons as
tofu.

## Regenerating the parrot seed

    node seed-session.mjs /tmp/shots/seed/sessions/seed.jsonl "$PWD"

Regenerate before every parrot run: pi appends to the session file it is given,
so a used seed is no longer the expected shape. `/parrot` needs a prior assistant
message; this seeds one instead of paying for a model call.

## Why each option is there

- **`--tui-mode fullscreen`** — in pi's default regular mode the footer sits at the
  cursor rather than the bottom of the grid, leaving dead rows in a tall capture.
- **`--offline`** — drops the "Update Available" banner and the AIHubMix model
  discovery warning. One local extension warning survives (a Jev consultation
  filter on this machine), so every scene crops above its region of interest.
- **`crop`** — in cells, `y` is 0-indexed, and it suppresses the `txt` output for
  that shot. `formats` carries no `txt` here for the same reason.
- **`scale = 2`** — 10x20 logical pixels per cell at scale 1; scale 2 matches the
  resolution of the other files in `screenshots/`.

## Verification

    file ../auto-suggest-skill.png ../parrot.png ../socrates.png

Expect 1744x904, 2064x1264 and 2264x864. Two traps:

- `--no-extensions` looks like the clean way to keep startup warnings out of the
  transcript, but the provider extensions are what resolve the model, so pi then
  prints eight "No models match pattern" warnings instead. Don't.
- The socrates crop is anchored to the grid, not to the picker, so a re-run whose
  answer is longer or shorter moves the question block. Check the name of the
  selected option and the question before keeping the frame, and adjust `y`.

## Alternatives considered

- **`/clear` to wipe the startup warning** — not a pi command; it is sent to the
  model as a prompt, which costs a turn and leaves the reply in the transcript.
- **herdr for the run half plus a separate renderer** — unnecessary, tuishot does
  both.
- **A node-pty harness** — the local node-pty path fails with `posix_spawnp
  failed` on this host.
