import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScanCache } from "../src/cache.js";
import type { BetterleaksFinding } from "../src/types.js";

let tmpDir = "";

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ssl-cache-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeFixture(name: string, body: string): string {
  const p = join(tmpDir, name);
  writeFileSync(p, body);
  return p;
}

function finding(): BetterleaksFinding {
  return {
    source: "file",
    ruleID: "r",
    description: "d",
    file: "",
    entropy: 0,
    fingerprint: "fp",
    startLine: 1,
    endLine: 1,
    startColumn: 1,
    endColumn: 4,
  };
}

describe("ScanCache — fresh tracking", () => {
  it("isFresh is false when path never seen", () => {
    const cache = new ScanCache();
    expect(cache.isFresh("/nope/never/seen")).toBe(false);
  });

  it("isFresh becomes true after set, when file unchanged", () => {
    const cache = new ScanCache();
    const p = writeFixture("a.txt", "hello\n");
    cache.set(p, [finding()]);
    expect(cache.isFresh(p)).toBe(true);
  });

  it("get returns findings after set", () => {
    const cache = new ScanCache();
    const p = writeFixture("a.txt", "hello\n");
    cache.set(p, [finding()]);
    const e = cache.get(p);
    expect(e).toBeDefined();
    expect(e?.findings.length).toBe(1);
  });

  it("isFresh goes false after content rewrite (size change)", () => {
    const cache = new ScanCache();
    const p = writeFixture("a.txt", "abc");
    cache.set(p, [finding()]);
    expect(cache.isFresh(p)).toBe(true);
    writeFileSync(p, "abcd");
    expect(cache.isFresh(p)).toBe(false);
  });

  it("isFresh goes false after mtime-only change (size preserved)", () => {
    const cache = new ScanCache();
    const p = writeFixture("a.txt", "abc");
    cache.set(p, [finding()]);
    expect(cache.isFresh(p)).toBe(true);
    // Bump mtime forward without changing size
    const future = (Date.now() + 60_000) / 1000;
    utimesSync(p, future, future);
    expect(cache.isFresh(p)).toBe(false);
  });

  it("invalidate drops a single entry", () => {
    const cache = new ScanCache();
    const p = writeFixture("a.txt", "abc");
    cache.set(p, [finding()]);
    cache.invalidate(p);
    expect(cache.isFresh(p)).toBe(false);
    expect(cache.get(p)).toBeUndefined();
  });

  it("clear drops all entries", () => {
    const cache = new ScanCache();
    const p1 = writeFixture("a.txt", "abc");
    const p2 = writeFixture("b.txt", "xyz");
    cache.set(p1, [finding()]);
    cache.set(p2, [finding()]);
    cache.clear();
    expect(cache.get(p1)).toBeUndefined();
    expect(cache.get(p2)).toBeUndefined();
  });

  it("set no-ops if the file is missing (does not throw, no entry stored)", () => {
    const cache = new ScanCache();
    const missing = join(tmpDir, "missing.txt");
    cache.set(missing, [finding()]);
    expect(cache.get(missing)).toBeUndefined();
    expect(cache.isFresh(missing)).toBe(false);
  });
});

describe("ScanCache — withLock concurrency", () => {
  it("two concurrent callers for the same path share one in-flight promise", async () => {
    const cache = new ScanCache();
    const p = writeFixture("a.txt", "abc");
    let runs = 0;
    let release!: () => void;
    const blocker = new Promise<void>((res) => {
      release = res;
    });
    const fn = async () => {
      runs += 1;
      await blocker;
      return "done";
    };
    const a = cache.withLock(p, fn);
    const b = cache.withLock(p, fn); // should share inflight promise
    // Allow microtask queue to flush
    await Promise.resolve();
    await Promise.resolve();
    expect(runs).toBe(1);
    release();
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toBe("done");
    expect(rb).toBe("done");
    expect(runs).toBe(1);
  });

  it("different paths do not share locks", async () => {
    const cache = new ScanCache();
    const p1 = writeFixture("a.txt", "abc");
    const p2 = writeFixture("b.txt", "xyz");
    let runs = 0;
    const fn = async () => {
      const myRun = ++runs;
      await new Promise((r) => setTimeout(r, 10));
      return myRun;
    };
    const [r1, r2] = await Promise.all([cache.withLock(p1, fn), cache.withLock(p2, fn)]);
    expect(runs).toBe(2);
    // Both should resolve with their own captured run id (concurrent).
    expect(new Set([r1, r2])).toEqual(new Set([1, 2]));
  });

  it("a fresh lock can be acquired after the previous one releases", async () => {
    const cache = new ScanCache();
    const p = writeFixture("a.txt", "abc");
    let runs = 0;
    const fn = async () => {
      runs += 1;
      return runs;
    };
    const a = await cache.withLock(p, fn);
    const b = await cache.withLock(p, fn);
    expect(a).toBe(1);
    expect(b).toBe(2);
  });
});
