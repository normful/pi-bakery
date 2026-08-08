# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- The guidance injected at agent start now names the files that contain detected secrets, so the model avoids reading them.

## [0.2.0] - 2026-07-21

### Added

- Initial release: scans project files and environment variables at session start and tool result text reactively with betterleaks, redacting secret values by position before they reach the LLM and replacing them with `«🔒 $S_NN»` placeholders; secret values are never stored or logged. Commands: `/stop-secrets-leaks-status`, `/stop-secrets-leaks-toggle`, `/stop-secrets-leaks-rescan`, `/stop-secrets-leaks-config`.

[Unreleased]: https://github.com/normful/pi-bakery/compare/<latest-tag>...HEAD
[0.2.0]: https://github.com/normful/pi-bakery/releases/tag/<v0.2.0-tag>
