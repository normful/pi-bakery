import { describe, expect, it } from "vitest";
import { buildGuidance } from "../src/guidance.js";
import { FindingRegistry } from "../src/registry.js";
import type { BetterleaksFinding } from "../src/types.js";

const CWD = "/home/user/project";

function finding(over: Partial<BetterleaksFinding>): BetterleaksFinding {
  return {
    source: "file",
    ruleID: "r",
    description: "d",
    file: "/x",
    entropy: 0,
    fingerprint: "fp",
    startLine: 1,
    endLine: 1,
    startColumn: 1,
    endColumn: 2,
    ...over,
  };
}

describe("buildGuidance — empty registry", () => {
  it("returns undefined when no findings", () => {
    const reg = new FindingRegistry();
    const g = buildGuidance(reg, CWD);
    expect(g).toBeUndefined();
  });
});

describe("buildGuidance — static text", () => {
  it("includes the auto-redaction description", () => {
    const reg = new FindingRegistry();
    reg.addFindings([finding({ fingerprint: "f1" })]);
    const g = buildGuidance(reg, CWD) ?? "";
    expect(g).toContain("auto-redacted from env vars, file reads, shell command outputs");
  });

  it("uses the placeholder format with emoji", () => {
    const reg = new FindingRegistry();
    reg.addFindings([finding({ fingerprint: "f1" })]);
    const g = buildGuidance(reg, CWD) ?? "";
    expect(g).toContain("🔒 $S_NN");
  });

  it("states placeholders are not real values", () => {
    const reg = new FindingRegistry();
    reg.addFindings([finding({ fingerprint: "f1" })]);
    const g = buildGuidance(reg, CWD) ?? "";
    expect(g).toMatch(/NOT\s+the\s+real/i);
  });
});

describe("buildGuidance — file-sourced findings", () => {
  it("produces a relative path in the guidance", () => {
    const reg = new FindingRegistry();
    reg.addFindings([
      finding({ source: "file", file: "/home/user/project/.env", fingerprint: "f1" }),
    ]);
    const g = buildGuidance(reg, CWD) ?? "";
    expect(g).toContain(".env");
    expect(g).not.toContain("/home/user/project/.env");
  });

  it("includes the DO NOT read directive", () => {
    const reg = new FindingRegistry();
    reg.addFindings([
      finding({ source: "file", file: "/home/user/project/.env", fingerprint: "f1" }),
    ]);
    const g = buildGuidance(reg, CWD) ?? "";
    expect(g).toContain("DO NOT read");
  });

  it("does not include a file list for env-only findings", () => {
    const reg = new FindingRegistry();
    reg.addFindings([finding({ source: "env", fingerprint: "e1", envName: "FOO_TOKEN" })]);
    const g = buildGuidance(reg, CWD) ?? "";
    expect(g).not.toContain("DO NOT read");
    expect(g).not.toContain("- ");
  });
});

describe("buildGuidance — deduplication", () => {
  it("deduplicates paths when multiple findings reference the same file", () => {
    const reg = new FindingRegistry();
    reg.addFindings([
      finding({ source: "file", file: "/home/user/project/.env", fingerprint: "f1" }),
      finding({ source: "file", file: "/home/user/project/.env", fingerprint: "f2" }),
    ]);
    const g = buildGuidance(reg, CWD) ?? "";
    const occurrences = (g.match(/- \.env/g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});

describe("buildGuidance — absolute to relative path conversion", () => {
  it("converts absolute registry paths to cwd-relative paths", () => {
    const reg = new FindingRegistry();
    reg.addFindings([
      finding({ source: "file", file: "/home/user/project/config.py", fingerprint: "f1" }),
    ]);
    const g = buildGuidance(reg, CWD) ?? "";
    expect(g).toContain("config.py");
  });
});
