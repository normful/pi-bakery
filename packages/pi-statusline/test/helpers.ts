import type { Theme } from "@earendil-works/pi-coding-agent";

/**
 * Fake theme whose `fg` wraps text in a real ANSI 256-color escape per color
 * name. Real ANSI (rather than literal markers) keeps pi-tui's `visibleWidth`
 * / `truncateToWidth` behaving correctly — ANSI codes are invisible to them —
 * while the distinct per-name codes let tests assert which color was applied.
 */
const COLOR_CODES: Record<string, number> = {
  syntaxNumber: 1,
  syntaxFunction: 2,
  syntaxKeyword: 3,
  syntaxType: 4,
  syntaxOperator: 5,
  syntaxComment: 6,
  syntaxVariable: 7,
  syntaxString: 8,
  muted: 9,
  dim: 10,
  success: 11,
  warning: 12,
  error: 13,
  toolTitle: 14,
};

export function fg(color: string, text: string): string {
  return `\x1b[38;5;${COLOR_CODES[color] ?? 99}m${text}\x1b[0m`;
}

export function makeTheme(): Theme {
  return { fg } as unknown as Theme;
}

/** Strip SGR ANSI escapes (both 256-color `38;5;N` and 24-bit `38;2;R;G;B`). */
// The ESC byte is built dynamically so the regex literal holds no control char
// (keeps eslint `no-control-regex` happy without a disable comment).
const ESC = String.fromCharCode(0x1b);
const ANSI_SGR_RE = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

export function stripAnsi(s: string): string {
  return s.replace(ANSI_SGR_RE, "");
}
