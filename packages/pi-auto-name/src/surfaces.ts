// surfaces.ts — session name / herdr pane / herdr tab / tmux window / zellij
// pane / zellij tab.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Config } from "./config.js";
import type { RenameState } from "./state.js";
import { compactWindowName } from "./sanitize.js";
import { recordAutoRename } from "./state.js";
import { debug } from "./debug.js";
import { samePath } from "./paths.js";

/**
 * Apply the session name (gated by `renamePiSession`), then record provenance
 * against the stored session name and window name. `lastAutoName`/`
 * lastAutoWindowName` are set BEFORE `setSessionName`: this pi build dispatches
 * the session_info_changed echo synchronously inside the set, so the echo
 * handler must already see `lastAutoName` or it will treat our own rename as
 * external and re-sync surfaces with a compacted window name. recordAutoRename
 * then re-reads the stored (normalized) name so echo equality survives any
 * normalization inside setSessionName. When `renamePiSession` is false, only
 * the herdr/tmux/zellij surfaces receive the window name (via syncSurfaces); no
 * session rename occurs and no provenance is recorded.
 */
export async function applySessionName(
  pi: ExtensionAPI,
  state: RenameState,
  cfg: Config,
  sessionName: string,
  windowName?: string,
): Promise<void> {
  if (!cfg.surfaces.renamePiSession) return; // herdr/tmux/zellij still applied via syncSurfaces
  state.lastAutoName = sessionName;
  if (windowName) state.lastAutoWindowName = windowName;
  pi.setSessionName(sessionName);
  recordAutoRename(pi, state, pi.getSessionName() ?? sessionName, windowName);
}

/**
 * The window name to display on non-session surfaces for a given session name:
 * the stored window name when it still matches the current session name (exact
 * restore on resume), else a compacted form of the session name (§4 rule 5).
 */
export function windowNameForSync(
  state: RenameState,
  sessionName: string | undefined,
): string | undefined {
  if (state.lastAutoName === sessionName && state.lastAutoWindowName) {
    return state.lastAutoWindowName;
  }
  if (sessionName) {
    return compactWindowName(sessionName, 1) ?? state.lastAutoWindowName;
  }
  return state.lastAutoWindowName;
}

/**
 * Re-apply the window name to every enabled non-session surface.
 * The terminal title is intentionally absent: pi formats `Pi - <name> - <cwd>`
 * from the session name on every session_info_changed, so the session-name
 * surface already drives it (§4 rule 5).
 *
 * `sessionFile` is this session's transcript path, forwarded to the herdr
 * ownership check so it can recognize its own pane; absent only when the host
 * has no session file.
 */
export async function syncSurfaces(
  pi: ExtensionAPI,
  cfg: Config,
  windowName: string | undefined,
  sessionFile?: string,
): Promise<void> {
  if (!windowName) {
    debug("syncSurfaces: skipped (no window name)");
    return;
  }

  const always = cfg.replaceExistingName === "always";
  debug("syncSurfaces", { windowName, always });
  if (cfg.surfaces.renameHerdrPane) {
    await renameHerdrPane(pi, windowName, always, sessionFile);
  }
  if (cfg.surfaces.renameHerdrTab) {
    await renameHerdrTab(pi, windowName, always, sessionFile);
  }
  if (cfg.surfaces.renameTmuxWindow) {
    await renameTmuxWindow(pi, windowName);
  }
  if (cfg.surfaces.renameZellijPane) {
    await renameZellijPane(pi, windowName);
  }
  if (cfg.surfaces.renameZellijTab) {
    await renameZellijTab(pi, windowName);
  }
}

// ---- herdr ----------------------------------------------------------------

/**
 * Multiplexer env, read fresh on every call — never captured at module load.
 * jiti may cache the module across reloads while the process re-attaches to a
 * different tmux/zellij session, so import-time values would go stale. The old
 * top-level `debug("surfaces env")` also ran before initDebug bound pi and was
 * silently lost; use logSurfacesEnv() from session_start instead.
 */
function envTrim(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

export function getSurfacesEnv(): {
  HERDR_ENV: string | undefined;
  HERDR_PANE_ID: string | undefined;
  HERDR_TAB_ID: string | undefined;
  TMUX: string | undefined;
  TMUX_PANE: string | undefined;
  ZELLIJ: string | undefined;
  ZELLIJ_PANE_ID: string | undefined;
} {
  return {
    HERDR_ENV: envTrim("HERDR_ENV"),
    HERDR_PANE_ID: envTrim("HERDR_PANE_ID"),
    HERDR_TAB_ID: envTrim("HERDR_TAB_ID"),
    TMUX: envTrim("TMUX"),
    TMUX_PANE: envTrim("TMUX_PANE"),
    ZELLIJ: envTrim("ZELLIJ"),
    ZELLIJ_PANE_ID: envTrim("ZELLIJ_PANE_ID"),
  };
}

/** Debug-log the current multiplexer env. Call from session_start (pi bound). */
export function logSurfacesEnv(): void {
  const env = getSurfacesEnv();
  debug("surfaces env", {
    herdr: {
      HERDR_ENV: env.HERDR_ENV,
      HERDR_PANE_ID: env.HERDR_PANE_ID,
      HERDR_TAB_ID: env.HERDR_TAB_ID,
    },
    tmux: { TMUX: env.TMUX, TMUX_PANE: env.TMUX_PANE },
    zellij: { ZELLIJ: env.ZELLIJ, ZELLIJ_PANE_ID: env.ZELLIJ_PANE_ID },
  });
}

/** herdr's read-only native-session identity for the agent occupying a pane. */
interface HerdrAgentSession {
  agent?: string;
  kind?: string;
  source?: string;
  value?: string;
}
interface HerdrPaneInfo {
  pane?: {
    pane_id?: string;
    label?: string;
    pane_label?: string;
    manual_label?: string;
    tab_id?: string;
    agent?: string;
    cwd?: string;
    foreground_cwd?: string;
    agent_session?: HerdrAgentSession;
  };
}
/** The pane fields `herdr pane current` reports — the same payload as `pane get`. */
type HerdrPane = NonNullable<HerdrPaneInfo["pane"]>;
interface HerdrTabInfo {
  tab?: { tab_id?: string; label?: string; number?: number };
}

/**
 * Ownership check for the `pane current` fallback. Without a caller pane id
 * herdr returns the pane focused in the client — which can belong to the user,
 * another client, or another pi — so the payload is trusted only on positive
 * evidence:
 *
 * 1. it reports THIS session's transcript path (`agent_session`, kind "path"),
 *    the identity herdr's own `herdr:pi` integration publishes; or
 * 2. this session has no transcript of its own (an in-memory host session), and
 *    the pane hosts a pi (`agent === "pi"`) whose tracked or foreground cwd
 *    resolves to this process's cwd and which reports no session path.
 *
 * A missing `agent`/`cwd` (herdr omits both when it cannot resolve them), a
 * foreign cwd, any path-kind session other than this one's, and a path reported
 * to a host that has none of its own all fail closed: the pane and tab renames
 * are skipped, never another pane's label.
 */
function isOurPane(pane: HerdrPane | undefined, sessionFile: string | undefined): boolean {
  if (!pane) return false;
  const reported = pane.agent_session;
  const reportedPath = reported?.kind === "path" ? reported.value : undefined;
  if (samePath(reportedPath, sessionFile)) return true;
  // With a transcript of our own, only that transcript proves ownership: a
  // matching cwd cannot separate two pi sessions in one directory, and a
  // path-kind session we cannot match belongs to somebody else.
  if (sessionFile) return false;
  if (pane.agent !== "pi") return false;
  if (reportedPath) return false; // a path we cannot compare is another session's
  const ownCwd = process.cwd();
  return samePath(pane.foreground_cwd, ownCwd) || samePath(pane.cwd, ownCwd);
}

/**
 * Resolve the pane (and tab) this pi process runs in. Prefers the herdr env
 * vars; when `HERDR_PANE_ID` is missing (pi launched from a shell herdr did
 * not inject env into), falls back to `herdr pane current`, which answers with
 * the *focused* pane rather than this process's pane — so the payload is
 * trusted only after `isOurPane` (see there) finds positive ownership evidence.
 */
async function herdrCurrentIds(
  pi: ExtensionAPI,
  sessionFile: string | undefined,
): Promise<{ paneId: string; tabId?: string } | undefined> {
  const env = getSurfacesEnv();
  if (env.HERDR_PANE_ID) {
    return { paneId: env.HERDR_PANE_ID, tabId: env.HERDR_TAB_ID || undefined };
  }
  try {
    const r = await pi.exec("herdr", ["pane", "current"], { timeout: 5000 });
    const pane = JSON.parse(r.stdout)?.result?.pane as HerdrPane | undefined;
    if (!isOurPane(pane, sessionFile)) {
      debug("herdrCurrentIds: `pane current` is not this pi's pane — ignoring", {
        agent: pane?.agent,
        cwd: pane?.cwd,
        foregroundCwd: pane?.foreground_cwd,
        agentSession: pane?.agent_session,
        ownCwd: process.cwd(),
        ownSessionFile: sessionFile,
      });
      return undefined;
    }
    const paneId = pane?.pane_id;
    if (!paneId) {
      debug("herdrCurrentIds: `pane current` returned no pane_id");
      return undefined;
    }
    debug("herdrCurrentIds: resolved via `herdr pane current`", {
      paneId,
      tabId: pane?.tab_id,
    });
    return { paneId, tabId: pane?.tab_id };
  } catch (error) {
    debug("herdrCurrentIds: failed", String(error));
    return undefined;
  }
}

/** Read one pane's labels and tab id. Callers pass an id that is already resolved. */
async function herdrPaneInfo(pi: ExtensionAPI, paneId: string): Promise<HerdrPaneInfo | undefined> {
  try {
    const r = await pi.exec("herdr", ["pane", "get", paneId], { timeout: 5000 });
    return JSON.parse(r.stdout) as HerdrPaneInfo;
  } catch (error) {
    debug("herdrPaneInfo: failed", String(error));
    return undefined;
  }
}

/** True when the pane/tab still shows a default label (empty or equals its number). */
function isDefaultLabel(label: string | undefined, number: number | undefined): boolean {
  if (!label || label.trim() === "") return true;
  if (number !== undefined && String(label).trim() === String(number)) return true;
  return false;
}

async function renameHerdrPane(
  pi: ExtensionAPI,
  name: string,
  always: boolean,
  sessionFile: string | undefined,
): Promise<void> {
  const ids = await herdrCurrentIds(pi, sessionFile);
  if (!ids) {
    debug("renameHerdrPane: skipped (could not resolve current pane)");
    return;
  }
  const paneId = ids.paneId;
  const info = await herdrPaneInfo(pi, paneId);
  const label = info?.pane?.label ?? info?.pane?.pane_label ?? info?.pane?.manual_label;
  if (!always && !isDefaultLabel(label, undefined)) {
    debug("renameHerdrPane: skipped (non-default label)", { label });
    return; // only replace default labels
  }
  try {
    await pi.exec("herdr", ["pane", "rename", paneId, name], { timeout: 5000 });
  } catch (error) {
    debug("renameHerdrPane: failed", String(error)); // non-fatal
  }
}

async function renameHerdrTab(
  pi: ExtensionAPI,
  name: string,
  always: boolean,
  sessionFile: string | undefined,
): Promise<void> {
  const ids = await herdrCurrentIds(pi, sessionFile);
  let tabId = ids?.tabId;
  if (!tabId && ids) {
    const pane = await herdrPaneInfo(pi, ids.paneId);
    tabId = pane?.pane?.tab_id;
  }
  if (!tabId) {
    debug("renameHerdrTab: skipped (no tab id)");
    return;
  }
  let tab: HerdrTabInfo | undefined;
  try {
    const r = await pi.exec("herdr", ["tab", "get", tabId], { timeout: 5000 });
    tab = JSON.parse(r.stdout) as HerdrTabInfo;
  } catch (error) {
    debug("renameHerdrTab: tab lookup failed", String(error));
    return;
  }
  if (!always && !isDefaultLabel(tab?.tab?.label, tab?.tab?.number)) {
    debug("renameHerdrTab: skipped (non-default label)", { label: tab?.tab?.label });
    return;
  }
  try {
    await pi.exec("herdr", ["tab", "rename", tabId, name], { timeout: 5000 });
  } catch (error) {
    debug("renameHerdrTab: failed", String(error)); // non-fatal
  }
}

// ---- tmux ----------------------------------------------------------------

/**
 * Rename the tmux window this process runs in. The pane id (`TMUX_PANE`) is a
 * valid tmux window target, so this renames the pane's window even when pi runs
 * in a background (non-active) window — no window_id lookup or cache needed.
 */
async function renameTmuxWindow(pi: ExtensionAPI, name: string): Promise<void> {
  const env = getSurfacesEnv();
  if (!env.TMUX || !env.TMUX_PANE) {
    return; // only when running inside tmux
  }
  try {
    await pi.exec("tmux", ["rename-window", "-t", env.TMUX_PANE, name], { timeout: 3000 });
  } catch (error) {
    debug("renameTmuxWindow: failed", String(error)); // non-fatal
  }
}

/**
 * Resolve the tab_id of the pane this process runs in via
 * `zellij action list-panes -j -t` (JSON). zellij exposes no tab-ID env var,
 * so the current tab is derived by matching ZELLIJ_PANE_ID (a bare integer,
 * e.g. "2") against the JSON `id` field. Returns undefined when not inside
 * zellij or the pane is gone (closed mid-session) — the tab rename is then
 * skipped rather than guessing the focused tab.
 */
async function zellijTabId(pi: ExtensionAPI): Promise<number | undefined> {
  const { ZELLIJ_PANE_ID } = getSurfacesEnv();
  if (!ZELLIJ_PANE_ID) return undefined;
  try {
    const r = await pi.exec("zellij", ["action", "list-panes", "-j", "-t"], { timeout: 5000 });
    const panes = JSON.parse(r.stdout) as Array<{ id?: number; tab_id?: number }>;
    const paneId = Number(ZELLIJ_PANE_ID);
    const tabId = panes.find((p) => p.id === paneId)?.tab_id;
    debug("zellijTabId", { paneId, tabId, paneCount: panes.length });
    return tabId;
  } catch (error) {
    debug("zellijTabId: failed", String(error));
    return undefined;
  }
}

/**
 * Rename the zellij pane this process runs in, targeted by ID. zellij surfaces
 * always rename (no default-label check): `list-panes`/`list-tabs` expose no
 * "was renamed" flag — pane titles are cwd-derived until renamed — so there is
 * no equivalent of the herdr default-label rule here. Renaming a pane that was
 * closed mid-session exits non-zero (`Pane with id ... not found`); swallowed.
 */
async function renameZellijPane(pi: ExtensionAPI, name: string): Promise<void> {
  const { ZELLIJ_PANE_ID } = getSurfacesEnv();
  if (!ZELLIJ_PANE_ID) {
    return; // only inside zellij
  }
  try {
    await pi.exec("zellij", ["action", "rename-pane", "-p", ZELLIJ_PANE_ID, name], {
      timeout: 5000,
    });
  } catch (error) {
    debug("renameZellijPane: failed", String(error)); // non-fatal
  }
}

async function renameZellijTab(pi: ExtensionAPI, name: string): Promise<void> {
  if (!getSurfacesEnv().ZELLIJ_PANE_ID) {
    return;
  }
  const tabId = await zellijTabId(pi);
  if (tabId === undefined) {
    debug("renameZellijTab: skipped (pane gone or lookup failed)");
    return;
  }
  try {
    await pi.exec("zellij", ["action", "rename-tab", "-t", String(tabId), name], { timeout: 5000 });
  } catch (error) {
    debug("renameZellijTab: failed", String(error)); // non-fatal
  }
}
