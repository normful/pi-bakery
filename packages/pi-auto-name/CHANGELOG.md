# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Global configuration now prefers `getAgentDir()/pi-auto-name.json`, so it follows `PI_CODING_AGENT_DIR` and stays alongside other Pi configuration.

### Deprecated

- `~/.config/pi-auto-name/config.json` remains available as the lowest-precedence fallback; use `getAgentDir()/pi-auto-name.json` for new configuration.

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

[Unreleased]: https://github.com/normful/pi-bakery/compare/<latest-tag>...HEAD
[1.0.2]: https://github.com/normful/pi-bakery/compare/<v1.0.1-tag>...<v1.0.2-tag>
[1.0.1]: https://github.com/normful/pi-bakery/compare/<v1.0.0-tag>...<v1.0.1-tag>
[1.0.0]: https://github.com/normful/pi-bakery/releases/tag/<v1.0.0-tag>
