---
name: changelogs
description: Use when creating or updating a changelog, bootstrapping a new CHANGELOG.md, adding entries under an Unreleased section as code changes land, cutting a release (turning Unreleased into a dated version), or handling yanked releases and deprecation/removal cycles.
modified: 2026-08-08T13:36:15+0900
---

# Writing Changelogs

**Core principle:** a changelog is a curated record of notable, user-facing changes, written for the people who use the software.

## Overview

A changelog lists notable changes per version, newest first, grouped by type, with ISO dates and a diff link per version. It lives in `CHANGELOG.md` at the project root. The file is plain Markdown with a fixed shape: a preamble, an `Unreleased` section on top, one `## [version] - date` section per release, and reference-style links at the bottom.

## When to Use

Use this skill when:

- A project has no changelog and needs one created (new or existing project).
- You made a code change and should record it under `Unreleased`.
- A release is being cut: rename `Unreleased` into a dated version and open a fresh `Unreleased`.
- A release is yanked, or a feature is deprecated and later removed.

Do NOT use it to write release notes or announcements (derive those from the changelog), and do not use it to rewrite commit messages.

## CHANGELOG.md File Shape

### Preamble

Open with a `# Changelog` heading and a short, fixed preamble:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).
```

### Unreleased

Keep an `Unreleased` section directly under the preamble to collect upcoming changes. Its contents move into a new version section at release time.

```markdown
## [Unreleased]
```

### Version sections

A release is a heading with the version number, a dash, and the ISO date (`YYYY-MM-DD`). The date format is non-negotiable: it sorts correctly and avoids regional confusion.

```markdown
## [1.2.0] - 2026-03-14
```

An optional one- or two-sentence summary may open a version section before the typed entries. Use it when a release is worth introducing (a major release, a notable change); skip it otherwise.

### Reference links

The square brackets make each version a Markdown reference link. Resolve every version once at the bottom of the file:

```markdown
[Unreleased]: https://github.com/your/project/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/your/project/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/your/project/releases/tag/v1.0.0
```

- `Unreleased` compares the latest tag to `HEAD`, so it always shows what has accrued since the last release.
- Every version compares itself to the one before it.
- The oldest version links to its tag; there is nothing earlier to compare with.
- Keep links out of the headings so the file reads cleanly.

## The Six Change Types

Group entries under exactly six headings, in this order:

- `Added` for new features.
- `Changed` for changes in existing functionality.
- `Deprecated` for soon-to-be-removed features.
- `Removed` for now-removed features.
- `Fixed` for bug fixes.
- `Security` for vulnerabilities.

Decision rules for the three that cause the most confusion:

- `Fixed`: the old behavior was wrong and is now correct.
- `Changed`: the old behavior worked as intended and now works differently. When unsure whether the old behavior was a bug, treat it as a bug: use `Fixed`.
- `Security`: addresses a vulnerability. It could fit under `Fixed` or `Changed`, but its urgency and audience differ, so it gets its own heading.

Other rules:

- Six types only, on purpose. What kind of change it is goes in the type; why it matters goes in the wording. `Improved` and `New` are usually just `Changed` and `Added`; `Performance`, `Internal`, and `Housekeeping` are not types.
- Dependencies are not a type. If a dependency update matters to users, describe its effect under the right type; otherwise leave it out.
- Known issues are not a type. Note them on the affected version or in the issue tracker; once fixed they go under `Fixed`.
- When a `Security` entry has a CVE identifier, lead with it so readers and security tools can match the entry to the advisory:

```markdown
- CVE-2024-12345: out-of-bounds read when parsing malformed input.
```

## Breaking Changes

Mark breaking changes so they cannot be missed, but keep them in their type:

```markdown
### Changed

- **Breaking:** `parse()` now returns a result object instead of raising.
```

- Use a `**Breaking:**` marker inside the entry, under `Changed` or `Removed` as appropriate. Do not collect breaks into a separate section; anyone scanning `Changed` or `Removed` should see them in place.
- Say what breaks: state which interface the versioning scheme covers (a CLI, a library API, a network protocol, a file format, a configuration schema).
- A short upgrade note can sit in the entry itself ("rename the `color` option to `theme`").
- When the steps are substantial, link out to a migration guide or the release notes instead of spelling them out. A long procedure turns a scannable record into a how-to.

## Writing Each Entry

Entries are freeform prose, but good ones repeat a few shapes. Match these
patterns; they are what make a changelog read like a changelog rather than a
pile of commit messages.

**State the outcome, not the task.** Write what is true now, from the reader's
view, not what was done in the code:

- Good: "Requests no longer hang when the server closes a connection mid-response."
- Weak: "Fixed connection close handling." (names the area, not the outcome)

**Name the thing.** Use the actual function, option, file, or section name so
the reader can find it: "renamed the `headers` option to `defaultHeaders`",
"the `Client` constructor now takes a `proxy` option".

**Signal behavior change with "now" and "no longer".** These two words keep a
change legible even when the section is skimmed:

- "the client now reuses connections to the same host"
- "Requests no longer hang when the server closes a connection mid-response."

**Add a payoff clause when the reason is not obvious.** A tail starting with
"so", "since", or "to" explains why the change matters:

- "Connection pooling is on by default, so a busy client opens fewer sockets."
- "The promise-based form is now the supported one, since callers expect the
  response body directly."

Skip it when the benefit is self-evident. One entry, one payoff.

**Split complex entries with a colon or semicolon.** Lead with the change, then
the consequence or detail:

- "Requests to the same host now reuse connections: a busy client opens fewer
  sockets."

**Group related points under a labeled lead-in.** When one change has several
parts, open with a short lead-in line and give each part a label before its colon:

- The request API gains three customization options:
  - Timeout: per-request deadline, set with `Client.withTimeout(ms)`.
  - Retry: automatic retries for idempotent requests with backoff.
  - Proxy: route requests through a forward proxy.

**Use one tense, one length, per section.** Every entry in a section should be
the same shape, so the section reads as siblings. Past tense or present state
both work; pick one and stay with it. Fragments are acceptable only when the
change is trivial and self-explanatory ("Fix a typo in the connection error
message."); anything consequential gets a full sentence.

**No first person, no editorializing.** No "we", no exclamation marks, no jokes,
no weak filler ("hopefully", "etc."). Plain, neutral, third-person voice.

**One change per entry.** Split distinct changes into separate bullets; merge
near-duplicates. A section with the same entry three times is noise.

## Cutting a Release

When a release is cut:

1. Rename `## [Unreleased]` to `## [1.2.0] - YYYY-MM-DD` in both the heading and its reference link.
2. Add a fresh, empty `Unreleased` section at the top, with its link pointing at `HEAD`.
3. Add the new version's compare link at the bottom.
4. Leave the version number and date in the `## [x.y.z] - YYYY-MM-DD` format.

The project does not have to use Semantic Versioning. Calendar versioning, a plain number, or a date all work; the preamble names whichever scheme is used. Projects that release continuously with no version numbers can keep dated entries under `Unreleased`.

## Deprecations and Removals

Announce a deprecation before acting on it:

- Mark the feature `Deprecated` in one release and say which version will remove it.
- Only later, in the named release, move it under `Removed`.

If nothing else, always record deprecations, removals, and breaking changes. Someone upgrading should meet the warning before the change.

## Yanked Releases

A yanked release is a version pulled because of a serious bug or security issue. List it; do not hide it. Mark it like this:

```markdown
## [0.0.5] - 2014-12-13 [YANKED]
```

The brackets make the tag easy to notice and easy to parse. A short plain-language reason and a pointer to the fixed release are welcome additions.

## Changelogs vs Release Notes

The changelog is the complete, ongoing record: every notable change across every version, kept in one file in the repository, written plainly. Release notes are an announcement for a single release, drawn from the changelog when that version ships. Do not maintain two sources of truth. At release time, the version's section is already the draft: copy it into the release and expand it only if the announcement wants more. A host's generated release notes live in the host's database and are lost if the project moves; the changelog travels with the repository. Keep `CHANGELOG.md` canonical.

## Drafting with AI (How This Skill Applies)

- Write entries for the people who use the software: what changed and why it matters, in plain words. Many readers are not native speakers; favor clear, concise wording.
- Never paste a git log and never reword commit messages into entries. A commit records a step in the source; an entry records a notable difference, often spanning several commits, written from the reader's point of view.
- Draft under `Unreleased` as code changes land. Do not edit past release sections except to fix a genuine error; when you do, consider noting the correction date.
- Curate: include only notable changes. Deciding what is notable is human judgment; when in doubt, leave a change out. Do not sort every commit into a type.
- If asked to generate a changelog from a diff or a commit history, produce a draft and say it is a draft: unread, unverified, and needing a human review before it is final. The brief is: summarize notable, user-facing changes; sort each into one of the six types; explain the reason in the text; mark breaking changes; remove anything not worth reading.
- If the project uses coding agents and keeps an `AGENTS.md` or `CLAUDE.md`, that brief belongs there so every agent drafts to the same standard.
- Never invent version numbers, dates, tags, or URLs. If a compare URL or tag is unknown, write the reference link as a placeholder and say it needs to be filled in.
- Automation and CI belong in a supporting role: move `Unreleased` into a dated version at release time, check formatting. Do not make a changelog edit a required check on every change; that teaches people to add a line to pass the check, which fills the file with noise.
- A convention such as Conventional Commits can feed a changelog draft, but commits and changelog entries are written for different people and one does not convert cleanly into the other. Treat generated output as raw material, never as final.

## Common Mistakes

- **Commit log diffs:** pasting `git log` output or reworded commit messages. The result is full of noise: merge commits, unclear messages, internal changes.
- **Inconsistent changes:** recording only some changes. Readers treat the changelog as the full picture, so leave out trivial changes but include every notable one.
- **Ignoring deprecations:** removing a feature without a prior `Deprecated` release naming the removal version.
- **Wrong type:** labeling an intentional behavior change `Fixed`, or a genuine bug fix `Changed`. Ask whether the old behavior was a bug; if it was, it is `Fixed`.
- **Hidden breaking changes:** no `**Breaking:**` marker, or breaks collected in a separate section where readers scanning `Changed` or `Removed` miss them.
- **Adding types:** inventing `Performance`, `Internal`, `Housekeeping`, or a "Dependencies" section. Six types only.
- **Outcome-less fragments:** "Fixed connection handling" without saying what
  changed for the user. Fragments are fine for trivial fixes, not for
  consequential ones.
- **Mixed tense within a section:** some entries in past tense, others imperative
  fragments. Pick one shape for the whole section.
- **Editorializing:** "we", exclamation marks, jokes, "hopefully", "etc.". The
  voice is neutral and plain.
- **Em and en dashes:** never use em dashes (`—`) or en dashes (`–`) in changelog entries. Use a hyphen or restructure the sentence.
- **Missing or wrong links:** versions without reference links, or a version compared against the wrong previous release.
- **Missing or wrong dates:** no date, or a non-ISO date format.
- **Invented facts:** versions, dates, CVEs, tags, or URLs that were not supplied. Placeholder and flag, never fabricate.

## Quick Reference Checklist

- [ ] `# Changelog` heading and fixed preamble naming the format and the versioning scheme
- [ ] `## [Unreleased]` at the top, its link comparing the latest tag to `HEAD`
- [ ] Exactly six type headings, in order, with correct Fixed/Changed/Security decisions
- [ ] `**Breaking:**` marker kept inside its type, stating which interface breaks
- [ ] `## [x.y.z] - YYYY-MM-DD` headings, newest first
- [ ] Every version linked: compare with the previous version, oldest links to its tag
- [ ] Deprecations name their removal version; removals follow a prior deprecation
- [ ] `[YANKED]` marked and never hidden
- [ ] Entries written for users, not reworded commits
- [ ] Only notable changes; nothing trivial padded in
- [ ] No em dashes, no en dashes
- [ ] No invented versions, dates, tags, or URLs; placeholders flagged
- [ ] Each entry states the outcome from the user's view and names the thing
- [ ] Payoff clause ("so", "since", "to") present when the reason is not obvious
- [ ] One tense and roughly one length across each section
- [ ] No "we", no exclamation marks, no filler words
