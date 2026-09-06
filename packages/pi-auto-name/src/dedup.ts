// dedup.ts — existing session-name collection for the naming prompt.

export const MAX_EXISTING_SESSION_NAMES = 15;

/**
 * TTL for the per-cwd SessionManager.list cache. Listing scans every .jsonl
 * in the project session dir (O(n) reads, concurrency 10) plus a mkdirSync on
 * the read path — seconds of IO with hundreds of sessions. Dedup hints are
 * best-effort prompt text, so a short TTL trades a bounded staleness window
 * for skipping repeat scans across initial + interval re-renames.
 */
export const DEDUP_CACHE_TTL_MS = 30_000;

interface CachedSessionEntry {
  path: string;
  name?: string;
  modified: Date;
}

const listCache = new Map<string, { at: number; sessions: CachedSessionEntry[] }>();

/** Clear the dedup list cache (tests, and callers that just created a session). */
export function clearDedupCache(cwd?: string): void {
  if (cwd === undefined) listCache.clear();
  else listCache.delete(cwd);
}

/**
 * Names of the most recently modified OTHER sessions in this project.
 * The current session's file is excluded so its own name cannot become a
 * "name to avoid" (self-collision).
 */
export async function collectExistingSessionNames(
  cwd: string,
  currentSessionFile?: string,
): Promise<string[]> {
  // Lazy dynamic import: pi-coding-agent is only pulled in when the dedup
  // step actually runs (and only when skipSessionNameDedup is not set), not
  // at extension load time.
  const { SessionManager } = await import("@earendil-works/pi-coding-agent");
  const now = Date.now();
  const cached = listCache.get(cwd);
  let sessions: CachedSessionEntry[];
  if (cached && now - cached.at < DEDUP_CACHE_TTL_MS) {
    sessions = cached.sessions;
  } else {
    const listed = await SessionManager.list(cwd);
    sessions = listed.map((s) => ({ path: s.path, name: s.name, modified: s.modified }));
    listCache.set(cwd, { at: now, sessions });
  }
  return sessions
    .filter((s) => s.name)
    .filter((s) => s.path !== currentSessionFile)
    .sort((a, b) => b.modified.getTime() - a.modified.getTime())
    .slice(0, MAX_EXISTING_SESSION_NAMES)
    .map((s) => s.name as string);
}
