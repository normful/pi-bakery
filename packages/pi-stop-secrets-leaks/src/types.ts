// stop-secrets-leaks: metadata-only findings; never store live secret values.
// Betterleaks uses --redact=100 for every scan; this module only holds positions,
// rule ids, and fingerprints — not the secret itself.

export interface BetterleaksFinding {
  source: "file" | "env" | "text";
  ruleID: string;
  description: string;
  /** Absolute path for file findings; "(env)" for env; "" for text. */
  file: string;
  entropy: number;
  fingerprint: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  /** Env var name when parseable from redacted Match (env scans only). */
  envName?: string;
  /** Redacted Match from betterleaks (secrets already REDACTED). Safe metadata. */
  matchRedacted?: string;
}

export interface CacheEntry {
  mtimeMs: number;
  size: number;
  findings: BetterleaksFinding[];
}

/** Wire format from `betterleaks --report-format=json`. PascalCase.
 *  Field `Secret` is intentionally absent from the result of parseFindings. */
export interface BetterleaksRawFinding {
  RuleID?: string;
  Description?: string;
  Secret?: string;
  Match?: string;
  File?: string;
  Entropy?: number;
  Fingerprint?: string;
  StartLine?: number;
  EndLine?: number;
  StartColumn?: number;
  EndColumn?: number;
}

export interface RedactResult {
  text: string;
  hits: number;
}
