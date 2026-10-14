# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

<!-- No version of this package is published yet, so there is nothing to compare against and no
     release date to name. At publish time, rename this heading to `## [0.1.0] - YYYY-MM-DD` and add
     its npm link beside the one at the foot of this file. -->

### Added

- Pi's `<available_skills>` block is removed from the system prompt on every turn the extension is
  enabled for, including turns that make no decision call, so a session this extension handles carries
  no roster. `enabled: false` is the only setting that leaves Pi's prompt as Pi built it.
- A classifier model decides which skill, if any, the turn needs, through a gate, a chunked wide
  ranking and a rerank over `SKILL.md` excerpts, and at most one recommendation is injected per turn.
- `model.prefer` selects that model from an ordered list of `provider/id` entries. Entries without
  working credentials and entries whose context window cannot hold the roster are skipped, since the
  catalog contains 4096- and 8192-token models that a full roster does not fit.
- A one-line `<skill_routing>` paragraph replaces the roster. It is omitted in a session with no
  active tool that can open a skill file, because no recommendation could be delivered there.
- Empty prompts, slash commands, `/skill:name` expansions and prompts of three words or fewer that
  name no installed skill make no decision call, so `hi` and `thanks` cost nothing while a one-word
  `commit` routes.
- A turn that fits no skill gets no recommendation, because the gate's mean score falls below
  `threshold` and the round ends with nothing suggested.
- A recommendation for a skill the model has already read in the session is suppressed, so the model
  is never told to open a file it already has open.
- One config file, read from the agent directory and overridden per key by a trusted project file,
  holding `threshold`, `neverSuggest`, `alwaysSuggest`, `enabled` and `debugLog`.
- `/auto-suggest-skill:status` reports rounds, API calls, outcomes, tokens, cost and latency for the
  session and for all time, plus the most recent round in full. In the TUI it opens a panel that
  colors each figure by what it means, so an unpriced cost, a failed round and a healthy session read
  differently at a glance; other modes get the plain notification.
- The lifetime counter folds each session's own rounds into the counter file as it is on disk rather
  than writing out the snapshot loaded at session start, so concurrent Pi sessions no longer erase
  each other's rounds. It is written atomically at mode 0600, and the optional per-call debug log
  records no prompt text.

[Unreleased]: https://github.com/normful/pi-bakery/commits/main/packages/pi-auto-suggest-skill
