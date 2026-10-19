# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-10-19

### Added

- Skill routing that removes Pi's `<available_skills>` block and injects at most one skill recommendation per turn, chosen by a classifier model through a gate, a chunked wide ranking and a rerank over `SKILL.md` excerpts.
- A recommendation for a skill the model has already read this session is suppressed, so the model is never told to open a file it has open.
- `model.prefer` selects the classifier model from an ordered list of `provider/id` entries, skipping any entry without working credentials and any whose context window cannot hold the roster, since the catalog contains 4096- and 8192-token models that a full roster does not fit.
- One config file, read from the agent directory and overridden per key by a trusted project file, holding `threshold`, `neverSuggest`, `alwaysSuggest`, `enabled` and `debugLog`.
- `/auto-suggest-skill:status` reports rounds, API calls, outcomes, tokens, cost and latency for the session and for all time, plus the most recent round in full.
- A lifetime counter persisted to the agent directory with an atomic write at mode 0600, and an optional per-call debug log that records no prompt text.
- Prompts that cannot need a skill, and sessions with no tool that can load one, make no decision call and leave Pi's prompt untouched.

### Changed

- A prompt of three words or fewer is now routed only when it names an installed skill. A one-word
  prompt that names a skill (`commit`) reaches the decision call and removes Pi's roster instead of
  being ignored, while `hi` and `thanks` still cost nothing.
- The `<skill_routing>` guidance is down to 91 characters from 203. It no longer spells out the
  no-recommendation case, which the absence of a recommendation states itself.
- A session with no active tool that can open a skill file no longer gets the `<skill_routing>`
  paragraph, only the roster removed. Pi omits that roster itself in such a session, so there was
  nothing to describe and the paragraph advertised a recommendation that could never be delivered.
- Pi's roster is now removed on every turn the extension is enabled for, ahead of every routing
  gate, instead of only once a routing round had run. It is therefore absent from the session's first
  request, and a turn that makes no decision call no longer relies on an earlier round having taken it
  away. `enabled: false` remains the only setting that leaves Pi's prompt as Pi built it.
- `/auto-suggest-skill:status` opens a styled panel in the TUI — the outcome rates, the unpriced-cost
  caveat and the last round's result each carry their own color — instead of a notification that
  rendered every line in the same dim color. Every other mode still gets the plain notification.
- The report's value column starts at the same offset on every row; the last round's figures were a
  column to the left of the rest.

### Fixed

- The lifetime counter is folded into the file at write time rather than written out from the
  snapshot loaded at session start, so a session no longer erases the rounds another Pi process
  recorded in between.

[Unreleased]: https://github.com/normful/pi-bakery/commits/main/packages/pi-auto-suggest-skill
[1.0.0]: https://www.npmjs.com/package/@normful/pi-auto-suggest-skill/v/1.0.0
