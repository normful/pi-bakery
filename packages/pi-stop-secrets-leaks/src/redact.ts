// stop-secrets-leaks: pure position-based redaction. Given metadata findings
// (line/column from betterleaks) and original text, replace each span with a
// placeholder. NEVER read or store secret values.

import type { BetterleaksFinding, RedactResult } from "./types.js";

/**
 * Convert betterleaks (1-based) line/column into a 0-based absolute index
 * into `text`. Lines are split on '\n'. Columns are inclusive in betterleaks,
 * so the start offset is offset+(col-1) and the exclusive end offset is
 * offset+col. Columns past end-of-line are clamped to line length + 1.
 */
function lineColToOffset(text: string, line: number, column: number): number {
  const lines = text.split("\n");
  let offset = 0;
  const targetLine = Math.max(1, Math.min(line, lines.length));
  for (let i = 0; i < targetLine - 1; i++) {
    offset += (lines[i]?.length ?? 0) + 1; // +1 for the '\n'
  }
  const lineText = lines[targetLine - 1] ?? "";
  const col = Math.max(1, Math.min(column, lineText.length + 1));
  return offset + (col - 1);
}

function lineColToEndOffset(text: string, line: number, column: number): number {
  const lines = text.split("\n");
  let offset = 0;
  const targetLine = Math.max(1, Math.min(line, lines.length));
  for (let i = 0; i < targetLine - 1; i++) {
    offset += (lines[i]?.length ?? 0) + 1;
  }
  const lineText = lines[targetLine - 1] ?? "";
  // Cap "in this line" at length; for end we allow col = lineLength + 1 (one past).
  const col = Math.max(1, Math.min(column, lineText.length + 1));
  return offset + col;
}

interface Span {
  start: number;
  end: number; // exclusive
  finding: BetterleaksFinding;
}

function spanOf(finding: BetterleaksFinding, text: string): Span | null {
  // Reject findings whose lines are past the available line count outright.
  const lineCount = text.split("\n").length;
  if (finding.startLine > lineCount) return null;
  if (finding.endLine > lineCount) return null;
  let start = lineColToOffset(text, finding.startLine, finding.startColumn);
  let end = lineColToEndOffset(text, finding.endLine, finding.endColumn);
  if (end < start) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  if (start >= text.length) return null;
  if (end < 0) return null;
  if (end > text.length) end = text.length;
  return { start, end, finding };
}

export function redactByFindings(
  text: string,
  findings: BetterleaksFinding[],
  nextPlaceholder: () => string,
): RedactResult {
  if (!text || findings.length === 0) {
    return { text, hits: 0 };
  }

  // Step 1: compute all original spans (dropping invalid/empty/past-end).
  const allSpans: Span[] = [];
  for (const f of findings) {
    const s = spanOf(f, text);
    if (!s) continue;
    if (s.end <= s.start) continue;
    allSpans.push(s);
  }
  if (allSpans.length === 0) return { text, hits: 0 };

  // Step 2: deduplicate spans that are FULLY contained in another span.
  // Sort by start ASC, end DESC so the larger span is seen first.
  const sorted = allSpans.slice().sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - a.end;
  });
  const kept: Span[] = [];
  for (const span of sorted) {
    const dominated = kept.some((k) => span.start >= k.start && span.end <= k.end);
    if (dominated) continue;
    kept.push(span);
  }

  // Step 3: apply spans in TEXT (left→right) order so placeholders are
  // numbered in the order the LLM encounters them when reading output.
  // We never modify already-emitted text — we walk once.
  kept.sort((a, b) => a.start - b.start);
  let cursor = 0;
  const parts: string[] = [];
  let hits = 0;
  for (const span of kept) {
    const start = Math.max(cursor, span.start);
    if (start < span.end) {
      if (start > cursor) parts.push(text.slice(cursor, start));
      parts.push(nextPlaceholder());
      hits += 1;
      cursor = span.end;
    }
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return { text: parts.join(""), hits };
}
