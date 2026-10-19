// paths.ts — filesystem path identity for ownership checks.
import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** Expand a leading `~` so a home-relative spelling compares as the same file. */
function expandHome(value: string): string {
  if (value === "~") return homedir();
  return value.startsWith("~/") ? join(homedir(), value.slice(2)) : value;
}

/**
 * Canonical spelling of a path: `realpathSync.native` resolves symlinks,
 * collapses trailing separators and `.`/`..`, and returns the on-disk casing,
 * so `…/CODE/repo` and `…/code/repo` compare equal on a case-insensitive
 * volume (default APFS) — plain `realpathSync` keeps the caller's case. A path
 * that does not exist degrades to `resolve`, which still collapses separators
 * without touching the filesystem; any other failure (EACCES, ELOOP, ENOTDIR)
 * is rethrown, because there the on-disk identity is unknown and the caller
 * treats "unknown" as "not mine".
 */
function canonicalPath(value: string): string {
  const expanded = expandHome(value);
  try {
    return realpathSync.native(expanded);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error;
    return resolve(expanded);
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
