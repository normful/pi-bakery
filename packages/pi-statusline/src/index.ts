import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, AssistantMessageEvent } from "@earendil-works/pi-ai";
import type {
  AgentEndEvent,
  BeforeAgentStartEvent,
  ExtensionAPI,
  ExtensionContext,
  SessionShutdownEvent,
  SessionStartEvent,
  Theme,
  ThemeColor,
  TurnEndEvent,
  TurnStartEvent,
} from "@earendil-works/pi-coding-agent";

// These event types exist in the package internals but are not publicly exported,
// so we define them locally.
interface MessageStartEvent {
  type: "message_start";
  message: AgentMessage;
}
interface MessageUpdateEvent {
  type: "message_update";
  message: AgentMessage;
  assistantMessageEvent: AssistantMessageEvent;
}
interface MessageEndEvent {
  type: "message_end";
  message: AgentMessage;
}

// ModelSelectEvent is not exported from the package, so we define it locally
interface ModelSelectEvent {
  type: "model_select";
  model: { provider: string; id: string };
  previousModel: { provider: string; id: string } | undefined;
  source: string;
}

interface ThinkingLevelSelectEvent {
  type: "thinking_level_select";
  level: ThinkingLevel;
  previousLevel: ThinkingLevel;
}

import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

function colorModelId(modelId: string, theme: Theme): string {
  // Build colored version of model ID highlighting "omni" and trailing "free".
  const result = modelId;
  const parts: string[] = [];
  // Regex for omni (case-insensitive as per typical model IDs).
  const omniRegex = /omni/gi;
  let lastIndex = 0;
  let match;
  while ((match = omniRegex.exec(result)) !== null) {
    // Add part before match.
    if (match.index > lastIndex) {
      parts.push(theme.fg("syntaxNumber", result.slice(lastIndex, match.index)));
    }
    // Add the omni part with syntaxFunction.
    parts.push(
      theme.fg("syntaxFunction", result.slice(match.index, match.index + match[0].length)),
    );
    lastIndex = omniRegex.lastIndex;
  }
  // Add remaining part.
  if (lastIndex < result.length) {
    parts.push(theme.fg("syntaxNumber", result.slice(lastIndex)));
  }
  // Now handle trailing free pattern on the whole string (after omni coloring).
  // We'll recombine the parts to get the full string, but we need to keep colors.
  // Instead, we can apply free pattern on the original string and then overlay.
  // Simpler: we can first split by free pattern, then apply omni to each part.
  // Let's redo: we'll handle free first.
  const freeMatch = result.match(/(:free|-free)$/);
  if (freeMatch) {
    const freeStr = freeMatch[0];
    const freeText = freeStr.slice(1); // "free"
    const separator = freeStr[0]; // ":" or "-"
    const prefix = result.slice(0, -freeStr.length);
    // Color prefix with syntaxNumber, separator with syntaxNumber, free with syntaxFunction.
    // But we also need to apply omni coloring inside prefix.
    // We'll recursively apply omni coloring to prefix.
    const coloredPrefix = colorModelId(prefix, theme);
    return (
      coloredPrefix + theme.fg("syntaxNumber", separator) + theme.fg("syntaxFunction", freeText)
    );
  }
  // If no free pattern, return the parts joined.
  return parts.join("");
}

// --- Stats types ---

interface Stats {
  turnStartTimes: Map<number, number>;
  contextPct: number | null | undefined;
  contextTokens: number | null;
  contextWindow: number;
  gitBranch: string;
  cwd: string;
  liveElapsed: number | undefined;
  modelProvider: string;
  modelId: string;
  thinkingLevel: ThinkingLevel;
  // Cached usage for footer display (no ctx access during render)
  cachedUsage: UsageStats;
}

// Status tracking (for footer display)
const stats: Stats = {
  // Map of turnIndex -> start timestamp for tracking runtimes
  turnStartTimes: new Map<number, number>(),
  // Cached status values for footer
  contextPct: undefined as number | undefined,
  contextTokens: null,
  contextWindow: 0,
  gitBranch: "",
  cwd: process.cwd(),
  // Live elapsed timer (for footer display)
  liveElapsed: undefined as number | undefined,
  // Model info for footer
  modelProvider: "",
  modelId: "",
  thinkingLevel: "off" as ThinkingLevel,
  cachedUsage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
};

// --- Above editor widget ---

/** Abbreviate path segments (except the last) to first char, unless ≤3 chars. */
function truncatePath(path: string): string {
  if (path === "" || path === "/") return path;
  const parts = path.split("/");
  return parts
    .map((part, i) => (i < parts.length - 1 && part.length > 3 ? part.charAt(0) : part))
    .join("/");
}

// ── CWD hash-color palette ──
// 64 colors evenly distributed in hue, HSL → RGB computed once at module init.
// Used to give each directory a consistent distinct color via raw ANSI escapes.

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

const CWD_COLORS: readonly [number, number, number][] = (() => {
  const palette: [number, number, number][] = [];
  for (let i = 0; i < 64; i++) {
    const hue = (i / 64) * 360;
    // Alternate saturation and lightness for more visual variety
    const sat = i % 2 === 0 ? 0.7 : 0.85;
    const light = i % 2 === 0 ? 0.5 : 0.55;
    palette.push(hslToRgb(hue, sat, light));
  }
  return palette;
})();

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash |= 0; // force 32-bit integer
  }
  return Math.abs(hash);
}

/** Pick a deterministic (hash-based) color from the palette for the given path segment text. */
function pickCwdColor(text: string): [number, number, number] {
  const idx = hashString(text) % CWD_COLORS.length;
  const color = CWD_COLORS[idx];
  if (color) return color;
  return [180, 180, 180]; // fallback gray (should never reach)
}

function renderAboveEditorWidget(width: number, theme: Theme, stats: Stats): string[] {
  // Replace $HOME prefix with ~ for display
  let displayCwd = stats.cwd;
  const home = process.env.HOME;
  if (home && displayCwd.startsWith(home)) {
    displayCwd = "~" + displayCwd.slice(home.length);
  }
  const truncated = displayCwd ? truncatePath(displayCwd) : "";
  let dir = "";
  if (truncated) {
    const lastSlash = truncated.lastIndexOf("/");
    if (lastSlash > 0) {
      const prefix = truncated.slice(0, lastSlash + 1);
      const suffix = truncated.slice(lastSlash + 1);
      const [r, g, b] = pickCwdColor(suffix);
      dir = theme.fg("syntaxFunction", prefix) + `\x1b[38;2;${r};${g};${b}m${suffix}\x1b[0m`;
    } else {
      const [r, g, b] = pickCwdColor(truncated);
      dir = `\x1b[38;2;${r};${g};${b}m${truncated}\x1b[0m`;
    }
  }
  const branch = (() => {
    if (!stats.gitBranch) return "";
    const slashIdx = stats.gitBranch.lastIndexOf("/");
    if (slashIdx === -1) {
      return theme.fg("muted", `⎇ ${stats.gitBranch}`);
    }
    const prefix = stats.gitBranch.slice(0, slashIdx + 1);
    const suffix = stats.gitBranch.slice(slashIdx + 1);
    const [r, g, b] = pickCwdColor(suffix);
    return theme.fg("muted", `⎇ ${prefix}`) + `\x1b[38;2;${r};${g};${b}m${suffix}\x1b[0m`;
  })();
  const line1 = [dir, branch].filter(Boolean).join(" ");

  const modelParts: string[] = [];
  if (stats.modelId) {
    modelParts.push(colorModelId(stats.modelId, theme));
  }
  modelParts.push(theme.fg("syntaxNumber", `(⟐  ${stats.thinkingLevel})`));
  if (stats.modelProvider) {
    const provider = String(stats.modelProvider);
    // Abbreviate common provider prefixes, preserving any suffix
    const label = provider.replace(/opencode/gi, "oc").replace(/openrouter/gi, "or");
    modelParts.push(theme.fg("syntaxKeyword", label));
  }
  const model = modelParts.join(" ");

  return [` ${truncateToWidth(line1, width - 1)}`, ` ${truncateToWidth(model, width - 1)}`];
}

// --- Grouped state objects (refactored from single flat timerStats) ---

interface TurnCounts {
  answerCharCount: number;
  thinkingCharCount: number;
  toolcallCharCount: number;
  streamPhase: "thinking" | "text" | "toolcall" | null;
}

interface LastTurnAverages {
  avgAnswerCps: number | null;
  avgThinkingCps: number | null;
  avgToolcallCps: number | null;
}

interface TimerState {
  agentStartMs: number | null;
  timerInterval: ReturnType<typeof setInterval> | null;
}

const turnCounts: TurnCounts = {
  answerCharCount: 0,
  thinkingCharCount: 0,
  toolcallCharCount: 0,
  streamPhase: null,
};

const lastTurnAverages: LastTurnAverages = {
  avgAnswerCps: null,
  avgThinkingCps: null,
  avgToolcallCps: null,
};

const timerState: TimerState = {
  agentStartMs: null,
  timerInterval: null,
};

// Simple stream start timestamp for CPS calculation
let streamStartMs = 0;

// --- Footer helpers ---

interface UsageStats {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
}

function calculateUsage(ctx: ExtensionContext): UsageStats {
  let input = 0;
  let output = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let cost = 0;

  for (const e of ctx.sessionManager.getBranch()) {
    if (e.type === "message" && e.message.role === "assistant") {
      const m = e.message as AssistantMessage;
      input += m.usage.input;
      output += m.usage.output;
      cacheRead += m.usage.cacheRead;
      cacheWrite += m.usage.cacheWrite;
      cost += m.usage.cost.total;
    }
  }

  return { input, output, cacheRead, cacheWrite, cost };
}

// ── Speed color lookup table (built once at module init) ──
//
// Flipped ordering (slow = red, fast = green) with dim/dull shades.
// Max intensity ~190 to avoid harsh pure-255 hues. All endpoint colors
// mix in cross-channel components for a muted, stylish look.
//
// Bands (flipped):
//   0–30:   dull red → dull yellow
//   30–50:  dull yellow → dull blue
//   50–100: dull blue → dull cyan
//   100–150: dull cyan → dull green
//   150+:    dull green plateau

const SPEED_RESET = "\x1b[0m";
const SPEED_LUT_MAX = 200;

// Dim endpoint colors (r, g, b) — no channel exceeds 190
const DULL_RED: readonly [number, number, number] = [180, 50, 50];
const DULL_YELLOW: readonly [number, number, number] = [190, 160, 40];
const DULL_BLUE: readonly [number, number, number] = [50, 80, 190];
const DULL_CYAN: readonly [number, number, number] = [40, 170, 180];
const DULL_GREEN: readonly [number, number, number] = [50, 160, 60];

/** Linear interpolation between two RGB tuples. */
function lerpRgb(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const buildSpeedColors: readonly string[] = (() => {
  const lookup = Array.from<string>({ length: SPEED_LUT_MAX + 1 });
  for (let i = 0; i <= SPEED_LUT_MAX; i++) {
    let r: number, g: number, b: number;
    if (i <= 30) {
      // 0-30: dull red → dull yellow
      const t = i / 30;
      [r, g, b] = lerpRgb(DULL_RED, DULL_YELLOW, t);
    } else if (i <= 50) {
      // 30-50: dull yellow → dull blue
      const t = (i - 30) / 20;
      [r, g, b] = lerpRgb(DULL_YELLOW, DULL_BLUE, t);
    } else if (i <= 100) {
      // 50-100: dull blue → dull cyan
      const t = (i - 50) / 50;
      [r, g, b] = lerpRgb(DULL_BLUE, DULL_CYAN, t);
    } else if (i <= 150) {
      // 100-150: dull cyan → dull green
      const t = (i - 100) / 50;
      [r, g, b] = lerpRgb(DULL_CYAN, DULL_GREEN, t);
    } else {
      // 150+: dull green plateau
      [r, g, b] = DULL_GREEN;
    }
    lookup[i] = `\x1b[38;2;${r};${g};${b}m`;
  }
  return lookup;
})();

/** Clamp a value to the speed color LUT range [0, SPEED_LUT_MAX] and look up the ANSI color escape. */
function lookupSpeedColor(value: number): string {
  const idx = Math.max(0, Math.min(SPEED_LUT_MAX, Math.round(value)));
  return buildSpeedColors[idx] ?? "";
}

// ── Metrics formatting helpers ──

/** Safe division that returns 0 for non-positive denominators (to avoid Infinity/NaN). */
function safeDivide(numerator: number, denominatorMs: number): number {
  const sec = denominatorMs / 1000;
  return sec > 0 ? numerator / sec : 0;
}

/** Format a speed value into a colored string with icon and unit. */
function formatMetric(value: number, unit: string, icon: string): string {
  const display = value < 5 ? value.toFixed(1) : String(Math.round(value));
  return `${lookupSpeedColor(value)}${icon} ${display}${unit}${SPEED_RESET}`;
}

// ── Footer section builders ──

function renderContextInfo(theme: Theme, stats: Stats): string[] {
  const parts: string[] = [];

  // Context % (leftmost) — tighter bands, emoji + color
  if (stats.contextPct != null) {
    const pct = Math.round(stats.contextPct);
    let color: ThemeColor;
    let emoji: string;
    if (pct <= 10) {
      color = "success";
      emoji = "";
    } else if (pct <= 20) {
      color = "dim";
      emoji = "";
    } else if (pct <= 30) {
      color = "muted";
      emoji = "🟦";
    } else if (pct <= 40) {
      color = "toolTitle";
      emoji = "🟪";
    } else if (pct <= 50) {
      color = "warning";
      emoji = "🟧";
    } else {
      color = "error";
      emoji = "🟥";
    }
    parts.push(`${emoji} ${theme.fg(color, `${pct}%`)}`);
  } else {
    parts.push(theme.fg("syntaxType", "--%"));
  }

  // Context token usage (from cached stats, no ctx access)
  if (stats.contextTokens != null && stats.contextWindow > 0) {
    parts.push(
      theme.fg(
        "syntaxFunction",
        `${formatTokens(stats.contextTokens)}/${formatTokens(stats.contextWindow)}`,
      ),
    );
  }

  // Live elapsed timer
  if (stats.liveElapsed != null) {
    const elapsed = stats.liveElapsed as number;
    parts.push(theme.fg("syntaxOperator", `⏱ ${formatDuration(elapsed)}`));
  }

  return parts;
}

function renderStreamingMetrics(): string[] {
  if (streamStartMs === 0) return [];

  const phase = turnCounts.streamPhase;
  if (!phase) return [];

  const icon = phase === "thinking" ? "⟐" : phase === "toolcall" ? "⚙" : "≡";
  const charCount =
    phase === "thinking"
      ? turnCounts.thinkingCharCount
      : phase === "toolcall"
        ? turnCounts.toolcallCharCount
        : turnCounts.answerCharCount;

  const elapsedMs = Date.now() - streamStartMs;
  if (elapsedMs <= 0 || charCount <= 0) return [];

  const rawCps = safeDivide(charCount, elapsedMs);
  if (rawCps <= 0) return [];

  return [formatMetric(rawCps, "cps", icon)];
}

function renderLastTurnMetrics(): string[] {
  const cpsEntries: Array<{ icon: string; cps: number | null }> = [
    { icon: "⟐", cps: lastTurnAverages.avgThinkingCps },
    { icon: "⚙", cps: lastTurnAverages.avgToolcallCps },
    { icon: "≡", cps: lastTurnAverages.avgAnswerCps },
  ];
  const active = cpsEntries.filter((e) => e.cps != null && e.cps > 0);
  if (active.length === 0) return [];

  const metricParts = active.map((e) => formatMetric(e.cps as number, "cps", e.icon));
  return [metricParts.join(" ")];
}

function buildFooterLeft(theme: Theme, stats: Stats): string {
  const parts: string[] = [...renderContextInfo(theme, stats)];

  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

function buildFooterRight(theme: Theme, stats: Stats): string {
  const parts: string[] = [...renderStreamingMetrics(), ...renderLastTurnMetrics()];

  // Cost in millicents (1 dollar = 100 cents = 100,000 millicents)
  const usage = stats.cachedUsage;
  const millicents = Math.round(usage.cost * 100_000);
  parts.push(theme.fg("syntaxFunction", `${millicents}m¢`));

  // Cache:input:output ratio, normalized so output=1
  //   cache = syntaxComment,  input = syntaxVariable,  output = syntaxString,  colons = dim
  const nonCacheInput = Math.max(0, usage.input - usage.cacheRead - usage.cacheWrite);
  if (usage.output > 0) {
    const cacheRatio = Math.round(usage.cacheRead / usage.output);
    const inputRatio = Math.round(nonCacheInput / usage.output);
    const colon = theme.fg("dim", ":");
    parts.push(
      `${theme.fg("syntaxComment", `${cacheRatio}c`)}${colon}` +
        `${theme.fg("syntaxVariable", `${inputRatio}i`)}${colon}` +
        `${theme.fg("syntaxString", `1o`)}`,
    );
  }

  return parts.length > 0 ? `${parts.join(" ")} ` : "";
}

function renderFooter(width: number, theme: Theme, stats: Stats): string[] {
  const left = buildFooterLeft(theme, stats);
  const right = buildFooterRight(theme, stats);

  const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
  return [truncateToWidth(left + pad + right, width)];
}

const formatTokens = (n: number) => {
  if (n >= 1_000_000_000) {
    const b = n / 1_000_000_000;
    return b % 1 === 0 ? `${b}B` : `${b.toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `${n}`;
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}m ${rem.toFixed(0)}s`;
}

function clearTimer() {
  if (timerState.timerInterval) {
    clearInterval(timerState.timerInterval);
    timerState.timerInterval = null;
  }
}

/** Update cached context stats from a live ctx (called from event handlers only, not from render). */
function updateContextStats(ctx: ExtensionContext) {
  const cu = ctx.getContextUsage?.();
  if (cu) {
    stats.contextPct = cu.percent;
    stats.contextTokens = cu.tokens;
    stats.contextWindow = cu.contextWindow;
  }
  stats.cachedUsage = calculateUsage(ctx);
}

// Track old dispose functions so we can clean up on session reload
let _prevWidgetAboveDispose: (() => void) | undefined;
let _prevFooterDispose: (() => void) | undefined;

export default function init(pi: ExtensionAPI) {
  pi.on("before_agent_start", (_event: BeforeAgentStartEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;

    // Hide built-in working loader row entirely
    ctx.ui.setWorkingVisible(false);

    timerState.agentStartMs = Date.now();
  });

  pi.on("turn_start", (event: TurnStartEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;

    // Track turn start time by turnIndex
    stats.turnStartTimes.set(event.turnIndex, event.timestamp);
    updateContextStats(ctx);

    // Start live elapsed timer - will be displayed in footer
    clearTimer();
    timerState.timerInterval = setInterval(() => {
      if (!timerState.agentStartMs) return;
      const elapsed = Date.now() - timerState.agentStartMs;
      // Store in stats so footer can read it
      stats.liveElapsed = elapsed;
    }, 800);
  });

  pi.on("turn_end", (event: TurnEndEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;

    stats.turnStartTimes.delete(event.turnIndex);
    clearTimer();
    stats.liveElapsed = undefined;
    updateContextStats(ctx);
  });

  pi.on("agent_end", (_event: AgentEndEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;
    clearTimer();
    if (timerState.agentStartMs) {
      stats.liveElapsed = Date.now() - timerState.agentStartMs;
    }
  });

  pi.on("session_shutdown", (_event: SessionShutdownEvent, _ctx: ExtensionContext) => {
    clearTimer();
    streamStartMs = 0;
    lastTurnAverages.avgAnswerCps = null;
    lastTurnAverages.avgThinkingCps = null;
    lastTurnAverages.avgToolcallCps = null;
    // Dispose widget/footer subscriptions
    if (_prevWidgetAboveDispose) {
      _prevWidgetAboveDispose();
      _prevWidgetAboveDispose = undefined;
    }
    if (_prevFooterDispose) {
      _prevFooterDispose();
      _prevFooterDispose = undefined;
    }
  });

  // --- CPS tracking ---

  pi.on("message_start", (event: MessageStartEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;
    if (event.message?.role === "assistant") {
      lastTurnAverages.avgAnswerCps = null;
      lastTurnAverages.avgThinkingCps = null;
      lastTurnAverages.avgToolcallCps = null;
      turnCounts.answerCharCount = 0;
      turnCounts.thinkingCharCount = 0;
      turnCounts.toolcallCharCount = 0;
      turnCounts.streamPhase = null;
      streamStartMs = Date.now();
    }
  });

  pi.on("message_update", (event: MessageUpdateEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;
    const ev = event.assistantMessageEvent;
    if (ev?.type === "thinking_start") {
      turnCounts.streamPhase = "thinking";
    }
    if (ev?.type === "text_start") {
      turnCounts.streamPhase = "text";
    }
    if (ev?.type === "toolcall_start") {
      turnCounts.streamPhase = "toolcall";
    }
    if (ev?.type === "text_delta") {
      turnCounts.answerCharCount += ev.delta.length;
    }
    if (ev?.type === "thinking_delta") {
      turnCounts.thinkingCharCount += ev.delta.length;
    }
    if (ev?.type === "toolcall_delta") {
      turnCounts.toolcallCharCount += ev.delta.length;
    }
  });

  pi.on("message_end", (event: MessageEndEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;
    if (event.message?.role === "assistant" && streamStartMs > 0) {
      const elapsedMs = Date.now() - streamStartMs;
      if (elapsedMs > 0) {
        lastTurnAverages.avgAnswerCps = safeDivide(turnCounts.answerCharCount, elapsedMs);
        lastTurnAverages.avgThinkingCps = safeDivide(turnCounts.thinkingCharCount, elapsedMs);
        lastTurnAverages.avgToolcallCps = safeDivide(turnCounts.toolcallCharCount, elapsedMs);
      }
      streamStartMs = 0;
    }
  });

  pi.on("session_start", (_event: SessionStartEvent, ctx: ExtensionContext) => {
    // event.reason: "startup" | "reload" | "new" | "resume" | "fork"
    // event.previousSessionFile: set for "new", "resume", "fork"
    if (!ctx.hasUI) return;

    // Dispose previous widget/footer subscriptions before registering new ones
    if (_prevWidgetAboveDispose) {
      _prevWidgetAboveDispose();
      _prevWidgetAboveDispose = undefined;
    }
    if (_prevFooterDispose) {
      _prevFooterDispose();
      _prevFooterDispose = undefined;
    }

    ctx.ui.setWorkingIndicator({ frames: [] });

    // Reset stats
    stats.turnStartTimes.clear();
    stats.cachedUsage = {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
    };
    updateContextStats(ctx);
    stats.gitBranch = "";
    stats.cwd = ctx.cwd;
    stats.modelProvider = String(ctx.model?.provider ?? "");
    stats.modelId = String(ctx.model?.id ?? "");
    stats.thinkingLevel = pi.getThinkingLevel();

    // Reset timer state
    timerState.agentStartMs = null;
    clearTimer();

    const widgetAboveResult = ctx.ui.setWidget("widget-above", (_tui, theme) => {
      const renderStats = stats;

      return {
        dispose: undefined,
        invalidate() {},
        render(w: number): string[] {
          return renderAboveEditorWidget(w, theme, renderStats);
        },
      };
    });
    if (typeof widgetAboveResult === "function") _prevWidgetAboveDispose = widgetAboveResult;

    const footerResult = ctx.ui.setFooter((_tui, theme, footerData) => {
      // Initialize git branch from footerData
      stats.gitBranch = footerData.getGitBranch() ?? "";

      const unsubBranch = footerData.onBranchChange(() => {
        stats.gitBranch = footerData.getGitBranch() ?? "";
      });

      return {
        dispose: unsubBranch,
        invalidate() {},
        render(width: number): string[] {
          return renderFooter(width, theme, stats);
        },
      };
    });
    if (typeof footerResult === "function") _prevFooterDispose = footerResult;
  });

  // Listen for model changes to update the widget
  pi.on("model_select", (_event: ModelSelectEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;

    stats.modelProvider = String(ctx.model?.provider ?? "");
    stats.modelId = String(ctx.model?.id ?? "");
  });

  // Listen for thinking level changes to update the widget
  pi.on("thinking_level_select", (_event: ThinkingLevelSelectEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;

    stats.thinkingLevel = pi.getThinkingLevel();
  });
}
