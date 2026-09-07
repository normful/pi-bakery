const ESC = "\x1b";

export const FAINT_ON = `${ESC}[2m`;
export const FAINT_OFF = `${ESC}[22m`;
export const FG_RESET = `${ESC}[39m`;
export const BG_RESET = `${ESC}[49m`;
export const RESET_ALL = `${ESC}[0m`;
export const INVISIBLE_FG = `${ESC}[38;2;10;10;10m`;
export const INVISIBLE_BG = `${ESC}[48;2;10;10;10m`;
export const LEADING_ANSI_RE = new RegExp(`^${ESC}\\[[^m]*m`);
export const RESET_ALL_RE = new RegExp(`${ESC}\\[0m`, "g");
export const FG_RESET_RE = new RegExp(`${ESC}\\[39m`, "g");
export const BG_RESET_RE = new RegExp(`${ESC}\\[49m`, "g");
export const FAINT_OFF_RE = new RegExp(`${ESC}\\[22m`, "g");
// Editor lane tag: APC family like CURSOR_MARKER (zero-width to layout,
// terminal-inert, stripped before write).
export const EDITOR_TAG = `${ESC}_dim:e\x07`;
export const EDITOR_TAG_RE = new RegExp(`${ESC}_dim:e\x07`, "g");
export const CUP_SPLIT_RE = new RegExp(`(${ESC}\\[\\d+;\\d+[Hf]|\\n)`, "g");
export const CUP_ONLY_RE = new RegExp(`^${ESC}\\[\\d+;\\d+[Hf]$`);
// Trailing partial escape held across stdout.write chunk boundaries so
// the next chunk parses whole. Covers CSI with any parameter count
// (truecolor SGR carries 4+ semicolons), OSC (`]...`, e.g. hyperlink
// close), APC (`_...`, e.g. EDITOR_TAG), and SOS/PM. Complete sequences
// (final byte / BEL / ST present) never match, so they are never held.
export const TRAILING_ESC_RE = new RegExp(
  `${ESC}(?:\\[[?\\d;]*|\\][^\\x07\\x1b]*(?:\\x1b)?|_[^\\x07\\x1b]*|[PX^][^\\x07\\x1b\\\\]*(?:\\x1b)?)?$`,
);

// Split off a trailing partial escape for carry-over. Returns [head, carry].
export function splitCarry(text: string): [string, string] {
  const trailing = text.match(TRAILING_ESC_RE);
  if (trailing?.[0]) {
    return [text.slice(0, -trailing[0].length), trailing[0]];
  }
  return [text, ""];
}
