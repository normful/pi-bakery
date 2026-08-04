// surfaces.ts — session name / herdr pane / herdr tab / tmux window / zellij
// pane / zellij tab.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Config } from "./config.js";
import type { RenameState } from "./state.js";
import { compactWindowName } from "./sanitize.js";
import { recordAutoRename } from "./state.js";
import { debug } from "./debug.js";

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
 */
export async function syncSurfaces(
  pi: ExtensionAPI,
  cfg: Config,
  windowName: string | undefined,
): Promise<void> {
  if (!windowName) {
    debug("syncSurfaces: skipped (no window name)");
    return;
  }

  const always = cfg.replaceExistingName === "always";
  debug("syncSurfaces", { windowName, always });
  if (cfg.surfaces.renameHerdrPane) {
    await renameHerdrPane(pi, windowName, always);
  }
  if (cfg.surfaces.renameHerdrTab) {
    await renameHerdrTab(pi, windowName, always);
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

const HERDR_ENV = process.env.HERDR_ENV?.trim();
const HERDR_PANE_ID = process.env.HERDR_PANE_ID?.trim();
const HERDR_TAB_ID = process.env.HERDR_TAB_ID?.trim();

interface HerdrPaneInfo {
  pane?: {
    pane_id?: string;
    label?: string;
    pane_label?: string;
    manual_label?: string;
    tab_id?: string;
  };
}
interface HerdrTabInfo {
  tab?: { tab_id?: string; label?: string; number?: number };
}

/**
 * Resolve the pane (and tab) this pi process runs in. Prefers the herdr env
 * vars; when `HERDR_PANE_ID` is missing (pi launched from a shell herdr did
 * not inject env into), falls back to `herdr pane current` — herdr identifies
 * pi's pane via its `herdr:pi` agent integration, so the call returns the pane
 * pi is running in without any env hints.
 */
async function herdrCurrentIds(
  pi: ExtensionAPI,
): Promise<{ paneId: string; tabId?: string } | undefined> {
  if (HERDR_PANE_ID) {
    return { paneId: HERDR_PANE_ID, tabId: HERDR_TAB_ID || undefined };
  }
  try {
    const r = await pi.exec("herdr", ["pane", "current"], { timeout: 5000 });
    const pane = JSON.parse(r.stdout)?.result?.pane as
      | { pane_id?: string; tab_id?: string }
      | undefined;
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

async function herdrPaneInfo(pi: ExtensionAPI): Promise<HerdrPaneInfo | undefined> {
  const ids = await herdrCurrentIds(pi);
  if (!ids) {
    debug("herdrPaneInfo: skipped (could not resolve current pane)");
    return undefined;
  }
  try {
    const r = await pi.exec("herdr", ["pane", "get", ids.paneId], { timeout: 5000 });
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

async function renameHerdrPane(pi: ExtensionAPI, name: string, always: boolean): Promise<void> {
  const ids = await herdrCurrentIds(pi);
  if (!ids) {
    debug("renameHerdrPane: skipped (could not resolve current pane)");
    return;
  }
  const paneId = ids.paneId;
  const info = await herdrPaneInfo(pi);
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

async function renameHerdrTab(pi: ExtensionAPI, name: string, always: boolean): Promise<void> {
  const ids = await herdrCurrentIds(pi);
  let tabId = ids?.tabId;
  if (!tabId) {
    const pane = await herdrPaneInfo(pi);
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

const TMUX_PANE = process.env.TMUX_PANE?.trim();

/**
 * Rename the tmux window this process runs in. The pane id (`TMUX_PANE`) is a
 * valid tmux window target, so this renames the pane's window even when pi runs
 * in a background (non-active) window — no window_id lookup or cache needed.
 */
async function renameTmuxWindow(pi: ExtensionAPI, name: string): Promise<void> {
  if (!process.env.TMUX || !TMUX_PANE) {
    return; // only when running inside tmux (env presence already in surfaces env)
  }
  try {
    await pi.exec("tmux", ["rename-window", "-t", TMUX_PANE, name], { timeout: 3000 });
  } catch (error) {
    debug("renameTmuxWindow: failed", String(error)); // non-fatal
  }
}

const ZELLIJ_PANE_ID = process.env.ZELLIJ_PANE_ID?.trim();

debug("surfaces env", {
  herdr: { HERDR_ENV, HERDR_PANE_ID, HERDR_TAB_ID },
  tmux: { TMUX: process.env.TMUX?.trim(), TMUX_PANE },
  zellij: { ZELLIJ: process.env.ZELLIJ?.trim(), ZELLIJ_PANE_ID },
});

/**
 * Resolve the tab_id of the pane this process runs in via
 * `zellij action list-panes -j -t` (JSON). zellij exposes no tab-ID env var,
 * so the current tab is derived by matching ZELLIJ_PANE_ID (a bare integer,
 * e.g. "2") against the JSON `id` field. Returns undefined when not inside
 * zellij or the pane is gone (closed mid-session) — the tab rename is then
 * skipped rather than guessing the focused tab.
 */
async function zellijTabId(pi: ExtensionAPI): Promise<number | undefined> {
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
  if (!ZELLIJ_PANE_ID) {
    return; // only inside zellij (env presence already in surfaces env)
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
  if (!ZELLIJ_PANE_ID) {
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
