import { describe, it, expect } from "vitest";
import {
  ISO_FALLBACK_RE,
  sanitizeSlug,
  cleanTitle,
  fallbackDatetime,
  normalizeTitle,
  codePointLength,
  truncateToMax,
  tailToMax,
  escapeRegExp,
  normalizeWords,
  WINDOW_WORD_MIN,
  WINDOW_WORD_MAX,
  compactWords,
  compactWindowName,
  topicWithoutProject,
  buildProjectSuffixTitle,
} from "../src/sanitize.js";

describe("sanitizeSlug (slug style)", () => {
  it("slugs a plain title", () => {
    expect(sanitizeSlug("Fix OAuth issue")).toBe("fix-oauth-issue");
  });

  it("lowercases the output", () => {
    expect(sanitizeSlug("Foo BAR Baz")).toBe("foo-bar-baz");
  });

  it("strips a leading markdown code fence with language tag", () => {
    expect(sanitizeSlug("```typescript\nFoo Bar\n```")).toBe("foo-bar");
  });

  it("strips a leading `name:` label", () => {
    expect(sanitizeSlug("name: Foo Bar")).toBe("foo-bar");
  });

  it("strips a leading `title:` label", () => {
    expect(sanitizeSlug("title: Foo Bar")).toBe("foo-bar");
  });

  it("strips a leading list bullet", () => {
    expect(sanitizeSlug("- Foo Bar")).toBe("foo-bar");
    expect(sanitizeSlug("* Foo Bar")).toBe("foo-bar");
    expect(sanitizeSlug("• Foo Bar")).toBe("foo-bar");
  });

  it("strips quotes and backticks anywhere", () => {
    expect(sanitizeSlug(`"Foo" Bar`)).toBe("foo-bar");
    expect(sanitizeSlug("`Foo` Bar")).toBe("foo-bar");
  });

  it("replaces non-alphanumeric runs with a single hyphen", () => {
    expect(sanitizeSlug("foo/bar baz")).toBe("foo-bar-baz");
    expect(sanitizeSlug("a.b.c")).toBe("a-b-c");
  });

  it("preserves CJK characters instead of collapsing to hyphens", () => {
    expect(sanitizeSlug("修复登录")).toBe("修复登录");
    expect(sanitizeSlug("fix auth 修复登录")).toBe("fix-auth-修复登录");
    expect(sanitizeSlug("日本語セッション")).toBe("日本語セッション");
    expect(sanitizeSlug("한국어 세션")).toBe("한국어-세션");
  });

  it("preserves Arabic letters instead of collapsing to hyphens", () => {
    expect(sanitizeSlug("توضيح تبعثر")).toBe("توضيح-تبعثر");
  });

  it("collapses consecutive hyphens", () => {
    expect(sanitizeSlug("foo---bar")).toBe("foo-bar");
  });

  it("trims leading and trailing hyphens", () => {
    expect(sanitizeSlug("-foo-")).toBe("foo");
  });

  it("does not truncate — the caller applies the budget with truncateToMax", () => {
    const long = "a".repeat(80);
    expect(sanitizeSlug(long)).toBe(long);
    expect(truncateToMax(sanitizeSlug(long), 60)).toHaveLength(60);
  });

  it("returns an empty string for empty input", () => {
    expect(sanitizeSlug("")).toBe("");
    expect(sanitizeSlug("   ")).toBe("");
  });
});

describe("cleanTitle (shared prose cleaner)", () => {
  it("returns null for empty input", () => {
    expect(cleanTitle("", 200)).toBeNull();
    expect(cleanTitle("   ", 200)).toBeNull();
    expect(cleanTitle(null as unknown as string, 200)).toBeNull();
  });

  it("trims and collapses whitespace runs", () => {
    expect(cleanTitle("  Fix   the  auth bug  ", 200)).toBe("Fix the auth bug");
  });

  it("strips wrapping quotes and brackets", () => {
    expect(cleanTitle(`"Fix the auth bug"`, 200)).toBe("Fix the auth bug");
    expect(cleanTitle("'Fix the auth bug'", 200)).toBe("Fix the auth bug");
    expect(cleanTitle("(Fix the auth bug)", 200)).toBe("Fix the auth bug");
    expect(cleanTitle("[Fix the auth bug]", 200)).toBe("Fix the auth bug");
    expect(cleanTitle("「修复认证问题」", 200)).toBe("修复认证问题");
  });

  it("strips trailing sentence-ending punctuation", () => {
    expect(cleanTitle("Fix the auth bug.", 200)).toBe("Fix the auth bug");
    expect(cleanTitle("Really!?", 200)).toBe("Really");
    expect(cleanTitle("等等！", 200)).toBe("等等");
  });

  it("truncates to maxChars", () => {
    expect(cleanTitle("abcdefghij", 5)).toBe("abcde");
  });

  it("returns null when only punctuation remains", () => {
    expect(cleanTitle("!!!", 200)).toBeNull();
  });
});

describe("fallbackDatetime (temporary title)", () => {
  it("produces a UTC ISO-8601 timestamp matching ISO_FALLBACK_RE", () => {
    const now = new Date("2026-01-05T09:30:00Z");
    const out = fallbackDatetime(now);
    expect(out).toBe(now.toISOString());
    expect(ISO_FALLBACK_RE.test(out)).toBe(true);
  });

  it("zero-pads to the canonical toISOString shape", () => {
    const now = new Date("2026-03-03T04:05:06Z");
    const out = fallbackDatetime(now);
    expect(out).toBe("2026-03-03T04:05:06.000Z");
  });
});

describe("normalizeTitle (natural style)", () => {
  it("returns a plain valid line", () => {
    expect(normalizeTitle("OAuth token refresh", 96)).toBe("OAuth token refresh");
  });

  it("returns the first valid line from a multi-line candidate", () => {
    expect(normalizeTitle("Fix the retry loop\nAdd auth", 96)).toBe("Fix the retry loop");
  });

  it("passes an ISO timestamp through untouched", () => {
    const iso = fallbackDatetime(new Date());
    expect(normalizeTitle(iso, 96)).toBe(iso);
  });

  it("skips lines containing TUI border glyphs", () => {
    const line = "\u2500\u2500\u2500 box border \u2500\u2500\u2500";
    const out = normalizeTitle(`${line}\nReal title`, 96);
    expect(out).toBe("Real title");
  });

  it("strips markdown noise from a line", () => {
    expect(normalizeTitle("**Bold title**", 96)).toBe("Bold title");
  });

  it("strips control characters", () => {
    expect(normalizeTitle("fix\x00me", 96)).toBe("fixme");
  });

  it("falls back to an ISO timestamp when no line is valid", () => {
    const out = normalizeTitle("", 96);
    expect(ISO_FALLBACK_RE.test(out)).toBe(true);
  });

  it("rejects a plain line exceeding maxLength and falls through", () => {
    const long = "x".repeat(97);
    const out = normalizeTitle(long, 96);
    expect(ISO_FALLBACK_RE.test(out)).toBe(true);
  });
});

describe("code-point helpers", () => {
  it("codePointLength counts code points, not UTF-16 units", () => {
    expect(codePointLength("🦊🦊")).toBe(2);
    expect(codePointLength("修复认证")).toBe(4);
  });

  it("truncateToMax slices by code points and trims the result", () => {
    expect(truncateToMax("🦊🦊🦊", 2)).toBe("🦊🦊");
    expect(truncateToMax("abcd", 2)).toBe("ab");
    expect(truncateToMax("  abc  ", 2)).toBe(""); // leading spaces trimmed after slice
  });

  it("tailToMax keeps the last code points", () => {
    expect(tailToMax("abcdef", 2)).toBe("ef");
    expect(tailToMax("🦊🦊🦊", 2)).toBe("🦊🦊");
  });

  it("escapeRegExp escapes regex meta characters", () => {
    expect(escapeRegExp("a.b*c")).toBe("a\\.b\\*c");
  });
});

describe("normalizeWords", () => {
  it("splits on whitespace, punctuation, quotes, and hyphens", () => {
    expect(normalizeWords("Fix-OAuth_issue, please!")).toEqual(["Fix", "OAuth", "issue", "please"]);
  });

  it("handles newlines and tabs as separators", () => {
    expect(normalizeWords("a\nb\tc")).toEqual(["a", "b", "c"]);
  });

  it("returns [] for punctuation-only input", () => {
    expect(normalizeWords("!!! ---")).toEqual([]);
  });

  it("preserves case", () => {
    expect(normalizeWords("Title Case Words")).toEqual(["Title", "Case", "Words"]);
  });

  it("treats a contiguous CJK run as a single token (no word boundaries)", () => {
    expect(normalizeWords("修复登录")).toEqual(["修复登录"]);
    expect(normalizeWords("OAuth 修复登录 缓存")).toEqual(["OAuth", "修复登录", "缓存"]);
  });

  it("keeps Arabic words as tokens (non-Latin scripts are not stripped)", () => {
    expect(normalizeWords("توضيح تبعثر رايلي")).toEqual(["توضيح", "تبعثر", "رايلي"]);
  });

  it("keeps accented Latin letters (é, è, ü, ş…) as word content", () => {
    expect(normalizeWords("Réfraction lumière")).toEqual(["Réfraction", "lumière"]);
  });
});

describe("compactWords / compactWindowName", () => {
  it("keeps words within [minWords, maxWords]", () => {
    expect(compactWords("The quick brown fox jumps", WINDOW_WORD_MIN, WINDOW_WORD_MAX)).toBe(
      "The quick brown fox",
    );
  });

  it("returns undefined below the word floor", () => {
    expect(compactWords("One", WINDOW_WORD_MIN, WINDOW_WORD_MAX)).toBeUndefined();
    expect(compactWindowName("One")).toBeUndefined();
  });

  it("drops trailing words to satisfy maxChars (whole words only)", () => {
    expect(compactWords("aaaa bbbb cccc", 2, 4, 9)).toBe("aaaa bbbb");
  });

  it("returns undefined for punctuation-only input", () => {
    expect(compactWords("!!! ---", 2, 4)).toBeUndefined();
  });

  it("hard-slices a pathological long word over the budget", () => {
    expect(compactWords("abcdefghij klmnop", 1, 4, 5)).toBe("abcde");
  });

  it("compactWindowName defaults to 2-4 words", () => {
    expect(compactWindowName("Alpha Beta Gamma")).toBe("Alpha Beta Gamma");
    expect(compactWindowName("Alpha")).toBeUndefined();
  });

  it("compactWindowName accepts a 1-word restore via minWords=1", () => {
    expect(compactWindowName("Alpha", 1)).toBe("Alpha");
  });

  it("compactWindowName caps at maxChars by dropping whole words", () => {
    expect(compactWindowName("Alpha Beta Gamma Delta", WINDOW_WORD_MIN, 15)).toBe("Alpha Beta");
  });

  it("lowers the floor to 1 when CJK is present (a single run is a valid name)", () => {
    expect(compactWindowName("修复登录")).toBe("修复登录");
    expect(compactWindowName("日本語")).toBe("日本語");
    expect(compactWindowName("한국어")).toBe("한국어");
  });

  it("lowers the floor to 1 for Thai (no word boundaries, like CJK)", () => {
    expect(compactWindowName("รีเฟรชโทเค็น")).toBe("รีเฟรชโทเค็น");
  });

  it("still enforces the 2-word floor for whitespace-separated (English) names", () => {
    expect(compactWindowName("OAuth")).toBeUndefined();
  });

  it("keeps mixed CJK + Latin runs under the budget", () => {
    expect(compactWindowName("fix 修复 缓存")).toBe("fix 修复 缓存");
  });

  it("keeps Arabic window names (multiple words survive compaction)", () => {
    expect(compactWindowName("توضيح تبعثر رايلي")).toBe("توضيح تبعثر رايلي");
  });

  it("keeps accented-Latin window names", () => {
    expect(compactWindowName("Réfraction lumière")).toBe("Réfraction lumière");
  });

  it("exported constants are stable", () => {
    expect(WINDOW_WORD_MIN).toBe(2);
    expect(WINDOW_WORD_MAX).toBe(4);
  });
});

describe("topicWithoutProject", () => {
  const sep = "｜";

  it("removes the project part after a separator", () => {
    expect(topicWithoutProject("Fix auth｜pi-bakery", "pi-bakery", sep)).toBe("Fix auth");
  });

  it("joins separator parts, dropping empties and the project name", () => {
    expect(topicWithoutProject("A｜B", "C", sep)).toBe("A B");
  });

  it("returns the title unchanged when it has no separator and no project", () => {
    expect(topicWithoutProject("Fix auth", "pi-bakery", sep)).toBe("Fix auth");
  });

  it("removes an embedded project name and strips joiner punctuation", () => {
    expect(topicWithoutProject("pi-bakery｜fix auth", "pi-bakery", sep)).toBe("fix auth");
  });
});

describe("buildProjectSuffixTitle", () => {
  const sep = "｜";

  it("composes topic + suffix within budget", () => {
    expect(buildProjectSuffixTitle("Fix auth", "pi-bakery", sep, 24)).toBe("Fix auth｜pi-bakery");
  });

  it("returns project-only when the topic is empty", () => {
    expect(buildProjectSuffixTitle("", "pi-bakery", sep, 24)).toBe("pi-bakery");
  });

  it("tails the project when the suffix alone exceeds maxChars", () => {
    expect(buildProjectSuffixTitle("x", "verylongprojectname", sep, 5)).toBe("tname");
  });

  it("truncates the topic to leave room for the suffix", () => {
    expect(buildProjectSuffixTitle("aaaa", "bb", sep, 4)).toBe("a｜bb");
  });

  it("returns topic or project for non-positive maxChars", () => {
    expect(buildProjectSuffixTitle("Fix auth", "pi-bakery", sep, 0)).toBe("Fix auth");
    expect(buildProjectSuffixTitle("", "pi-bakery", sep, 0)).toBe("pi-bakery");
    expect(buildProjectSuffixTitle("Fix auth", "pi-bakery", sep, 2.5)).toBe("Fix auth");
  });
});
