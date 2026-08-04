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
