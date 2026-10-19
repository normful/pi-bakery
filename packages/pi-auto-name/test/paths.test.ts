import { describe, it, expect } from "vitest";
import { mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { samePath } from "../src/paths.js";

/** True when realpathSync.native folds case on the volume holding this checkout. */
function caseInsensitiveFs(): boolean {
  try {
    return realpathSync.native(process.cwd().toUpperCase()) === realpathSync.native(process.cwd());
  } catch {
    return false;
  }
}

/** Run `check` against a fresh temp directory, removed afterwards. */
function withTempDir(check: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "pi-auto-name-paths-"));
  try {
    check(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("samePath", () => {
  it("is false when either side is absent or empty", () => {
    expect(samePath(undefined, "/tmp")).toBe(false);
    expect(samePath("/tmp", undefined)).toBe(false);
    expect(samePath(undefined, undefined)).toBe(false);
    expect(samePath("", "/tmp")).toBe(false);
    expect(samePath("/tmp", "")).toBe(false);
  });

  it("accepts identical spellings without consulting the filesystem", () => {
    expect(samePath("/nonexistent-xyz/a", "/nonexistent-xyz/a")).toBe(true);
  });

  it("ignores a trailing separator", () => {
    withTempDir((dir) => {
      expect(samePath(dir, `${dir}/`)).toBe(true);
    });
  });

  it("matches a relative and an absolute spelling of one directory", () => {
    const absolute = process.cwd();
    expect(samePath(".", absolute)).toBe(true);
    expect(samePath(absolute, ".")).toBe(true);
  });

  it.runIf(process.platform !== "win32")("resolves a symlinked spelling to its target", () => {
    withTempDir((dir) => {
      const link = `${dir}-link`;
      try {
        symlinkSync(dir, link);
        expect(samePath(link, dir)).toBe(true);
      } finally {
        rmSync(link, { force: true });
      }
    });
  });

  it("falls back to path resolution when a path does not exist", () => {
    expect(samePath("/nonexistent-xyz/a", "/nonexistent-xyz/a/")).toBe(true);
    expect(samePath("/nonexistent-xyz/a", "/nonexistent-xyz/b")).toBe(false);
  });

  it.runIf(process.platform !== "win32")("rethrows when a path cannot be resolved", () => {
    withTempDir((dir) => {
      const ping = join(dir, "ping");
      const pong = join(dir, "pong");
      symlinkSync(pong, ping);
      symlinkSync(ping, pong); // symlink loop → ELOOP, not ENOENT
      expect(() => samePath(ping, dir)).toThrow();
    });
  });

  it("expands a leading ~ before comparing", () => {
    expect(samePath("~", homedir())).toBe(true);
    expect(samePath("~/", homedir())).toBe(true);
  });

  it.skipIf(!caseInsensitiveFs())("folds case when the volume does not distinguish it", () => {
    withTempDir((dir) => {
      expect(samePath(dir.toUpperCase(), dir)).toBe(true);
    });
  });

  it.runIf(process.platform === "darwin")("resolves /tmp to its physical spelling", () => {
    expect(samePath("/tmp", "/private/tmp")).toBe(true);
  });
});
