# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-09-07

### Added

- Initial release: dims agent output in the Pi TUI while the agent is running (faint/invisible `#0a0a0a`), keeping the input editor readable. `/dim` and `/undim` commands; dim enabled by default. Handles mid-dim theme switches, permission-gate prompts, and binary-safe stdout streaming.
- Integration tests (Groups A–D): lifecycle through a real `AgentSession` (dim mid-turn, clear after settle, print-mode no-op), `/dim`/`/undim` and shutdown wiring, theme fidelity on a real `Theme` (editor lanes bright, byte-identical restore, mid-dim swap migration), stdout chunk-boundary/binary/callback behavior, and editor discovery.

### Fixed

- `saveThemeOriginals` now stores per-theme originals in `originalsByTheme` (matching v13). Without this, `restoreTheme` never found the originals and the TUI theme stayed dimmed after the agent settled.

[Unreleased]: https://github.com/normful/pi-bakery/compare/<v0.1.0-tag>...HEAD
[0.1.0]: https://github.com/normful/pi-bakery/releases/tag/<v0.1.0-tag>
