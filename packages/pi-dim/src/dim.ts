import {
  FAINT_ON,
  FAINT_OFF,
  FG_RESET,
  BG_RESET,
  RESET_ALL,
  INVISIBLE_FG,
  INVISIBLE_BG,
  RESET_ALL_RE,
  FG_RESET_RE,
  BG_RESET_RE,
  FAINT_OFF_RE,
  CUP_SPLIT_RE,
  CUP_ONLY_RE,
  EDITOR_TAG,
  EDITOR_TAG_RE,
  splitCarry,
} from "./ansi.js";

// Test handle for the pure core. The default export in index.ts is what the
// pi extension loader consumes; this adds no behavior.
export const __dimScreenTest = {
  dimStdoutText,
  splitCarry,
  EDITOR_TAG,
  INVISIBLE_FG,
  INVISIBLE_BG,
  RESET_ALL,
  FAINT_ON,
  FG_RESET,
};

export function dimStdoutText(str: string): string {
  const both = `${INVISIBLE_BG}${INVISIBLE_FG}`;
  // Segmented dim: split the chunk at CUP row addresses and newlines so
  // alt-screen rows (CUP-separated, no newlines) classify independently.
  // Editor-tagged segments pass through bright (tag stripped, leading reset
  // clears leaks); everything else takes the invisible prefix with re-arms.
  // SGR is last-wins per span, so explicitly colored spans survive either lane.
  const dimSegment = (segment: string): string => {
    if (segment === "") return segment;
    if (segment.includes(EDITOR_TAG)) {
      return `${RESET_ALL}${segment.replace(EDITOR_TAG_RE, "")}`;
    }
    let line = segment;
    // Re-arm dim after any reset that would otherwise leak visible text:
    // Theme.fg/bg emit 39m/49m (not 0m), chalk bold-off emits 22m (which
    // also clears faint), so without this anything after the first reset
    // renders in the default visible color.
    // Replacements are single-pass (no rescan), so inserted codes can't cascade.
    line = line.replace(RESET_ALL_RE, `${RESET_ALL}${FAINT_ON}${both}`);
    line = line.replace(FG_RESET_RE, `${FG_RESET}${FAINT_ON}${INVISIBLE_FG}`);
    line = line.replace(BG_RESET_RE, `${BG_RESET}${FAINT_ON}${INVISIBLE_BG}`);
    line = line.replace(FAINT_OFF_RE, `${FAINT_OFF}${FAINT_ON}`);
    // Hermetic seal: trailing reset stops invisible fg/bg leaking into later segments.
    return `${FAINT_ON}${both}${line}${RESET_ALL}`;
  };
  let out = "";
  let pendingCUP = "";
  for (const part of str.split(CUP_SPLIT_RE)) {
    if (part === "\n" || part === "") {
      // Flush a pending row address first: preserves stream order
      // and keeps cursor addresses byte-identical (SGR around CUP
      // is harmless but pointless).
      out += pendingCUP;
      pendingCUP = "";
      out += part;
    } else if (CUP_ONLY_RE.test(part)) {
      // Row address for the following text; chain (rare) stays ordered.
      pendingCUP += part;
    } else {
      out += dimSegment(pendingCUP + part);
      pendingCUP = "";
    }
  }
  out += pendingCUP;
  return out;
}
