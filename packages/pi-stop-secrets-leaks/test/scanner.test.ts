import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isBetterleaksAvailable,
  parseEnvNameFromMatch,
  parseFindings,
  runBetterleaks,
  scanEnv,
  scanFiles,
  scanText,
} from "../src/scanner.js";
import type { BetterleaksFinding, BetterleaksRawFinding } from "../src/types.js";

// Synthetic fixtures used to exercise betterleaks detection. These are
// fabricated, low-value strings designed to have enough entropy/diversity
// to trip the "generic-api-key" rule. They are NOT real credentials.
const FIXTURE_KEY_A = "cccc1234abcdABCD5678efghEFGH";
const FIXTURE_KEY_B = "dddd1234wxyzWXYZ5678ijklIJKL";
const FIXTURE_KEY_C = "eeeeF1G2H3I4J5K6L7M8N9O0P1Q2";

// Build a `KEY=REDACTED` match string at runtime so the test source stays
// free of literal patterns that secret auto-redaction might transform.
function keyEq(match: string): string {
  return `${match}=REDACTED`;
}

const hasBetterleaks = await isBetterleaksAvailable();

describe("parseEnvNameFromMatch", () => {
  it("parses KEY=VALUE form", () => {
    expect(parseEnvNameFromMatch(keyEq("FOO"))).toBe("FOO");
  });

  it("parses KEY= form with surrounding spaces", () => {
    expect(parseEnvNameFromMatch(`  FOO ${"=".repeat(1)} REDACTED  `)).toBe("FOO");
  });

  it('parses KEY="VALUE" form', () => {
    expect(parseEnvNameFromMatch('FOO="REDACTED"')).toBe("FOO");
  });

  it("returns undefined for free text without '='", () => {
    expect(parseEnvNameFromMatch("no equals here")).toBeUndefined();
  });

  it("returns undefined for empty/undefined input", () => {
    expect(parseEnvNameFromMatch("")).toBeUndefined();
    expect(parseEnvNameFromMatch(undefined)).toBeUndefined();
  });

  it("parses underscore-prefixed keys", () => {
    expect(parseEnvNameFromMatch(keyEq("_INTERNAL_TOKEN"))).toBe("_INTERNAL_TOKEN");
  });

  it("parses keys with digits", () => {
    expect(parseEnvNameFromMatch(keyEq("KEY2_NAME"))).toBe("KEY2_NAME");
  });
});

describe("parseFindings — pascalCase raw → camelCase result", () => {
  it("maps PascalCase fields to camelCase", () => {
    const raw: BetterleaksRawFinding[] = [
      {
        RuleID: "generic-api-key",
        Description: "desc",
        Match: "OPENAI_KEY=REDACTED",
        Secret: "REDACTED",
        File: "/tmp/x.txt",
        Entropy: 4.9,
        Fingerprint: "fp1",
        StartLine: 1,
        EndLine: 1,
        StartColumn: 1,
        EndColumn: 12,
      },
    ];
    const out = parseFindings(raw, "file");
    expect(out[0]?.ruleID).toBe("generic-api-key");
    expect(out[0]?.description).toBe("desc");
    expect(out[0]?.entropy).toBe(4.9);
    expect(out[0]?.fingerprint).toBe("fp1");
    expect(out[0]?.startLine).toBe(1);
    expect(out[0]?.endLine).toBe(1);
    expect(out[0]?.startColumn).toBe(1);
    expect(out[0]?.endColumn).toBe(12);
  });

  it("discards Secret — result has no secret property", () => {
    const raw: BetterleaksRawFinding[] = [
      {
        RuleID: "r",
        Secret: "REDACTED",
        File: "/x",
        Fingerprint: "fp",
        StartLine: 1,
        EndLine: 1,
        StartColumn: 1,
        EndColumn: 2,
      },
    ];
    const out = parseFindings(raw, "file");
    const result = out[0] as unknown as Record<string, unknown>;
    expect(result.secret).toBeUndefined();
    expect("secret" in result).toBe(false);
  });

  it("source=file uses the raw File path verbatim", () => {
    const out = parseFindings(
      [
        {
          RuleID: "r",
          File: "/abs/path/file.env",
          Fingerprint: "fp",
          StartLine: 1,
          EndLine: 1,
          StartColumn: 1,
          EndColumn: 2,
        },
      ],
      "file",
    );
    expect(out[0]?.file).toBe("/abs/path/file.env");
  });

  it("source=env sets file='(env)' and parses envName", () => {
    const out = parseFindings(
      [
        {
          RuleID: "r",
          File: "",
          Match: "FOO_BAR=REDACTED",
          Fingerprint: "fp",
          StartLine: 1,
          EndLine: 1,
          StartColumn: 1,
          EndColumn: 17,
        },
      ],
      "env",
    );
    expect(out[0]?.file).toBe("(env)");
    expect(out[0]?.envName).toBe("FOO_BAR");
  });

  it("source=env without parseable NAME= leaves envName undefined", () => {
    const out = parseFindings(
      [
        {
          RuleID: "r",
          File: "",
          Match: "REDACTED",
          Fingerprint: "fp",
          StartLine: 1,
          EndLine: 1,
          StartColumn: 1,
          EndColumn: 8,
        },
      ],
      "env",
    );
    expect(out[0]?.file).toBe("(env)");
    expect(out[0]?.envName).toBeUndefined();
  });

  it("source=text sets file=''", () => {
    const out = parseFindings(
      [
        {
          RuleID: "r",
          File: "",
          Fingerprint: "fp",
          StartLine: 1,
          EndLine: 1,
          StartColumn: 1,
          EndColumn: 2,
        },
      ],
      "text",
    );
    expect(out[0]?.file).toBe("");
  });

  it("uses safe defaults for missing optional fields", () => {
    const out = parseFindings([{} as BetterleaksRawFinding], "file");
    expect(out[0]?.ruleID).toBe("");
    expect(out[0]?.description).toBe("");
    expect(out[0]?.entropy).toBe(0);
    expect(out[0]?.startLine).toBe(0);
    expect(out[0]?.endLine).toBe(0);
    expect(out[0]?.startColumn).toBe(0);
    expect(out[0]?.endColumn).toBe(0);
  });

  it("falls back fingerprint to file:ruleID:startLine", () => {
    const out = parseFindings(
      [
        {
          RuleID: "rule-1",
          File: "/x",
          StartLine: 7,
          EndLine: 7,
          StartColumn: 1,
          EndColumn: 2,
        } as BetterleaksRawFinding,
      ],
      "file",
    );
    expect(out[0]?.fingerprint).toBe("/x:rule-1:7");
  });

  it("uses provided fingerprint when present", () => {
    const out = parseFindings(
      [
        {
          RuleID: "rule-1",
          File: "/x",
          Fingerprint: "explicit-fp",
          StartLine: 1,
          EndLine: 1,
          StartColumn: 1,
          EndColumn: 2,
        },
      ],
      "file",
    );
    expect(out[0]?.fingerprint).toBe("explicit-fp");
  });

  it("preserves matchRedacted when present", () => {
    const out = parseFindings(
      [
        {
          RuleID: "r",
          File: "/x",
          Match: "FOO=REDACTED",
          Fingerprint: "fp",
          StartLine: 1,
          EndLine: 1,
          StartColumn: 1,
          EndColumn: 14,
        },
      ],
      "env",
    );
    expect(out[0]?.matchRedacted).toBe("FOO=REDACTED");
  });
});

describe("isBetterleaksAvailable", () => {
  it("returns a boolean", async () => {
    const v = await isBetterleaksAvailable();
    expect(typeof v).toBe("boolean");
  });
});

describe.skipIf(!hasBetterleaks)("runBetterleaks", () => {
  it("returns an array (no throw) on plain prose", async () => {
    const r = await runBetterleaks(["stdin"], {
      stdin: "Hello, world. Nothing sensitive here at all, just text.",
    });
    expect(Array.isArray(r)).toBe(true);
  });

  it("passes --redact=100 — Secret field is REDACTED, never raw", async () => {
    const env = `OPENAI_KEY=${FIXTURE_KEY_A}`;
    const r = await runBetterleaks(["stdin"], { stdin: env });
    expect(r.length).toBeGreaterThan(0);
    for (const row of r) {
      expect(row.Secret).toBe("REDACTED");
      expect(row.Secret).not.toBe(FIXTURE_KEY_A);
      expect(row.Secret).not.toContain(FIXTURE_KEY_A.slice(0, 8));
    }
  });
});

describe.skipIf(!hasBetterleaks)("scanText (wrapper around runBetterleaks + parseFindings)", () => {
  it("returns [] for plain prose", async () => {
    const r = await scanText("Hi there. This is just normal prose, no secrets inside.");
    expect(r).toEqual([]);
  });

  it("returns findings with positions for a fixture key (no secret field)", async () => {
    const prose = `Some prefix text. OPENAI_KEY=${FIXTURE_KEY_A} and more.`;
    const r = await scanText(prose);
    expect(r.length).toBeGreaterThan(0);
    const first = r[0];
    expect(first).toBeDefined();
    const f = first as BetterleaksFinding;
    expect(f.source).toBe("text");
    expect(f.startLine).toBeGreaterThanOrEqual(1);
    expect(f.startColumn).toBeGreaterThanOrEqual(1);
    expect(f.endColumn).toBeGreaterThanOrEqual(f.startColumn);
    const asRecord = f as unknown as Record<string, unknown>;
    expect(asRecord.secret).toBeUndefined();
  });

  it("returns [] for empty input", async () => {
    expect(await scanText("")).toEqual([]);
  });
});

describe.skipIf(!hasBetterleaks)("scanFiles", () => {
  let tmpDir = "";
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "ssl-scan-"));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("finds a fixture secret in a file under a temp dir", async () => {
    const file = join(tmpDir, "fixture.env");
    writeFileSync(file, `OPENAI_KEY=${FIXTURE_KEY_B}\n`);
    const r = await scanFiles(tmpDir);
    expect(r.length).toBeGreaterThan(0);
    const first = r[0];
    expect(first).toBeDefined();
    const f = first as BetterleaksFinding;
    expect(f.source).toBe("file");
    expect(f.file.endsWith("fixture.env")).toBe(true);
    expect((f as unknown as Record<string, unknown>).secret).toBeUndefined();
  });

  it("returns [] for a dir with no findings", async () => {
    const file = join(tmpDir, "plain.txt");
    writeFileSync(file, "no secrets in this prose at all, just regular text only here.\n");
    const r = await scanFiles(tmpDir);
    expect(r).toEqual([]);
  });
});

describe.skipIf(!hasBetterleaks)("scanEnv", () => {
  it("returns findings sourced from env (no throw)", async () => {
    const key = "_STOP_SECRETS_LEAKS_TEST_KEY_";
    process.env[key] = FIXTURE_KEY_C;
    try {
      const r = await scanEnv();
      expect(Array.isArray(r)).toBe(true);
      for (const f of r) {
        expect(f.source).toBe("env");
        expect(f.file).toBe("(env)");
        expect((f as unknown as Record<string, unknown>).secret).toBeUndefined();
      }
    } finally {
      delete process.env[key];
    }
  });
});
