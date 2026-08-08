# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.5.0] - 2026-07-21

## [0.4.0] - 2026-07-20

### Removed

- The `/files-read` modal no longer lists each file's on-disk byte size alongside the path.

## [0.2.0] - 2026-07-17

### Fixed

- Files read through custom read-like tools (any tool whose name contains `read`) are now tracked too, not just the built-in `read` tool.

## [0.1.0] - 2026-07-17

### Added

- Initial release: tracks every file the agent reads in the current session and lists them in read order via `/files-read`, with deduplication and a clean slate on each new session.

[Unreleased]: https://github.com/normful/pi-bakery/compare/<latest-tag>...HEAD
[0.5.0]: https://github.com/normful/pi-bakery/compare/<v0.4.0-tag>...<v0.5.0-tag>
[0.4.0]: https://github.com/normful/pi-bakery/compare/<v0.2.0-tag>...<v0.4.0-tag>
[0.2.0]: https://github.com/normful/pi-bakery/compare/<v0.1.0-tag>...<v0.2.0-tag>
[0.1.0]: https://github.com/normful/pi-bakery/releases/tag/<v0.1.0-tag>
