# Plan: pi-socrates no-UI reconcile (option C + B) + alternative keybinds

Status: proposed, not implemented.
Scope: survey only (1C). Picker UX + conceptually new schema types tracked separately.

Standard: every change is authored **test-first (red → green)**. Each subsection below
lists the test that must fail first, then the minimal implementation that makes it pass.
Run the RED step and confirm the expected failure before writing implementation code.

## Goal
- Never show `socrates` tool when `!hasUI`.
- Auto-restore when UI returns.
- Keep tiny backstop in handler.
- No new public event. No ownership check.

## Verified API facts (evidence)
- `ExtensionContext.hasUI` exists, resolved at call time
  (`dist/core/extensions/types.d.ts:215`, `dist/core/extensions/runner.js:472`).
- `ExtensionAPI.getActiveTools()` / `setActiveTools(names)` exist
  (`types.d.ts:978,982`). `setActiveToolsByName` ignores unknown names and rebuilds the
  system prompt (`dist/core/agent-session.js:634`), so a `before_agent_start` handler
  changes the **current** turn.
- `before_agent_start` is emitted inside `AgentSession.prompt` before `_runAgentPrompt`
  (`agent-session.js:888`), so the strip happens before the LLM request is built.
- Once stripped, a tool call for an inactive tool returns `Tool <name> not found`
  (`pi-agent-core/dist/agent-loop.js:394-398`). Therefore the backstop text is reachable
  only via a direct `execute` call, not through the agent loop (see test split in 1.3).

---

# Part 1 — no-UI reconcile

## 1.1 New `packages/pi-socrates/src/reconcile.ts`

```ts
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export const ASK_TOOL_NAME = "socrates";

/** Idempotent. Returns true when the active tool list changed. */
export function reconcileTool(
  pi: Pick<ExtensionAPI, "getActiveTools" | "setActiveTools">,
  ctx: Pick<ExtensionContext, "hasUI">,
): boolean {
  const active = pi.getActiveTools();
  const present = active.includes(ASK_TOOL_NAME);
  if (!ctx.hasUI && present) {
    pi.setActiveTools(active.filter((name) => name !== ASK_TOOL_NAME));
    return true;
  }
  if (ctx.hasUI && !present) {
    pi.setActiveTools([...active, ASK_TOOL_NAME]);
    return true;
  }
  return false;
}

export function registerReconciler(pi: ExtensionAPI): void {
  pi.on("before_agent_start", (_event, ctx) => {
    reconcileTool(pi, ctx);
  });
}
```

- `ASK_TOOL_NAME` moves here (single source of truth); `index.ts` imports it.
- No ownership check (tool name `socrates` is unique across extensions).
- `setActiveTools` is called **only** when something changes (idempotence contract).

## 1.2 Edit `packages/pi-socrates/src/index.ts`

- Import `ASK_TOOL_NAME`, `registerReconciler` from `./reconcile.js`; delete the local
  `const ASK_TOOL_NAME`.
- Call `registerReconciler(pi)` in `askExtension(pi)`.
- Keep the `!ctx.hasUI` guard as a backstop, change shape:
  - Old: `Error: tool requires interactive mode`, `details: {}`.
  - New text: `socrates unavailable in this mode. Ask the user in plain text instead. Do NOT treat this as a decline.`
  - New `details: { status: "unavailable" }`.
  - Rationale: a future Pi may snapshot tools before `before_agent_start`, and direct
    RPC/SDK/test callers can still hit `execute`.

## 1.3 Tests (unit + integration), red → green

### RED 1 — `packages/pi-socrates/test/reconcile.test.ts` (new)

Fake `pi` records every `setActiveTools` call:

```ts
function fakePi(active: string[]) {
  const state = { active: [...active], calls: [] as string[][] };
  return {
    getActiveTools: () => [...state.active],
    setActiveTools: (names: string[]) => { state.calls.push([...names]); state.active = [...names]; },
    calls: state.calls,
    active: () => [...state.active],
  };
}
```

Cases (each `expect` fails against the not-yet-written module):
1. `!hasUI` + present → returns `true`; `active()` excludes `socrates`; other names and
   their order preserved; exactly one `setActiveTools` call.
2. `hasUI` + absent → returns `true`; `active()` ends with `socrates`; other names preserved.
3. `hasUI` + present → returns `false`; `calls` is empty (no-op).
4. `!hasUI` + absent → returns `false`; `calls` is empty (no-op).
5. empty active list + `!hasUI` → returns `false`; no call.
6. `registerReconciler` registers a `before_agent_start` handler: capture `pi.on`'s
   `(event, handler)`, assert `event === "before_agent_start"`, invoke
   `handler({}, { hasUI: false })`, assert `active()` excludes `socrates`.

### GREEN 1 — write `src/reconcile.ts` (1.1).

### RED 2 — update `packages/pi-socrates/test/index.test.ts`

- Change the existing `"returns error when UI is unavailable"` case to assert the new
  text and `details`:
  - `getTextContent(result)` contains `socrates unavailable in this mode`;
  - `result.details` equals `{ status: "unavailable" }`;
  - `execute(...)` resolves (does not throw) and `ui.custom` is never called.
- Add an explicit case: with `hasUI: false` and a `ui.custom` that throws if called,
  `execute` still resolves with the unavailable result (proves the backstop never opens UI).

### GREEN 2 — edit `src/index.ts` (1.2). Re-run RED 1 + RED 2; all green.

### RED 3 — harness support in `packages/pi-socrates/test/integration/harness.ts`

Add to `Harness`:
- `activeToolNames: () => string[]` → wraps `session.getActiveToolNames()`.
- `bindMode: (mode: "tui" | "print") => Promise<void>` → calls `session.bindExtensions`
  again with the same captured `uiContext` for `tui`, and without `uiContext` for `print`.
  Only `print → tui` restore is supported via the public API (there is no public way to
  *remove* a UI context once set; do not claim strip-on-rebind in tests).

### RED 4 — `packages/pi-socrates/test/integration/reconcile.integration.test.ts` (new)

Capture what the LLM actually receives via a faux response factory (the factory receives
the `Context`, and `Context.tools` is the active tool list):

```ts
h.faux.setResponses([
  (context) => { seen.push((context.tools ?? []).map((t) => t.name)); return fauxAssistantMessage("ok"); },
]);
```

- **INT-R1** `print mode does not offer socrates to the LLM`: create harness in `print`
  mode; sanity-check that `activeToolNames()` initially includes `socrates` (proves the
  strip is triggered by the prompt, not by registration); `await session.prompt(...)`;
  assert `seen[0]` excludes `socrates` and `activeToolNames()` excludes it.
- **INT-R2** `auto-restores socrates when the UI becomes available`: harness starts in
  `print`; first prompt excludes it; `await h.bindMode("tui")`; second prompt — assert
  `seen[1]` includes `socrates` and `activeToolNames()` includes it.
- **INT-R3** `stripped tool is not executable through the loop`: in `print` mode set a
  faux response that calls `socrates`; assert the stored toolResult text includes
  `Tool socrates not found`. This repurposes the old print-mode assertion and documents
  that the backstop string is unit-only.

### RED 5 — update the existing print-mode case in
`packages/pi-socrates/test/integration/socrates.integration.test.ts`

The current `"refuses in print mode without invoking the UI"` expects
`requires interactive mode`, which the reconcile now prevents. Replace its assertion with
INT-R3's `Tool socrates not found` (or delete it in favour of INT-R3) and keep the
"`customCallCount() === 0`" assertion.

### GREEN 3 — harness support + `registerReconciler` wiring already landed in GREEN 2.

---

# Part 2 — alternative keybinds for same actions (no new functionality)

Goal: same action, more keys. No new picker behavior. Exactly one clear-note key inside
the editor (`F7`); **no `Ctrl+U`** (it collides with pi-tui's `Editor`
`ctrl+u = tui.editor.deleteToLineStart`, `pi-tui/dist/keybindings.js:64`).

Applied per UI:

| Key | Where | Action |
| --- | --- | --- |
| `j` / `k` | both UIs, editor closed | same as `Down` / `Up` |
| `[` / `]` | tabs UI, editor closed | same as `Left` / `Right` |
| digits | tabs UI, editor closed | jump: `1..Q` → question tab, `0` → Submit tab |
| `d` | both UIs, editor closed | clear the cursor option's saved note |
| `F7` | editor open (unchanged) | clear note text |
| `[` `]` digits | single-question UI | no-op |
| `d` on Submit tab | tabs UI | no-op |

## 2.1 Digit-jump buffer (tabs UI only)

Constants (in `ask-tabs-ui.ts`, exported for tests):
- `DIGIT_JUMP_TIMEOUT_MS = 600`
- `MAX_DIGIT_BUFFER_LENGTH = 2`

Rules (locked):
- `0` with an empty buffer → commit to the Submit tab immediately.
- `1..9` → append to the buffer; start/refresh a `setTimeout(DIGIT_JUMP_TIMEOUT_MS)`
  that commits on expiry.
- buffer reaches 2 digits → commit immediately (`0` appended to a pending digit builds
  `10`, `12`, …).
- commit = resolve `target === 0 ? submitTabIndex : target - 1`; if in range set
  `activeTabIndex` and rerender; otherwise ignore (invalid two-digit / out-of-range
  single digit → clear and do nothing).
- any non-digit key with a pending buffer → commit the buffer first, then handle the key
  normally.
- note editor open → digits are text; buffer disabled.
- `done()` (submit or cancel) → clear the timer (no late rerender / handle leak).

## 2.2 Pinned footer hints

Convention: ASCII only, one word per action, grouped and ordered
*navigate → act → annotate → exit*. Every string below includes its leading space and
replaces the current `theme.fg("customMessageLabel", …)` text verbatim.

Rules:
- `d clear` appears **only** when the cursor option actually has a note.
- `[/]` and digits never appear in the single-question UI.
- Hints are clipped by `truncateToWidth`; tests assert leading substrings, or render at
  width ≥ 80 when asserting a tail segment.

Single-question (`src/ask-inline-ui.ts`):

| State | Hint string |
| --- | --- |
| editor open | ` Editing note · Enter submit · Tab/Esc done · F7 clear` |
| editor closed, cursor option has a note | ` ↑↓/jk · Enter pick · Tab note · d clear · F6 exit` |
| editor closed, cursor option has no note | ` ↑↓/jk · Enter pick · Tab note · F6 exit` |

Tabs (`src/ask-tabs-ui.ts`):

| State | Hint string |
| --- | --- |
| question tab, editor open | ` Editing note · Enter save · Tab/Esc done · F7 clear` |
| question tab, editor closed, cursor option has a note | ` ↑↓/jk · ←→/[] · 0-9 jump · Enter pick · Tab note · d clear · F6 exit` |
| question tab, editor closed, cursor option has no note | ` ↑↓/jk · ←→/[] · 0-9 jump · Enter pick · Tab note · F6 exit` |
| Submit tab | ` ←→/[] · 0-9 jump · Enter submit · F6 exit` |

Pending digit buffer: when `pendingDigitBuffer` is non-empty, append ` · tab N…`
(N = the buffered digits) to the current line, e.g.
` ←→/[] · 0-9 jump · Enter submit · F6 exit · tab 1…`.

## 2.3 Implementation notes
- Files: `src/ask-inline-ui.ts` `handleInput`, `src/ask-tabs-ui.ts` `handleInput`.
- Reuse `matchesKey` with `Key.leftbracket` / `Key.rightbracket`; use `Key` for specials.
- `d`/digit/`[`/`]` branches only in the **editor-closed** path; `F7` stays in
  `handleNoteEditorInput` (`ask-ui-shared.ts`).
- `d` clears the cursor option's note in the existing map:
  single-question → `noteByOptionIndex`; tabs → `noteByQuestionByOption[q][cursor]`
  (this includes the Other option's note). Never touches selection.
- Apply the exact hint strings from 2.2 (and the ` · tab N…` pending segment). Current
  hint sites to replace (line numbers pre-change):
  - `src/ask-inline-ui.ts`: `139` (editing), `146` (closed + has note), `153` (closed, no note)
  - `src/ask-tabs-ui.ts`: `292` (Submit tab), `343` (editing), `351` (multi), `358` (single)
  - Update the existing hint assertions accordingly (see RED 7).
- New render branch required: the pinned tabs question-tab hints have a **has-note**
  variant (`d clear` present) that the current tabs renderer does not produce — it only
  branches editing vs. not. Add the same `getQuestionNote(q, cursor).trim().length > 0`
  branch the single-question renderer already has (`ask-inline-ui.ts:145`). The Submit-tab
  hint never includes `d clear`.

## 2.4 Tests (unit + integration), red → green

### RED 6 — `packages/pi-socrates/test/ask-keybinds.test.ts` (new)

Drives the `ui.custom` component directly (same pattern as `ask-ui-interaction.test.ts`).
Use `vi.useFakeTimers()` for timeout cases; assert via `component.render(width)`
(question text / `●` cursor marker / `— note:` presence / `Review answers`).

Single-question UI:
1. `j`/`k` move the cursor like `Down`/`Up`.
2. `d` clears the current option's saved note; selection unchanged.
3. `[`, `]`, and digits are no-ops.

Tabs UI:
4. `j`/`k` move the cursor like `Down`/`Up`.
5. `[`/`]` switch question tabs like `Left`/`Right`.
6. single digit (`1`) jumps after the timeout commits.
7. two digits (`12`) jump immediately; a ≥10-question fixture proves tab 12 is reachable.
8. `0` jumps to the Submit tab immediately.
9. invalid two-digit (`13` with 2 questions) is ignored; no tab change.
10. a non-digit key commits a pending digit before handling.
11. `d` clears the current option's note on a question tab; no-op on the Submit tab.
12. digits typed while the note editor is open stay as note text (no jump, no buffer hint).
13. the pending-digit footer segment (` · tab 1…`) appears while waiting, on the exact
    hint line for that state (2.2) — cover both a question tab and the Submit tab.
14. a pending-digit timer is cleared on cancel (spy on `tui.requestRender`; advance
    timers after `Ctrl-C`; assert no late calls).
15. the `d clear` segment appears in the hint **only** when the cursor option has a note
    (both UIs): assert exact pinned strings from 2.2 with and without a note.

### GREEN 4 — implement 2.1 + 2.2 + 2.3 until RED 6 is green.

### RED 7 — update hint-sensitive assertions
- `test/ask-ui-interaction.test.ts`: lines `63`, `233`, `282` assert `Typing note inline`
  → replace with `Editing note` (or the full pinned editing string). Line `132` asserts
  `Tab edit note` → replace with the pinned closed + has-note string.
- Assert the full pinned strings (2.2) at width ≥ 80 where a tail segment is involved;
  at the narrow widths these tests use (26/28/32), assert only the leading substring
  (`Editing note`, `↑↓/jk`).

### RED 8 — integration keybind coverage in
`packages/pi-socrates/test/integration/socrates.integration.test.ts` (new describe)
- **INT-K1** `runs the picker using only the new keys`: a 2-question flow driven by
  `j`/`k`, `[`/`]`, `d`, and `0` (Submit). Assert the stored answers, e.g.
  `auth: …`, `cache: …`, and a cleared note is absent.
- Note: digit **timeout** is unit-only (fake timers); the integration harness drives
  keystrokes synchronously, so integration covers only the immediate digit paths (`0`,
  and two-digit if a ≥10-question fixture is added).

### GREEN 5 — no code change expected (GREEN 4 covered it); re-run the integration suite.

---

## Non-goals
- No `socrates:availability` event (only existing `herdr:blocked` stays).
- No RPC dialog walker (option B), no plain-text question dump (option A), no subagent
  socket relay (option D).
- No timeout change (keep wait-forever).
- No `Ctrl+U` (collides with pi-tui Editor).
- No new question types, no preview pane, no i18n, no dangerous-confirm, no command-only
  pattern.

## Verify
- `npm run typecheck`
- `npm test -- --project pi-socrates` (or `npm test -- packages/pi-socrates/`)
- `npm run lint`

## Decisions locked
- 1: `!hasUI` only (not `mode !== "tui"`).
- 2: auto-restore.
- 3: skip ownership check.
- 4: backstop text = unavailable + plain-chat guidance (option B).
- 5: skip availability event.
- 6: backstop is unit-tested only; integration asserts "not offered" / `Tool socrates not
  found` (1a).
- 7: no `Ctrl+U`.
- 8: digit buffer = `0` immediate, `1..9` wait, 2 digits commit immediately, timeout
  commits a single digit, invalid two-digit clears and ignores, non-digit key commits
  pending then handles.
- 9: single-question UI ignores `[`/`]`/digits; `j`/`k`/`d` apply.
- 10: `d` clears the cursor option's note (incl. Other), no-op on Submit, never changes
  selection.
- 11: footer hints pinned verbatim in 2.2 — concise one-word-per-action ASCII, grouped
  *navigate → act → annotate → exit*, `d clear` shown only when a note exists,
  `Enter submit` (single) / `Enter save` (tabs) while editing. Full discoverability
  (option 6b); truncation at narrow widths accepted.
- 12: new `test/reconcile.test.ts` and `test/ask-keybinds.test.ts`; extend `index.test.ts`,
  `ask-ui-interaction.test.ts`, and the integration harness.
- 13: no keys-only footer + legend variant; the footer stays self-explanatory.

## Assumptions (unverified)
- "Headless subagent runs emit `before_agent_start` per run" is **not verified**. No
  subagent runner exists in `@earendil-works/pi-coding-agent`; if subagents use a raw
  `Agent` rather than `AgentSession.prompt`, the reconciler will not run for them. Treat
  as an open assumption; no test claims to cover it.
- `Context.tools` inside the faux response factory is the active tool list. INT-R1/R2
  also assert `session.getActiveToolNames()`, so the tests remain meaningful if the tools
  capture shape differs.
