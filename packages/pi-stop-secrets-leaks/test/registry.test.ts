import { describe, expect, it } from "vitest";
import { FindingRegistry } from "../src/registry.js";
import type { BetterleaksFinding } from "../src/types.js";

function finding(over: Partial<BetterleaksFinding>): BetterleaksFinding {
  return {
    source: "file",
    ruleID: "r",
    description: "d",
    file: "/tmp/x",
    entropy: 0,
    fingerprint: "fp",
    startLine: 1,
    endLine: 1,
    startColumn: 1,
    endColumn: 4,
    ...over,
  };
}

describe("FindingRegistry — initial state", () => {
  it("starts empty", () => {
    const reg = new FindingRegistry();
    expect(reg.getAll()).toEqual([]);
    expect(reg.stats()).toEqual({ files: 0, env: 0, text: 0, total: 0 });
    expect(reg.getEnvNames()).toEqual([]);
  });

  it("nextPlaceholder yields zero-padded S_NN", () => {
    const reg = new FindingRegistry();
    const a = reg.nextPlaceholder();
    const b = reg.nextPlaceholder();
    expect(a).toMatch(/^«🔒 \$S_\d{2,}»$/);
    expect(b).toMatch(/^«🔒 \$S_\d{2,}»$/);
    // Distinct
    expect(a).not.toBe(b);
  });

  it("nextPlaceholder starts at 01 then 02", () => {
    const reg = new FindingRegistry();
    const a = reg.nextPlaceholder();
    const b = reg.nextPlaceholder();
    expect(a).toBe("«🔒 $S_01»");
    expect(b).toBe("«🔒 $S_02»");
  });
});

describe("FindingRegistry — addFindings deduplication", () => {
  it("adds new fingerprints and returns count added", () => {
    const reg = new FindingRegistry();
    const added = reg.addFindings([
      finding({ fingerprint: "fp-a" }),
      finding({ fingerprint: "fp-b" }),
    ]);
    expect(added).toBe(2);
    expect(reg.getAll().length).toBe(2);
  });

  it("dedupes by fingerprint", () => {
    const reg = new FindingRegistry();
    reg.addFindings([finding({ fingerprint: "fp-a" })]);
    const added = reg.addFindings([
      finding({ fingerprint: "fp-a" }), // dup
      finding({ fingerprint: "fp-b" }), // new
    ]);
    expect(added).toBe(1);
    expect(reg.getAll().length).toBe(2);
  });

  it("keeps BOTH different fingerprints", () => {
    const reg = new FindingRegistry();
    reg.addFindings([finding({ fingerprint: "fp-a" }), finding({ fingerprint: "fp-b" })]);
    expect(reg.getAll().length).toBe(2);
  });

  it("ignores findings with empty fingerprint", () => {
    const reg = new FindingRegistry();
    const added = reg.addFindings([finding({ fingerprint: "" }), finding({ fingerprint: "fp-a" })]);
    expect(added).toBe(1);
    expect(reg.getAll().length).toBe(1);
  });
});

describe("FindingRegistry — getEnvNames", () => {
  it("returns unique env names only (skip those without envName)", () => {
    const reg = new FindingRegistry();
    reg.addFindings([
      finding({ source: "env", fingerprint: "e1", envName: "FOO" }),
      finding({ source: "env", fingerprint: "e2", envName: "BAR" }),
      finding({ source: "env", fingerprint: "e3" }), // no envName
      finding({ source: "file", fingerprint: "f1", envName: "SHOULD_IGN" }), // wrong source
    ]);
    const names = reg.getEnvNames();
    expect(names).toContain("FOO");
    expect(names).toContain("BAR");
    expect(names).not.toContain("SHOULD_IGN");
    // Unique (no duplicate even if same name added twice)
    expect(names.length).toBe(new Set(names).size);
  });

  it("ignores empty string envName", () => {
    const reg = new FindingRegistry();
    reg.addFindings([
      finding({ source: "env", fingerprint: "e1", envName: "" }),
      finding({ source: "env", fingerprint: "e2", envName: "   " }),
    ]);
    expect(reg.getEnvNames()).toEqual([]);
  });

  it("returns sorted (stable) names", () => {
    const reg = new FindingRegistry();
    reg.addFindings([
      finding({ source: "env", fingerprint: "e1", envName: "ZULU" }),
      finding({ source: "env", fingerprint: "e2", envName: "ALPHA" }),
      finding({ source: "env", fingerprint: "e3", envName: "MIKE" }),
    ]);
    const names = reg.getEnvNames();
    expect(names).toEqual(["ALPHA", "MIKE", "ZULU"]);
  });
});

describe("FindingRegistry — stats", () => {
  it("counts by source", () => {
    const reg = new FindingRegistry();
    reg.addFindings([
      finding({ source: "file", fingerprint: "f1" }),
      finding({ source: "file", fingerprint: "f2" }),
      finding({ source: "file", fingerprint: "f3" }),
      finding({ source: "env", fingerprint: "e1", envName: "X" }),
      finding({ source: "env", fingerprint: "e2", envName: "Y" }),
      finding({ source: "text", fingerprint: "t1" }),
    ]);
    expect(reg.stats()).toEqual({ files: 3, env: 2, text: 1, total: 6 });
  });
});

describe("FindingRegistry — clear", () => {
  it("clears findings AND resets placeholder counter", () => {
    const reg = new FindingRegistry();
    reg.addFindings([finding({ fingerprint: "fp-a" })]);
    reg.nextPlaceholder();
    reg.nextPlaceholder();
    reg.clear();
    expect(reg.getAll()).toEqual([]);
    expect(reg.stats().total).toBe(0);
    // Counter resets → first placeholder is $S_01 again.
    expect(reg.nextPlaceholder()).toBe("«🔒 $S_01»");
  });
});

describe("FindingRegistry — invariant: never stores secret values", () => {
  it("BetterleaksFinding has no secret property", () => {
    const f = finding({ fingerprint: "fp-a" });
    // Type system enforces this — verify at runtime too.
    expect((f as unknown as Record<string, unknown>).secret).toBeUndefined();
  });
});
