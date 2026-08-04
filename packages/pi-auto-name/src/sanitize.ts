// sanitize.ts — per-style sanitizers for generated session/window names.

// --- slug style ---------------------------------------------------------------

// ── Named regexes (every regex in this module is hoisted here) ────────────

/** Runs of whitespace → collapsed to a single space. */
const WHITESPACE_RUN_RE = /\s+/g;
/** Leading markdown code fence, optionally with a language tag. */
const LEADING_CODE_FENCE_RE = /^```(?:\w+)?/u;
/** Closing markdown code fence. */
const TRAILING_CODE_FENCE_RE = /```$/u;
/** Leading `name:` label. */
const LEADING_NAME_PREFIX_RE = /^name\s*:\s*/iu;
/** Leading `title:` label. */
const LEADING_TITLE_PREFIX_RE = /^title\s*:\s*/iu;
/** Leading list bullet (`-`, `*`, `•`) with following whitespace. */
const LEADING_BULLET_CHARACTER_RE = /^[-*•]\s*/u;
/** A double-quote, single-quote, or backtick character. */
const QUOTE_OR_BACKTICK_CHARACTER_RE = /["'`]/gu;
/**
 * CJK + Thai word characters: Han ideographs, Japanese kana, Korean Hangul,
 * and Thai. These scripts have no whitespace word boundaries, so they are
 * treated as a single run/token for the `natural` window-name word floor
 * (`compactWindowName` lowers the floor to 1 when CJK_CHAR_RE matches) rather
 * than being split per-character (Thai, like CJK, is sized by character count
 * in the locales). Word tokenizers elsewhere are Unicode-aware (`\p{L}\p{N}`),
 * so other scripts (Arabic, Cyrillic, Devanagari, accented Latin…) are kept as
 * letter content automatically — this set only drives the no-boundary floor.
 */
const CJK_CHARS_SRC =
  "\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\u0E00-\u0E7F";
/** True when the value contains any CJK/Thai character (Han / kana / Hangul / Thai). */
const CJK_CHAR_RE = new RegExp(`[${CJK_CHARS_SRC}]`);
/** Runs of non-letter/mark/number characters → replaced with `-` (Unicode-aware). */
const NON_ALPHANUMERIC_RUN_RE = /[^\p{L}\p{M}\p{N}]+/gu;
/** Runs of consecutive hyphens → collapsed to a single `-`. */
const HYPHEN_RUN_RE = /-+/gu;
/** A hyphen at the very start or very end. */
const LEADING_OR_TRAILING_HYPHEN_RE = /^-|-$/gu;
/** ASCII/CJK quotes or brackets wrapping the whole title (also a trailing `.`). */
const WRAPPING_QUOTE_OR_BRACKET_RE = /^["'`\u300C\u300E\uFF08([]+|["'`\u300D\u300F\uFF09)\].]+$/g;
/** Trailing sentence-ending punctuation: `.` `。` `!` `！` `?` `？`. */
const TRAILING_SENTENCE_ENDING_PUNCTUATION_RE = /[.\u3002!\uFF01?\uFF1F]+$/g;
/** Control characters that must be stripped from a line. */
const CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
/** TUI box-drawing / block-element glyphs (herdr borders must not leak into a title). */
const TUI_BORDER_RE = /[\u2500-\u257f\u2580-\u259f]/;
/** UTC ISO-8601 timestamp (recognized as the temporary-title fallback). */
export const ISO_FALLBACK_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
/** Leading markdown/list decoration, whitespace, or quote characters. */
const LEADING_MARKDOWN_NOISE_CHARACTERS_RE = /^[\s>*_~`"'\u201C\u2018-]+/;
/** Trailing backtick, quote, whitespace, underscore, or tilde characters. */
const TRAILING_MARKDOWN_NOISE_CHARACTERS_RE = /[`"'\u201D\u2019\s*_~]+$/;
/** Trailing dots or whitespace. */
const TRAILING_DOT_OR_WHITESPACE_RE = /[.\s]+$/g;
/** A line break (LF or CRLF). */
const NEWLINE_SEQUENCE_RE = /\r?\n/;
/** Characters with special meaning inside a regular expression (for `escapeRegExp`). */
const REGEXP_META_CHARACTERS_RE = /[.*+?^${}()|[\]\\]/g;
/** Leading title-joiner punctuation: `|` `｜` `-` `–` `—` `:` `：` `·` `•`. */
const LEADING_TITLE_SEPARATOR_PUNCTUATION_RE = /^[|｜\-–—:：·•]+/g;
/** Trailing title-joiner punctuation: `|` `｜` `-` `–` `—` `:` `：` `·` `•`. */
const TRAILING_TITLE_SEPARATOR_PUNCTUATION_RE = /[|｜\-–—:：·•]+$/g;

/**
 * Slug-style text cleanup: strip markdown noise, quotes, and collapse runs of
 * non-alphanumeric characters to `-`. No length limiting here — callers apply
 * the enforced budget with `truncateToMax`.
 */
export function sanitizeSlug(raw: string): string {
  return raw
    .trim()
    .replace(LEADING_CODE_FENCE_RE, "")
    .replace(TRAILING_CODE_FENCE_RE, "")
    .replace(LEADING_NAME_PREFIX_RE, "")
    .replace(LEADING_TITLE_PREFIX_RE, "")
    .replace(LEADING_BULLET_CHARACTER_RE, "")
    .replace(QUOTE_OR_BACKTICK_CHARACTER_RE, "")
    .replace(NON_ALPHANUMERIC_RUN_RE, "-")
    .replace(HYPHEN_RUN_RE, "-")
    .replace(LEADING_OR_TRAILING_HYPHEN_RE, "")
    .toLowerCase();
}

// --- shared prose cleaner (used by topic-project) --------------------------

export function cleanTitle(raw: string, maxChars: number): string | null {
  if (!raw) return null;
  let t = raw.trim();
  t = t.replace(WRAPPING_QUOTE_OR_BRACKET_RE, "").trim();
  t = t.replace(WHITESPACE_RUN_RE, " ");
  t = t.replace(TRAILING_SENTENCE_ENDING_PUNCTUATION_RE, "");
  if (!t) return null;
  if (t.length > maxChars) t = truncateToMax(t, maxChars); // code-point safe
  return t.length > 0 ? t : null;
}

// --- natural style ---------------------------------------------------------

function cleanLine(line: string): string {
  return line
    .replace(CONTROL_CHARS_RE, "")
    .trim()
    .replace(LEADING_MARKDOWN_NOISE_CHARACTERS_RE, "")
    .replace(TRAILING_MARKDOWN_NOISE_CHARACTERS_RE, "")
    .trim()
    .replace(TRAILING_DOT_OR_WHITESPACE_RE, "");
}

function isValidPlainTitle(line: string, maxChars: number): boolean {
  if (!line || line.length > maxChars) return false;
  if (TUI_BORDER_RE.test(line)) return false;
  return true;
}

/** UTC ISO timestamp used as the temporary title when everything else fails. */
export function fallbackDatetime(now: Date = new Date()): string {
  return now.toISOString();
}

export function normalizeTitle(raw: string, maxChars: number): string {
  const lines = (raw ?? "").split(NEWLINE_SEQUENCE_RE).map(cleanLine).filter(Boolean);
  for (const line of lines) {
    if (TUI_BORDER_RE.test(line)) continue;
    if (ISO_FALLBACK_RE.test(line)) return line;
    if (isValidPlainTitle(line, maxChars)) return line;
  }
  return fallbackDatetime();
}

// --- topic-project style helpers ----------------------------------------------

export function codePointLength(value: string): number {
  return Array.from(value).length;
}

export function truncateToMax(value: string, maxChars: number): string {
  return Array.from(value).slice(0, maxChars).join("").trim();
}

export function tailToMax(value: string, maxChars: number): string {
  return Array.from(value).slice(-maxChars).join("").trim();
}

export function escapeRegExp(value: string): string {
  return value.replace(REGEXP_META_CHARACTERS_RE, "\\$&");
}

/** Runs of newlines/tabs → a single space. */
const NEWLINE_OR_TAB_RUN_RE = /[\n\r\t]+/g;
/** ASCII/CJK quote characters → space (word separators). */
const QUOTE_CHARACTER_RE = /["'`“”‘’]/g;
/** Non-letter/mark/number, non-space, non-hyphen characters → space (Unicode-aware). */
const NON_WORD_CHARACTER_RE = /[^\p{L}\p{M}\p{N}\s-]/gu;
/** Runs of hyphens/underscores → space. */
const HYPHEN_OR_UNDERSCORE_RUN_RE = /[-_]+/g;
/** Whitespace run → word separator. */
const WORD_WHITESPACE_RUN_RE = /\s+/;

/**
 * Split a value into words: whitespace runs, quotes, hyphens/underscores, and
 * non-alphanumeric punctuation all separate words (case preserved). Ported from
 * the reference extension's `normalizeWords`.
 */
export function normalizeWords(value: string): string[] {
  return value
    .replace(NEWLINE_OR_TAB_RUN_RE, " ")
    .replace(QUOTE_CHARACTER_RE, " ")
    .replace(NON_WORD_CHARACTER_RE, " ")
    .replace(HYPHEN_OR_UNDERSCORE_RUN_RE, " ")
    .split(WORD_WHITESPACE_RUN_RE)
    .map((word) => word.trim())
    .filter(Boolean);
}

export const WINDOW_WORD_MIN = 2;
export const WINDOW_WORD_MAX = 4;

/**
 * Compact to whole words in [minWords, maxWords], dropping trailing words when
 * the joined result exceeds maxChars (whole words only — never mid-word).
 * Returns undefined below the word floor or for punctuation-only input.
 */
export function compactWords(
  value: string,
  minWords: number,
  maxWords: number,
  maxChars = Infinity,
): string | undefined {
  const words = normalizeWords(value).slice(0, maxWords);
  if (words.length < minWords) return undefined;
  while (words.length > 1 && words.join(" ").length > maxChars) {
    words.pop();
  }
  const name = words.join(" ").trim();
  if (!name) return undefined;
  if (name.length <= maxChars) return name;
  // Pathological single word longer than the budget — hard slice as a last resort.
  return truncateToMax(name, maxChars) || undefined;
}

/**
 * Compact window name: 2-4 whole words by default (restore accepts 1 word),
 * capped at maxChars when given — whole words are dropped to fit, never split.
 * A value containing CJK or Thai has no whitespace word boundaries, so its
 * floor is lowered to 1: a single contiguous run is a complete, meaningful
 * token.
 */
export function compactWindowName(
  value: string,
  minWords = WINDOW_WORD_MIN,
  maxChars = Infinity,
): string | undefined {
  const effectiveMin = CJK_CHAR_RE.test(value) ? 1 : minWords;
  return compactWords(value, effectiveMin, WINDOW_WORD_MAX, maxChars);
}

/** Remove the project name from a title so it can be re-appended as a suffix. */
export function topicWithoutProject(title: string, projectName: string, separator: string): string {
  if (title.includes(separator)) {
    return title
      .split(separator)
      .map((part) => part.trim())
      .filter((part) => part && part !== projectName)
      .join(" ")
      .trim();
  }
  if (!title.includes(projectName)) return title;
  return title
    .replace(new RegExp(escapeRegExp(projectName), "g"), " ")
    .replace(TRAILING_TITLE_SEPARATOR_PUNCTUATION_RE, "")
    .replace(LEADING_TITLE_SEPARATOR_PUNCTUATION_RE, "")
    .replace(WHITESPACE_RUN_RE, " ")
    .trim();
}

/** Budget-aware "topic｜Project" composition (code-point safe). */
export function buildProjectSuffixTitle(
  topic: string,
  projectName: string,
  separator: string,
  maxChars: number,
): string {
  if (!Number.isInteger(maxChars) || maxChars <= 0) {
    return topic.trim() || projectName;
  }
  const trimmedTopic = topic.trim();
  const suffix = `${separator}${projectName}`;
  const suffixLength = codePointLength(suffix);
  if (suffixLength > maxChars) return tailToMax(projectName, maxChars);
  if (!trimmedTopic) return truncateToMax(projectName, maxChars);
  const topicBudget = maxChars - suffixLength;
  const topicPrefix = truncateToMax(trimmedTopic, topicBudget);
  if (!topicPrefix) return truncateToMax(projectName, maxChars);
  return `${topicPrefix}${suffix}`;
}
