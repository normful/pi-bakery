// ownership.ts — echo suppression, race guard, replaceability rules.
import type { RenameState } from "./state.js";
import type { Config } from "./config.js";

/**
 * May the current name be replaced by a new auto-generated one?
 * `always` → anything (named or not). `never` → only unnamed.
 *
 * pi's `getSessionName()` returns `string | undefined`, and resolves to
 * `undefined` both when a session is unnamed and when its name was cleared to
 * empty — there are no well-known placeholder strings to special-case. The
 * unnamed/empty case is handled by the `!currentName` short-circuit, so
 * `never` replaces nothing that is already named.
 */
export function canReplace(
  currentName: string | undefined,
  policy: Config["replaceExistingName"],
): boolean {
  if (!currentName) return true;
  return policy === "always";
}

/**
 * Handle session_info_changed. Our own rename (echo) is recognized by equality with
 * lastAutoName and ignored; anything else is an external rename.
 */
export function handleSessionInfoChanged(
  state: RenameState,
  newName: string | undefined,
  respectExternalRenames: boolean,
): void {
  if (newName === state.lastAutoName) return; // echo of our own rename
  if (respectExternalRenames) state.autoRenameLocked = true; // one-way latch: no more auto-renames this session
}

/**
 * Reconcile persisted provenance on session_start (resume/reload). A fresh
 * incarnation resets in-memory state, but the transcript remembers whether
 * this extension already named the session — apply the same rules as the
 * live event path so a resume cannot undo them:
 * - current name is our last auto name → the initial rename already landed:
 *   latch `done` instead of churning an established name on next input.
 * - current name diverged to a real external name → the one-way ownership
 *   latch, exactly as if the rename event had arrived live.
 * - otherwise (fresh session, cleared name, or respect disabled) → untouched;
 *   normal replaceability policy applies.
 */
export function reconcileProvenanceOnStart(
  state: RenameState,
  currentName: string | undefined,
  respectExternalRenames: boolean,
): void {
  if (!state.lastAutoName) return;
  if (currentName === state.lastAutoName) {
    state.done = true;
    return;
  }
  if (currentName && respectExternalRenames) state.autoRenameLocked = true;
}
