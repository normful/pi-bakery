import type { Theme } from "@earendil-works/pi-coding-agent";
import { lookupSpeedColor, SPEED_RESET } from "./color.js";

export function colorModelId(modelId: string, theme: Theme): string {
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
  const freeMatch = result.match(/(:free|-free)$/);
  if (freeMatch) {
    const freeStr = freeMatch[0];
    const freeText = freeStr.slice(1); // "free"
    const separator = freeStr[0]; // ":" or "-"
    const prefix = result.slice(0, -freeStr.length);
    // Recursively apply omni coloring to prefix, then color separator + free.
    const coloredPrefix = colorModelId(prefix, theme);
    return (
      coloredPrefix + theme.fg("syntaxNumber", separator) + theme.fg("syntaxFunction", freeText)
    );
  }
  // If no free pattern, return the parts joined.
  return parts.join("");
}

/** Abbreviate path segments (except the last) to first char, unless ≤3 chars. */
export function truncatePath(path: string): string {
  if (path === "" || path === "/") return path;
  const parts = path.split("/");
  return parts
    .map((part, i) => (i < parts.length - 1 && part.length > 3 ? part.charAt(0) : part))
    .join("/");
}

/** Safe division that returns 0 for non-positive denominators (to avoid Infinity/NaN). */
export function safeDivide(numerator: number, denominatorMs: number): number {
  const sec = denominatorMs / 1000;
  return sec > 0 ? numerator / sec : 0;
}

/** Format a speed value into a colored string with icon and unit. */
export function formatMetric(value: number, unit: string, icon: string): string {
  const display = value < 5 ? value.toFixed(1) : String(Math.round(value));
  return `${lookupSpeedColor(value)}${icon} ${display}${unit}${SPEED_RESET}`;
}

export const formatTokens = (n: number): string => {
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

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}m ${rem.toFixed(0)}s`;
}
