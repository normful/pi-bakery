// stop-secrets-leaks: pure helpers (no ExtensionAPI, no betterleaks).
// These helpers classify tools and extract paths from tool inputs.

const READ_SUBSTR = ["read", "cat", "view", "show", "dump"];
const WRITE_SUBSTR = ["write", "edit", "overwrite", "save", "create_file"];
// Tools that surface output which may contain secrets worth re-scanning.
const REDACT_SUBSTR = [
  ...READ_SUBSTR,
  "bash",
  "sh",
  "exec",
  "run",
  "shell",
  "command",
  "grep",
  "search",
  "find",
  "lookup",
];

function includesAny(name: string, parts: string[]): boolean {
  const n = name.toLowerCase();
  for (const p of parts) {
    if (n.includes(p)) return true;
  }
  return false;
}

export function isReadLikeTool(toolName: string): boolean {
  if (!toolName) return false;
  return includesAny(toolName, READ_SUBSTR);
}

export function isWriteLikeTool(toolName: string): boolean {
  if (!toolName) return false;
  return includesAny(toolName, WRITE_SUBSTR);
}

export function shouldRedactTool(toolName: string): boolean {
  if (!toolName) return false;
  return includesAny(toolName, REDACT_SUBSTR);
}

export function extractPathFromInput(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const rec = input as Record<string, unknown>;
  for (const key of ["path", "file", "filename"]) {
    const v = rec[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

const MIN_BOTHER_LENGTH = 5;

export function shouldBother(text: string): boolean {
  if (!text) return false;
  if (text.length < MIN_BOTHER_LENGTH) return false;
  // Skip pure whitespace
  if (text.trim().length === 0) return false;
  return true;
}
