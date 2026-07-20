// stop-secrets-leaks: per-file scan cache. Tracks mtime/size so we can
// short-circuit re-scans, and serializes concurrent scans of the same path.

import { statSync } from "node:fs";
import { resolve } from "node:path";
import type { BetterleaksFinding, CacheEntry } from "./types.js";

interface FileMeta {
  mtimeMs: number;
  size: number;
}

export class ScanCache {
  private entries = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<unknown>>();

  private abs(path: string): string {
    return resolve(path);
  }

  private getFileMeta(path: string): FileMeta | null {
    try {
      const s = statSync(path);
      return { mtimeMs: s.mtimeMs, size: s.size };
    } catch {
      return null;
    }
  }

  isFresh(path: string): boolean {
    const key = this.abs(path);
    const ent = this.entries.get(key);
    if (!ent) return false;
    const meta = this.getFileMeta(key);
    if (!meta) return false;
    return meta.mtimeMs === ent.mtimeMs && meta.size === ent.size;
  }

  get(path: string): CacheEntry | undefined {
    return this.entries.get(this.abs(path));
  }

  /**
   * Cache findings for a path. No-ops if the file is missing.
   */
  set(path: string, findings: BetterleaksFinding[]): void {
    const key = this.abs(path);
    const meta = this.getFileMeta(key);
    if (!meta) return;
    this.entries.set(key, { mtimeMs: meta.mtimeMs, size: meta.size, findings });
  }

  invalidate(path: string): void {
    this.entries.delete(this.abs(path));
  }

  clear(): void {
    this.entries.clear();
    this.inflight.clear();
  }

  /**
   * Serialize calls for the same path. Concurrent callers share one in-flight
   * promise; later callers receive the same resolution.
   */
  async withLock<T>(path: string, fn: () => Promise<T>): Promise<T> {
    const key = this.abs(path);
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;
    const p = (async () => {
      try {
        return await fn();
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, p);
    return p;
  }
}
