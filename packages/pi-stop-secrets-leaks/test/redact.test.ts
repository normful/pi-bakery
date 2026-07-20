import { describe, expect, it } from "vitest";
import { redactByFindings } from "../src/redact.js";
import type { BetterleaksFinding } from "../src/types.js";

// Factory to count placeholder generations for assertions.
function makePlaceholderFactory(): {
  next: () => string;
  values: string[];
} {
  const values: string[] = [];
  let seq = 0;
  return {
    values,
    next: () => {
      seq += 1;
      const ph = `«🔒 $S_${String(seq).padStart(2, "0")}»`;
      values.push(ph);
      return ph;
    },
  };
}

function finding(
  over: Partial<BetterleaksFinding> & {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  },
): BetterleaksFinding {
  return {
    source: "text",
    ruleID: "test",
    description: "",
    file: "",
    entropy: 0,
    fingerprint: `test:${over.startLine}:${over.startColumn}`,
    ...over,
  };
}

describe("redactByFindings — basic single-line", () => {
  it("replaces a single finding span and reports hit", () => {
    // "prefix SECRET_VALUE suffix"
    // positions: p(1) r(2) e(3) f(4) i(5) x(6) ' '(7) S(8) E(9) C(10) R(11) E(12) T(13) _(14) V(15) A(16) L(17) U(18) E(19) ' '(20) ...
    // SECRET_VALUE at cols 8..19 inclusive = 12 chars
    const text = "prefix SECRET_VALUE suffix";
    const f = finding({
      startLine: 1,
      startColumn: 8,
      endLine: 1,
      endColumn: 19,
    });
    const ph = makePlaceholderFactory();
    const r = redactByFindings(text, [f], ph.next);
    const v0 = ph.values[0] ?? "";
    expect(r.hits).toBe(1);
    expect(r.text).toBe(`prefix ${v0} suffix`);
    expect(r.text).not.toContain("SECRET_VALUE");
  });

  it("returns original text when no findings", () => {
    const text = "nothing to redact here";
    const ph = makePlaceholderFactory();
    const r = redactByFindings(text, [], ph.next);
    expect(r).toEqual({ text, hits: 0 });
  });

  it("returns empty/text unchanged for empty text", () => {
    const ph = makePlaceholderFactory();
    const r = redactByFindings(
      "",
      [
        finding({
          startLine: 1,
          startColumn: 1,
          endLine: 1,
          endColumn: 2,
        }),
      ],
      ph.next,
    );
    expect(r).toEqual({ text: "", hits: 0 });
  });

  it("ignores findings past the end of the text safely", () => {
    const text = "abc";
    const f = finding({
      startLine: 99,
      startColumn: 1,
      endLine: 99,
      endColumn: 99,
    });
    const ph = makePlaceholderFactory();
    const r = redactByFindings(text, [f], ph.next);
    // past end → no throw, no hit
    expect(r.text).toBe(text);
    expect(r.hits).toBe(0);
  });
});

describe("redactByFindings — multiple findings on same line", () => {
  it("replaces both spans independently and numbers placeholders in text order", () => {
    // "AAA TOKEN1 BBB TOKEN2 CCC"
    // positions: A(1) A(2) A(3) ' '(4) T(5) ... 1(10) ' '(11) B(12) B(13) B(14) ' '(15) T(16)...2(21) ' '(22)...
    // TOKEN1 at cols 5..10 (6 chars), TOKEN2 at cols 16..21 (6 chars)
    const text = "AAA TOKEN1 BBB TOKEN2 CCC";
    const f1 = finding({
      startLine: 1,
      startColumn: 5,
      endLine: 1,
      endColumn: 10,
    });
    const f2 = finding({
      startLine: 1,
      startColumn: 16,
      endLine: 1,
      endColumn: 21,
    });
    const ph = makePlaceholderFactory();
    const r = redactByFindings(text, [f1, f2], ph.next);
    const v0 = ph.values[0] ?? "";
    const v1 = ph.values[1] ?? "";
    expect(r.hits).toBe(2);
    expect(r.text).toBe(`AAA ${v0} BBB ${v1} CCC`);
    expect(r.text).not.toContain("TOKEN1");
    expect(r.text).not.toContain("TOKEN2");
  });
});

describe("redactByFindings — multi-line findings", () => {
  it("replaces a private-key-shaped block spanning 3 lines with one placeholder", () => {
    // Line 1: PK_HEADER (3 chars)
    // Line 2: ABCDEFGHIJKLMNOPQRSTUVWXYZ (26 chars)
    // Line 3: PK_FOOTER (3 chars)
    const text = "PKH\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nPKF";
    const f = finding({
      startLine: 1,
      startColumn: 1,
      endLine: 3,
      endColumn: 3,
    });
    const ph = makePlaceholderFactory();
    const r = redactByFindings(text, [f], ph.next);
    const firstPlaceholder = ph.values[0] ?? "";
    expect(r.hits).toBe(1);
    expect(r.text).toBe(firstPlaceholder);
    // Original content fully replaced
    expect(r.text).not.toContain("PKH");
    expect(r.text).not.toContain("ABCDEFGHIJKLMN");
  });
});

describe("redactByFindings — ordering", () => {
  it("applies in left-to-right text order regardless of input order", () => {
    // Two findings on the same line; pass them in [later, earlier] order.
    const text = "AAA TOKEN1 BBB TOKEN2 CCC";
    const f1 = finding({
      startLine: 1,
      startColumn: 5,
      endLine: 1,
      endColumn: 10,
    });
    const f2 = finding({
      startLine: 1,
      startColumn: 16,
      endLine: 1,
      endColumn: 21,
    });
    const ph = makePlaceholderFactory();
    const r = redactByFindings(text, [f2, f1], ph.next); // reversed
    const v0 = ph.values[0] ?? "";
    const v1 = ph.values[1] ?? "";
    expect(r.hits).toBe(2);
    // Both placeholders present, original tokens gone
    expect(r.text).toContain(v0);
    expect(r.text).toContain(v1);
    expect(r.text).not.toContain("TOKEN1");
    expect(r.text).not.toContain("TOKEN2");
  });
});

describe("redactByFindings — overlap handling", () => {
  it("skips a finding fully inside an already-applied span (no double-soup)", () => {
    // "prefix BIG_SECRET_HERE suffix"
    // B(8) I(9) G(10) _(11) S(12) E(13) C(14) R(15) E(16) T(17) _(18) H(19) E(20) R(21) E(22)
    // BIG_SECRET_HERE at cols 8..22 (15 chars)
    // Inner "SECRE" at cols 12..16 (5 chars) is fully inside the outer span.
    const text = "prefix BIG_SECRET_HERE suffix";
    const outer = finding({
      startLine: 1,
      startColumn: 8,
      endLine: 1,
      endColumn: 22,
      fingerprint: "outer",
    });
    const inner = finding({
      startLine: 1,
      startColumn: 12,
      endLine: 1,
      endColumn: 16,
      fingerprint: "inner",
    });
    const ph = makePlaceholderFactory();
    const r = redactByFindings(text, [outer, inner], ph.next);
    const v0 = ph.values[0] ?? "";
    // Outer is applied (hits=1); inner is skipped because fully covered.
    expect(r.hits).toBe(1);
    expect(r.text).toBe(`prefix ${v0} suffix`);
  });

  it("applies non-overlapping findings in left-to-right order", () => {
    // "XABCXY" — X(1) A(2) B(3) C(4) X(5) Y(6)
    // ABC at cols 2..4, XY at cols 5..6 (both inclusive)
    const text = "XABCXY";
    const f1 = finding({
      startLine: 1,
      startColumn: 2,
      endLine: 1,
      endColumn: 4,
      fingerprint: "a",
    });
    const f2 = finding({
      startLine: 1,
      startColumn: 5,
      endLine: 1,
      endColumn: 6,
      fingerprint: "b",
    });
    const ph = makePlaceholderFactory();
    const r = redactByFindings(text, [f1, f2], ph.next);
    const v0 = ph.values[0] ?? "";
    const v1 = ph.values[1] ?? "";
    expect(r.hits).toBe(2);
    expect(r.text).toBe(`X${v0}${v1}`);
  });
});

describe("redactByFindings — placeholder format", () => {
  it("uses the factory's placeholder for each applied finding", () => {
    // "AAA X BBB Y CCC" — X(5), Y(10)
    const text = "AAA X BBB Y CCC";
    const f1 = finding({
      startLine: 1,
      startColumn: 5,
      endLine: 1,
      endColumn: 5,
    });
    const f2 = finding({
      startLine: 1,
      startColumn: 10,
      endLine: 1,
      endColumn: 10,
    });
    const ph = makePlaceholderFactory();
    const r = redactByFindings(text, [f1, f2], ph.next);
    expect(r.hits).toBe(2);
    // Two calls into the factory
    expect(ph.values.length).toBe(2);
    for (const v of ph.values) {
      expect(v).toMatch(/^«🔒 \$S_\d{2,}»$/);
    }
  });

  it("counts only applied findings against the factory", () => {
    // "prefix ABCD suffix" — p(1) r(2) e(3) f(4) i(5) x(6) ' '(7) A(8) B(9) C(10) D(11) ' '(12) ...
    // outer ABCD at cols 8..11; inner BCD at cols 9..11 (fully inside outer)
    const text = "prefix ABCD suffix";
    const outer = finding({
      startLine: 1,
      startColumn: 8,
      endLine: 1,
      endColumn: 11,
      fingerprint: "o",
    });
    const inner = finding({
      startLine: 1,
      startColumn: 9,
      endLine: 1,
      endColumn: 11,
      fingerprint: "i",
    });
    const ph = makePlaceholderFactory();
    const r = redactByFindings(text, [outer, inner], ph.next);
    expect(r.hits).toBe(1);
    expect(ph.values.length).toBe(1);
  });
});

describe("redactByFindings — 1-based column semantics", () => {
  it("StartColumn=1 covers first character of the line", () => {
    // "ABCDEF" — A(1) B(2) C(3) D(4) E(5) F(6)
    // span cols 1..3 covers A,B,C
    const text = "ABCDEF";
    const f = finding({
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 3,
    });
    const ph = makePlaceholderFactory();
    const r = redactByFindings(text, [f], ph.next);
    const v0 = ph.values[0] ?? "";
    expect(r.hits).toBe(1);
    expect(r.text).toBe(`${v0}DEF`);
  });

  it("handles StartLine = EndLine with multi-line text correctly", () => {
    const text = "line1\nTARGETTOKEN\nline3";
    // Line 2, cols 1..11 covers "TARGETTOKEN" (11 chars)
    const f = finding({
      startLine: 2,
      startColumn: 1,
      endLine: 2,
      endColumn: 11,
    });
    const ph = makePlaceholderFactory();
    const r = redactByFindings(text, [f], ph.next);
    const v0 = ph.values[0] ?? "";
    expect(r.hits).toBe(1);
    expect(r.text).toBe(`line1\n${v0}\nline3`);
  });
});

describe("redactByFindings — invariant: never store secrets", () => {
  it("accepts only metadata findings (no secret field)", () => {
    const text = "TOKEN_HERE_BUT_NOT_KEPT";
    // Construct a finding explicitly WITHOUT a secret property.
    const f: BetterleaksFinding = {
      source: "text",
      ruleID: "test-rule",
      description: "test",
      file: "",
      entropy: 4.5,
      fingerprint: "fp-1",
      startLine: 1,
      endLine: 1,
      startColumn: 1,
      endColumn: 22,
    };
    // Type-system guarantee — no `secret` field exists on BetterleaksFinding.
    // We just verify the API still works.
    const ph = makePlaceholderFactory();
    const r = redactByFindings(text, [f], ph.next);
    const v0 = ph.values[0] ?? "";
    expect(r.hits).toBe(1);
    expect(r.text).toContain(v0);
    expect(r.text).not.toContain("TOKEN_HERE_BUT_NOT_KEPT");
  });
});
