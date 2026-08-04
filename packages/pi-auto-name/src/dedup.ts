// dedup.ts — existing session-name collection for the naming prompt.

export const MAX_EXISTING_SESSION_NAMES = 15;

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
  const sessions = await SessionManager.list(cwd);
  return sessions
    .filter((s) => s.name)
    .filter((s) => s.path !== currentSessionFile)
    .sort((a, b) => b.modified.getTime() - a.modified.getTime())
    .slice(0, MAX_EXISTING_SESSION_NAMES)
    .map((s) => s.name as string);
}
