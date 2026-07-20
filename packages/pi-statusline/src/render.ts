import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionContext, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { pickCwdColor } from "./color.js";
import {
  colorModelId,
  formatDuration,
  formatMetric,
  formatTokens,
  safeDivide,
  truncatePath,
} from "./format.js";
import type { LastTurnAverages, Stats, TurnCounts, UsageStats } from "./types.js";

export function renderAboveEditorWidget(width: number, theme: Theme, stats: Stats): string[] {
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

export function calculateUsage(ctx: ExtensionContext): UsageStats {
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

export function renderContextInfo(theme: Theme, stats: Stats): string[] {
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

export function renderStreamingMetrics(
  streamStartMs: number,
  counts: TurnCounts,
  nowMs: number,
): string[] {
  if (streamStartMs === 0) return [];

  const phase = counts.streamPhase;
  if (!phase) return [];

  const icon = phase === "thinking" ? "⟐" : phase === "toolcall" ? "⚙" : "≡";
  const charCount =
    phase === "thinking"
      ? counts.thinkingCharCount
      : phase === "toolcall"
        ? counts.toolcallCharCount
        : counts.answerCharCount;

  const elapsedMs = nowMs - streamStartMs;
  if (elapsedMs <= 0 || charCount <= 0) return [];

  const rawCps = safeDivide(charCount, elapsedMs);
  if (rawCps <= 0) return [];

  return [formatMetric(rawCps, "cps", icon)];
}

export function renderLastTurnMetrics(avgs: LastTurnAverages): string[] {
  const cpsEntries: Array<{ icon: string; cps: number | null }> = [
    { icon: "⟐", cps: avgs.avgThinkingCps },
    { icon: "⚙", cps: avgs.avgToolcallCps },
    { icon: "≡", cps: avgs.avgAnswerCps },
  ];
  const active = cpsEntries.filter((e) => e.cps != null && e.cps > 0);
  if (active.length === 0) return [];

  const metricParts = active.map((e) => formatMetric(e.cps as number, "cps", e.icon));
  return [metricParts.join(" ")];
}

export function buildFooterLeft(theme: Theme, stats: Stats): string {
  const parts: string[] = [...renderContextInfo(theme, stats)];

  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

export function buildFooterRight(theme: Theme, stats: Stats, metricParts: string[]): string {
  const parts: string[] = [...metricParts];

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

export function renderFooter(
  width: number,
  theme: Theme,
  stats: Stats,
  metricParts: string[],
): string[] {
  const left = buildFooterLeft(theme, stats);
  const right = buildFooterRight(theme, stats, metricParts);

  const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
  return [truncateToWidth(left + pad + right, width)];
}
