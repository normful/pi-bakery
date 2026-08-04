// state.ts — per-session state + transcript provenance.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export const ENTRY_TYPE = "pi-auto-name";

export interface RenameState {
  done: boolean; // initial rename completed or skipped
  inflight: boolean; // generation in progress
  lastAutoName: string | undefined; // last STORED session name set by this extension (echo suppression)
  lastAutoWindowName: string | undefined; // last STORED window name set by this extension (surface restore on resume)
  autoRenameLocked: boolean; // external rename latched: auto-renaming is locked off for the session (when respectExternalRenames)
  turnsSeen: number; // agent_settled counter (turn-interval re-rename; one settled user-facing turn = one unit)
  nameAtGenerationStart: string | undefined; // for the race guard
}

export function createState(): RenameState {
  return {
    done: false,
    inflight: false,
    lastAutoName: undefined,
    lastAutoWindowName: undefined,
    autoRenameLocked: false,
    turnsSeen: 0,
    nameAtGenerationStart: undefined,
  };
}

/**
 * Record a rename: remember the STORED (normalized) session name for echo
 * suppression and the window name for surface restore, and persist both as
 * provenance. The caller passes the name it set; the stored name is re-read
 * from pi so that normalization inside setSessionName (trim, newline collapse)
 * cannot break the echo-equality check in ownership.ts. The extension
 * session_info_changed echo is dispatched fire-and-forget (async), so
 * lastAutoName is always set before the echo handler runs. `windowName` is
 * optional: the temporary-title flow records a session name only, leaving the
 * previous window name intact.
 */
export function recordAutoRename(
  pi: ExtensionAPI,
  state: RenameState,
  sessionName: string,
  windowName?: string,
): void {
  state.lastAutoName = sessionName;
  if (windowName) state.lastAutoWindowName = windowName;
  pi.appendEntry(ENTRY_TYPE, {
    sessionName,
    ...(windowName ? { windowName } : {}),
    at: new Date().toISOString(),
  });
}

/** Scan transcript for our entries so `lastAutoName`/`lastAutoWindowName` survive reload/resume. */
export function restoreProvenance(ctx: ExtensionContext, state: RenameState): void {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type !== "custom" || entry.customType !== ENTRY_TYPE) continue;
    const data = entry.data as { sessionName?: string; windowName?: string } | undefined;
    if (!data) continue;
    if (typeof data.sessionName === "string") state.lastAutoName = data.sessionName;
    // Restored verbatim: what we persisted was already the canonical surface
    // label (sanitizeWindowName output). Re-compacting here would rewrite
    // non-`natural` styles (topic-project's ｜ separator, slug's hyphens).
    if (typeof data.windowName === "string") state.lastAutoWindowName = data.windowName;
  }
}
