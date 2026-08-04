// debug.ts — gated debug trail for pi-auto-name.
//
// Off by default; enable with PI_AUTO_NAME_DEBUG=1 (or true/yes). When enabled,
// each debug() call appends a structured custom entry to the session transcript
// via pi.appendEntry instead of writing to stderr. The entries are durable
// (survive restarts), are NOT sent to the LLM, and render in the TUI through
// the entry renderer registered in initDebug.
import { Box, Text, type Component } from "@earendil-works/pi-tui";
import type { EntryRenderer, ExtensionAPI } from "@earendil-works/pi-coding-agent";

const DEBUG = /^(1|true|yes)$/i.test(process.env.PI_AUTO_NAME_DEBUG ?? "");

/** Custom entry type for the debug trail. Distinct from the provenance type ("pi-auto-name"). */
export const DEBUG_ENTRY_TYPE = "pi-auto-name:debug";

/** Shape of a debug entry: label, optional payload, and write timestamp. */
export interface DebugEntryData {
  msg: string;
  data?: unknown;
  at: string;
}

let pi: ExtensionAPI | undefined;
let rendererRegistered = false;

/**
 * Bind the pi API so debug() can append entries. Call once at extension load.
 * Deliberately performs no action calls: during extension loading the runtime
 * actions are throwing stubs (initialized only by runner.initialize()), so the
 * entry renderer is registered lazily on the first append instead.
 */
export function initDebug(api: ExtensionAPI): void {
  pi = api;
}

/** Whether debug logging is enabled (for gating extra diagnostic work). */
export const debugEnabled = DEBUG;

/** Log a debug line (no-op unless PI_AUTO_NAME_DEBUG is set and pi is bound). */
export function debug(...args: unknown[]): void {
  if (!DEBUG || !pi) return;
  if (!rendererRegistered) {
    pi.registerEntryRenderer<DebugEntryData>(DEBUG_ENTRY_TYPE, renderDebugEntry);
    rendererRegistered = true;
  }
  const [msg, data] = args;
  pi.appendEntry(DEBUG_ENTRY_TYPE, {
    msg: typeof msg === "string" ? msg : String(msg ?? ""),
    ...(args.length > 1 ? { data } : {}),
    at: new Date().toISOString(),
  });
}

/** Max chars of the inline payload shown on a collapsed entry. */
const COLLAPSED_DATA_LIMIT = 160;

/** TUI renderer: collapsed shows the debug label plus a compact inline payload; expanded shows the full payload and timestamp. */
export const renderDebugEntry: EntryRenderer<DebugEntryData> = (
  entry,
  { expanded },
  theme,
): Component => {
  const { msg, data } = entry.data ?? {};
  const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
  const label = theme.fg("accent", `[pi-auto-name] ${msg ?? ""}`);
  if (expanded) {
    box.addChild(new Text(label, 0, 0));
    if (data !== undefined) {
      box.addChild(
        new Text(
          theme.fg("dim", typeof data === "string" ? data : JSON.stringify(data, null, 2)),
          0,
          0,
        ),
      );
    }
    return box;
  }
  // Collapsed: keep the payload readable in one wrapped line. Strings render
  // verbatim; objects render as compact JSON, truncated so a long seed/prompt
  // slice can't blow up the transcript (full data is one expand away).
  if (data === undefined) {
    box.addChild(new Text(label, 0, 0));
    return box;
  }
  const detail = typeof data === "string" ? data : JSON.stringify(data);
  const inline =
    detail.length > COLLAPSED_DATA_LIMIT ? `${detail.slice(0, COLLAPSED_DATA_LIMIT)}…` : detail;
  box.addChild(new Text(`${label} ${theme.fg("dim", inline)}`, 0, 0));
  return box;
};
