// paths.ts — filesystem path identity for ownership checks.
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Canonical spelling of a path: `realpathSync.native` resolves symlinks,
 * collapses trailing separators and `.`/`..`, and returns the on-disk casing,
 * so `…/CODE/repo` and `…/code/repo` compare equal on a case-insensitive
 * volume (default APFS) — plain `realpathSync` keeps the caller's case. A path
 * that does not exist degrades to `resolve`, which still collapses separators
 * without touching the filesystem; any other failure (EACCES, ELOOP, ENOTDIR)
 * is rethrown, because there the on-disk identity is unknown and the caller
 * treats "unknown" as "not mine".
 *
 * No `~` expansion on purpose: every operand already arrives absolute. herdr
 * stores a reported session path only when `Path::new(value).is_absolute()`
 * (`src/agent_resume.rs`) and filters the pane `cwd`/`foreground_cwd` the same
 * way, so it cannot emit a home-relative spelling; pi's own session file is
 * built from an absolute session directory. A relative operand fails closed
 * rather than matching the wrong directory.
 */
function canonicalPath(value: string): string {
  try {
    return realpathSync.native(value);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error;
    return resolve(value);
  }
}

/**
 * True when two spellings name the same filesystem location. Ownership checks
 * compare paths that arrive from different sources (a herdr pane payload vs
 * `process.cwd()`), so a spelling difference must never decide the comparison.
 * Identical strings short-circuit without a syscall. Throws only when a path
 * exists but cannot be resolved (see `canonicalPath`).
 */
export function samePath(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return canonicalPath(a) === canonicalPath(b);
}
