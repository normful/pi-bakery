import { relative } from "node:path";
import type { FindingRegistry } from "./registry.js";

export function buildGuidance(registry: FindingRegistry, cwd: string): string | undefined {
  const all = registry.getAll();
  if (all.length === 0) return undefined;

  const lines: string[] = [
    "# Secrets Redaction",
    "",
    "Secrets are auto-redacted from env vars, file reads, shell command outputs.",
    "🔒 $S_NN replaces secrets. NOT the real value.",
  ];

  const fileFindings = all.filter((f) => f.source === "file" && f.file && f.file !== "(env)");
  if (fileFindings.length > 0) {
    const relPaths = new Set<string>();
    for (const f of fileFindings) {
      relPaths.add(relative(cwd, f.file));
    }
    if (relPaths.size > 0) {
      lines.push(
        "",
        "DO NOT read or view (by echo, print, etc) the following files, which contain secrets:",
      );
      for (const p of [...relPaths].sort()) {
        lines.push(`- ${p}`);
      }
    }
  }

  return lines.join("\n");
}
