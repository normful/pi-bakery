# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-10-26

### Changed

- **Breaking:** The `socrates` tool is registered with `exposure: "model-only"`, so it is no longer callable from another tool through `ctx.executeTool()` — as a `codemode` script could. The model still sees and calls it directly while it is active.
- The `socrates` tool declares `executionMode: "sequential"`, so concurrent calls in one assistant message run one at a time instead of racing for the same terminal UI.
- The `socrates` tool declares `annotations: { readOnlyHint: true }`, so permission extensions can tell it changes nothing.

## [0.1.1] - 2026-10-01

### Changed

- `typebox` is now declared as a host-provided peer dependency rather than bundled, so Pi supplies its own copy and no longer logs a host-provided-dependency warning for this extension.

## [0.1.0] - 2026-09-20

### Added

- Structured `socrates` tool for asking the user questions with a single-select picker, multi-select and multi-question tab flows with a Submit review tab, and inline note editing.

[Unreleased]: https://github.com/normful/pi-bakery/commits/main/packages/pi-socrates
[0.2.0]: https://www.npmjs.com/package/@normful/pi-socrates/v/0.2.0
[0.1.1]: https://www.npmjs.com/package/@normful/pi-socrates/v/0.1.1
[0.1.0]: https://www.npmjs.com/package/@normful/pi-socrates/v/0.1.0
