// stop-secrets-leaks: metadata-only registry. Holds fingerprints + positions
// from betterleaks findings. NEVER stores secret values.

import type { BetterleaksFinding } from "./types.js";

export class FindingRegistry {
  private byFingerprint = new Map<string, BetterleaksFinding>();
  private placeholderSeq = 0;

  /**
   * Add findings to the registry, deduplicated by fingerprint.
   * Returns the count of NEW findings that were accepted.
   */
  addFindings(findings: BetterleaksFinding[]): number {
    let added = 0;
    for (const f of findings) {
      if (!f.fingerprint) continue;
      if (this.byFingerprint.has(f.fingerprint)) continue;
      this.byFingerprint.set(f.fingerprint, f);
      added += 1;
    }
    return added;
  }

  getAll(): BetterleaksFinding[] {
    return [...this.byFingerprint.values()];
  }

  /** Unique sorted env var names from env-sourced findings. */
  getEnvNames(): string[] {
    const names = new Set<string>();
    for (const f of this.byFingerprint.values()) {
      if (f.source !== "env") continue;
      if (typeof f.envName !== "string") continue;
      const trimmed = f.envName.trim();
      if (trimmed.length === 0) continue;
      names.add(trimmed);
    }
    return [...names].sort();
  }

  /** Generate the next opaque placeholder. Counts up across the session. */
  nextPlaceholder(): string {
    this.placeholderSeq += 1;
    return `«🔒 $S_${String(this.placeholderSeq).padStart(2, "0")}»`;
  }

  /** Clear findings AND reset the placeholder counter (session reset). */
  clear(): void {
    this.byFingerprint.clear();
    this.placeholderSeq = 0;
  }

  stats(): { files: number; env: number; text: number; total: number } {
    let files = 0;
    let env = 0;
    let text = 0;
    for (const f of this.byFingerprint.values()) {
      if (f.source === "file") files += 1;
      else if (f.source === "env") env += 1;
      else if (f.source === "text") text += 1;
    }
    return { files, env, text, total: files + env + text };
  }
}
