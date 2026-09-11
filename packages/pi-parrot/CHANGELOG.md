# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-09-11

### Added

- Initial release: `/parrot` opens the last assistant message in the external editor, then sends the saved edits back as the next chat message. The editor comes from the `editor` key in `~/.config/pi-parrot/config.json`, falling back to `$VISUAL` and `$EDITOR`. The TUI suspends while the editor owns the terminal and resumes after, with temp-file cleanup.
- Optional keyboard shortcut via the `shortcut` key in `~/.config/pi-parrot/config.json`.
- The editor is spawned directly with no shell, so file paths with spaces work and editor values containing shell metacharacters cannot inject extra commands.

[Unreleased]: https://github.com/normful/pi-bakery/commits/main/packages/pi-parrot
[0.1.0]: https://www.npmjs.com/package/@normful/pi-parrot/v/0.1.0
