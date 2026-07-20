import { describe, expect, it } from "vitest";
import { buildGuidance } from "../src/guidance.js";
import { FindingRegistry } from "../src/registry.js";
import type { BetterleaksFinding } from "../src/types.js";

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
  it("returns undefined (or empty) when no findings", () => {
    const reg = new FindingRegistry();
    const g = buildGuidance(reg);
    expect(g == null || g === "").toBe(true);
  });
});

describe("buildGuidance — file-only findings", () => {
  it("still returns guidance", () => {
    const reg = new FindingRegistry();
    reg.addFindings([finding({ source: "file", fingerprint: "f1" })]);
    const g = buildGuidance(reg) ?? "";
    expect(g.length).toBeGreaterThan(0);
    // Header should reference the extension name (distinct from secret-firewall).
    expect(g).toContain("Secrets Redaction");
    // No env-list line because no env findings.
    expect(g).not.toContain("Currently available secret env vars:");
  });
});

describe("buildGuidance — env findings", () => {
  it("does not include env list (removed for conciseness)", () => {
    const reg = new FindingRegistry();
    reg.addFindings([
      finding({ source: "env", fingerprint: "e1", envName: "FOO_TOKEN" }),
      finding({ source: "env", fingerprint: "e2", envName: "BAR_KEY" }),
    ]);
    const g = buildGuidance(reg) ?? "";
    expect(g).not.toContain("Currently available secret env vars:");
    expect(g).not.toContain("$FOO_TOKEN");
  });

  it("does not embed any long raw secret-looking tokens", () => {
    const reg = new FindingRegistry();
    reg.addFindings([
      finding({
        source: "env",
        fingerprint: "e1",
        envName: "REAL_LOOKING_TOKEN",
      }),
    ]);
    const g = buildGuidance(reg) ?? "";
    // Should NOT contain common long-token patterns.
    expect(g).not.toMatch(/\b[A-Za-z0-9_-]{40,}\b/);
  });
});

describe("buildGuidance — placeholder explanation", () => {
  it("describes the placeholder format", () => {
    const reg = new FindingRegistry();
    reg.addFindings([finding({ fingerprint: "f1" })]);
    const g = buildGuidance(reg) ?? "";
    expect(g).toContain("$S_NN");
    expect(g).toContain("🔒");
  });

  it("states placeholders are not real values", () => {
    const reg = new FindingRegistry();
    reg.addFindings([finding({ fingerprint: "f1" })]);
    const g = buildGuidance(reg) ?? "";
    expect(g).toMatch(/NOT\s+the\s+real/i);
  });
});

describe("buildGuidance — do not echo secrets", () => {
  it("warns against outputting secrets", () => {
    const reg = new FindingRegistry();
    reg.addFindings([finding({ fingerprint: "f1" })]);
    const g = buildGuidance(reg) ?? "";
    expect(g).toMatch(/never\s+output|re-redacted/i);
  });
});
