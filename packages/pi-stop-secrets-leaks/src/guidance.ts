// stop-secrets-leaks: build the system-prompt guidance injected at
// before_agent_start. Mirrors the tone of secret-firewall but uses the
// $S_NN placeholder family and is distinct in its heading so the two
// extensions can coexist without confusing the LLM.

import type { FindingRegistry } from "./registry.js";

export function buildGuidance(registry: FindingRegistry): string | undefined {
  const all = registry.getAll();
  if (all.length === 0) return undefined;

  const lines: string[] = [
    "# Secrets Redaction",
    "",
    "\u00AB\u{1F512} $S_NN\u00BB replaces secrets. NOT the real value.",
    "Use `$VAR` in bash for env secrets; re-read files for file secrets.",
    "Never output a secret \u2014 re-redacted if you do.",
  ];
  return lines.join("\n");
}
