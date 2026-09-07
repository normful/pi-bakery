# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.0] - 2026-09-07

### Added

- Explicit window-name budgeting: when `windowNameMaxLength` is set, the window name is cut hard to that length instead of dropping to undefined below the word floor, and the `topic-project` prompt now tells the model the exact topic budget left after the project suffix so short budgets still produce usable names.

### Fixed

- First-input rename now fires reliably by threading the in-progress turn into the naming context, interval re-renames start after the initial turn so they no longer overwrite the just-landed name, and a degenerate single-word window derives from the session name instead of discarding both names.
- Resume and reload now reconcile persisted provenance: established names are not re-renamed and external renames the user locked stay locked.
- Session shutdown or replacement aborts in-flight naming immediately instead of running to timeout or renaming the successor session.
- Pasted large logs no longer inflate every naming call: each first, recent, and assistant message is truncated head and tail with a marker.
- Hung model retries no longer stall headless first input for the full retries-times-timeout: the whole retry loop is bounded and then falls through to the network-free last-message fallback.
- Multiplexer detection (`HERDR`, `TMUX`, `ZELLIJ`) is read fresh on every rename so reloads pick up the current environment, and the provider stream fallback forwards per-credential `baseUrl` so custom hosts are no longer missed.

## [1.0.2] - 2026-08-08

### Fixed

- Renames no longer run against a stale or ended session: events arriving after a session reload or shutdown are ignored, and an in-flight rename aborts before applying names to the wrong session.

## [1.0.1] - 2026-08-06

### Added

- README translations for 19 languages, including Chinese (simplified and traditional), Japanese, Korean, Portuguese (Brazil), Spanish, German, French, Indonesian, Vietnamese, Turkish, Polish, Ukrainian, Persian, Arabic, Hindi, Italian, Dutch, and Thai.

### Fixed

- Renaming no longer breaks when the session is replaced mid-rename (for example by `/new`, `/fork`, or `/reload`): the naming context is captured while the session is still active, and an in-flight rename aborts gracefully instead of erroring.

## [1.0.0] - 2026-08-04

### Added

- First public release: automatically names the Pi session and the containing tmux window, herdr pane and tab, and zellij pane and tab from the conversation, in your language (26 options) and one of three styles (`natural`, `slug`, `topic-project`), configurable via `~/.config/pi-auto-name/config.json` or a per-project `.pi/pi-auto-name.json` with per-surface toggles, length limits, duplicate-name avoidance, and optional re-renaming every N turns.

[Unreleased]: https://github.com/normful/pi-bakery/commits/main/packages/pi-auto-name
[1.1.0]: https://www.npmjs.com/package/@normful/pi-auto-name/v/1.1.0
[1.0.2]: https://www.npmjs.com/package/@normful/pi-auto-name/v/1.0.2
[1.0.1]: https://www.npmjs.com/package/@normful/pi-auto-name/v/1.0.1
[1.0.0]: https://www.npmjs.com/package/@normful/pi-auto-name/v/1.0.0
