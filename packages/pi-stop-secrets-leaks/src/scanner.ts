// stop-secrets-leaks: betterleaks integration. Spawns the `betterleaks` CLI,
// parses JSON findings, and converts them into metadata-only BetterleaksFinding
// records. NEVER stores the value of the secret — only positions + rule IDs.
//
// All finding-eligible invocations of betterleaks MUST include --redact=100 so
// `Secret` and `Match` come back as "REDACTED". env/text data is fed only via
// stdin of the child process — not echoed, logged, or stored by us.

import { spawn } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import type { BetterleaksFinding, BetterleaksRawFinding } from "./types.js";

/** Args appended to every betterleaks invocation that emits findings. */
// These are mutable so stop-secrets-leaks-config can update the timeout.
let _cliTimeoutSec = 10;
let _subprocessTimeoutMs = 12_000;

function buildScanArgs(): string[] {
  return [
    "--report-format",
    "json",
    "--report-path",
    "-",
    "--no-banner",
    "--redact=100",
    "--max-target-megabytes",
    "1",
    "--timeout",
    String(_cliTimeoutSec),
  ];
}

/**
 * Update the scan timeout. CLI gets `cliTimeoutSec`, subprocess gets
 * `cliTimeoutSec + 2` seconds. Returns the new settings for confirmation.
 */
export function configureScanTimeout(cliTimeoutSec: number): {
  cliTimeoutSec: number;
  subprocessTimeoutMs: number;
} {
  const sec = Math.max(1, Math.round(cliTimeoutSec));
  _cliTimeoutSec = sec;
  _subprocessTimeoutMs = (sec + 2) * 1_000;
  return { cliTimeoutSec: _cliTimeoutSec, subprocessTimeoutMs: _subprocessTimeoutMs };
}

/** Extract the env var name from a redacted Match string like `FOO=REDACTED`. */
export function parseEnvNameFromMatch(match: string | undefined): string | undefined {
  if (!match) return undefined;
  const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(match.trim());
  return m?.[1];
}

/** Convert PascalCase raw rows to camelCase BetterleaksFinding entries.
 *  Crucially, row.Secret is NEVER copied to the result. */
export function parseFindings(
  raw: BetterleaksRawFinding[],
  source: BetterleaksFinding["source"],
): BetterleaksFinding[] {
  return raw.map((row) => {
    const ruleID = row.RuleID ?? "";
    const fileRaw = row.File ?? "";
    const startLine = row.StartLine ?? 0;
    const fingerprint =
      row.Fingerprint && row.Fingerprint.length > 0
        ? row.Fingerprint
        : `${fileRaw || "<text>"}:${ruleID}:${startLine}`;

    const fileField: string =
      source === "env"
        ? "(env)"
        : source === "file" && fileRaw && !isAbsolute(fileRaw)
          ? resolve(fileRaw)
          : fileRaw;

    const finding: BetterleaksFinding = {
      source,
      ruleID,
      description: row.Description ?? "",
      file: fileField,
      entropy: row.Entropy ?? 0,
      fingerprint,
      startLine,
      endLine: row.EndLine ?? startLine,
      startColumn: row.StartColumn ?? 0,
      endColumn: row.EndColumn ?? 0,
      matchRedacted: row.Match,
    };

    if (source === "env") {
      const envName = parseEnvNameFromMatch(row.Match);
      if (envName) finding.envName = envName;
    }

    return finding;
  });
}

/** Check whether `betterleaks` is on PATH and executable. */
export async function isBetterleaksAvailable(): Promise<boolean> {
  try {
    const result = await runProcess("betterleaks", ["version"], {}, 5_000);
    return result.code === 0;
  } catch {
    return false;
  }
}

interface SpawnOptions {
  stdin?: string;
  cwd?: string;
  signal?: AbortSignal;
}

interface ProcessResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

function runProcess(
  cmd: string,
  args: string[],
  options: SpawnOptions,
  timeoutMs?: number,
): Promise<ProcessResult> {
  const effectiveTimeout = timeoutMs ?? _subprocessTimeoutMs;
  return new Promise((resolveProm, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill("SIGKILL");
      } catch {
        /* already gone */
      }
      reject(new Error(`betterleaks timed out after ${effectiveTimeout}ms`));
    }, effectiveTimeout);

    const proc = spawn(cmd, args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      signal: options.signal,
    });

    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      if (!timedOut) reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return; // already rejected
      resolveProm({ stdout, stderr, code });
    });

    if (typeof options.stdin === "string") {
      try {
        proc.stdin?.write(options.stdin);
      } finally {
        proc.stdin?.end();
      }
    } else {
      proc.stdin?.end();
    }
  });
}

/**
 * Run betterleaks with the given args and parse stdout as JSON findings.
 * Returns [] when:
 *  - exit code is 0 or 1 (both are "OK"; 0 = no leaks, 1 = leaks found)
 *  - stdout is empty / unparseable
 *  - non-zero non-one exit (caller is told but we don't throw)
 *
 * The `--redact=100` invariant lives in FINDING_SCAN_ARGS. Callers using
 * `runBetterleaks` directly for non-finding commands (e.g. `version`) are
 * responsible for not emitting raw secrets.
 */
export async function runBetterleaks(
  args: string[],
  options: SpawnOptions = {},
): Promise<BetterleaksRawFinding[]> {
  const result = await runProcess("betterleaks", [...args, ...buildScanArgs()], options);
  if (result.code !== 0 && result.code !== 1) {
    return [];
  }
  const trimmed = result.stdout.trim();
  if (!trimmed) return [];
  if (trimmed === "null") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed as BetterleaksRawFinding[];
}

/** Scan a directory (or specific files) for secrets. */
export async function scanFiles(cwd: string, targets?: string[]): Promise<BetterleaksFinding[]> {
  const paths = targets && targets.length > 0 ? targets : [cwd];
  const raw = await runBetterleaks(["dir", ...paths], { cwd });
  return parseFindings(raw, "file");
}

/**
 * Scan the current process environment for secrets. Reads `process.env` and
 * pipes a `KEY=value` snapshot to betterleaks's stdin — value is NOT logged,
 * NOT stored in our process, and NOT asserted in any test fixture.
 */
export async function scanEnv(signal?: AbortSignal): Promise<BetterleaksFinding[]> {
  const stdin = Object.entries(process.env)
    .filter((e): e is [string, string] => typeof e[1] === "string")
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const raw = await runBetterleaks(["stdin"], { stdin, signal });
  return parseFindings(raw, "env");
}

/** Scan a free-form text blob for secrets. */
export async function scanText(text: string, signal?: AbortSignal): Promise<BetterleaksFinding[]> {
  if (!text) return [];
  const raw = await runBetterleaks(["stdin"], { stdin: text, signal });
  return parseFindings(raw, "text");
}
