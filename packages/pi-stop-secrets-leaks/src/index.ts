// stop-secrets-leaks: extension entry point. Wires up session_start,
// before_agent_start, and tool_result to the pure helpers in scanner.ts /
// redact.ts. Scanner deps are injected so tests can swap in fakes.

import { resolve } from "node:path";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import type {
  BeforeAgentStartEvent,
  ExtensionAPI,
  ExtensionContext,
  ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
import { ScanCache } from "./cache.js";
import { buildGuidance } from "./guidance.js";
import { redactByFindings } from "./redact.js";
import { FindingRegistry } from "./registry.js";
import {
  configureScanTimeout as defaultConfigureScanTimeout,
  isBetterleaksAvailable as defaultIsAvailable,
  scanEnv as defaultScanEnv,
  scanFiles as defaultScanFiles,
  scanText as defaultScanText,
} from "./scanner.js";
import {
  extractPathFromInput,
  isReadLikeTool,
  isWriteLikeTool,
  shouldBother,
  shouldRedactTool,
} from "./tools.js";
import type { BetterleaksFinding } from "./types.js";

type ContentBlock = TextContent | ImageContent;

export type StopSecretsDeps = {
  isBetterleaksAvailable: () => Promise<boolean>;
  scanFiles: (cwd: string, targets?: string[]) => Promise<BetterleaksFinding[]>;
  scanEnv: (signal?: AbortSignal) => Promise<BetterleaksFinding[]>;
  scanText: (text: string, signal?: AbortSignal) => Promise<BetterleaksFinding[]>;
  configureScanTimeout: (sec: number) => {
    cliTimeoutSec: number;
    subprocessTimeoutMs: number;
  };
};

export function createStopSecretsLeaks(deps: StopSecretsDeps) {
  return function register(pi: ExtensionAPI) {
    let enabled = true;
    let binaryOk = false;
    let scanPromise: Promise<void> | null = null;
    let _cliTimeoutSec = 10;
    const registry = new FindingRegistry();
    const cache = new ScanCache();
    const stats = { redactedHits: 0 };

    async function fullScan(ctx: ExtensionContext): Promise<void> {
      registry.clear();
      cache.clear();
      try {
        binaryOk = await deps.isBetterleaksAvailable();
        if (!binaryOk) {
          enabled = false;
          try {
            ctx.ui.notify(
              "stop-secrets-leaks: betterleaks not found; redaction disabled",
              "warning",
            );
          } catch {
            /* no-op in non-interactive modes */
          }
          return;
        }
        enabled = true;
        const fileFindings = await deps.scanFiles(ctx.cwd);
        const envFindings = await deps.scanEnv(ctx.signal);
        registry.addFindings([...fileFindings, ...envFindings]);
        // Prime cache with the file findings we just observed.
        const byFile = new Map<string, BetterleaksFinding[]>();
        for (const f of fileFindings) {
          if (!f.file || f.file === "(env)") continue;
          const list = byFile.get(f.file) ?? [];
          list.push(f);
          byFile.set(f.file, list);
        }
        for (const [path, findings] of byFile) cache.set(path, findings);
      } catch (err) {
        binaryOk = false;
        enabled = false;
        try {
          ctx.ui.notify(
            `stop-secrets-leaks: scan failed — ${err instanceof Error ? err.message : String(err)}`,
            "warning",
          );
        } catch {
          /* no-op in non-interactive modes */
        }
      }
    }

    async function waitForScan(): Promise<void> {
      if (scanPromise) await scanPromise;
    }

    pi.on("session_start", async (_event, ctx) => {
      // Kick off the scan immediately but don't await — session_start
      // must not block Pi's startup. before_agent_start and tool_result
      // handlers await scanPromise so they see the results.
      scanPromise = fullScan(ctx).catch(() => {
        /* errors handled inside fullScan */
      });
    });

    pi.on("before_agent_start", async (event: BeforeAgentStartEvent) => {
      await waitForScan();
      if (!enabled || !binaryOk) return undefined;
      const guidance = buildGuidance(registry);
      if (!guidance) return undefined;
      return { systemPrompt: `${event.systemPrompt}\n\n${guidance}` };
    });

    pi.on("tool_result", async (event: ToolResultEvent, ctx: ExtensionContext) => {
      await waitForScan();
      if (!enabled || !binaryOk) return undefined;
      const toolName = event.toolName ?? "";

      // Write-like tools invalidate cache for the written path.
      if (isWriteLikeTool(toolName)) {
        const p = extractPathFromInput(event.input);
        if (p) cache.invalidate(resolve(ctx.cwd, p));
      }

      // Read-like tools reactively scan the file if cache is stale.
      if (isReadLikeTool(toolName)) {
        const p = extractPathFromInput(event.input);
        if (p) {
          const abs = resolve(ctx.cwd, p);
          if (!cache.isFresh(abs)) {
            await cache.withLock(abs, async () => {
              if (cache.isFresh(abs)) return;
              const findings = await deps.scanFiles(ctx.cwd, [abs]);
              cache.set(abs, findings);
              registry.addFindings(findings);
            });
          }
        }
      }

      // Redact text content blocks.
      if (!shouldRedactTool(toolName)) return undefined;
      const content = event.content as ContentBlock[] | undefined;
      if (!Array.isArray(content)) return undefined;
      let changed = false;
      const next: ContentBlock[] = [];
      for (const block of content) {
        if (block.type !== "text" || !shouldBother(block.text)) {
          next.push(block);
          continue;
        }
        const findings = await deps.scanText(block.text, ctx.signal);
        const { text, hits } = redactByFindings(block.text, findings, () =>
          registry.nextPlaceholder(),
        );
        if (hits > 0) {
          changed = true;
          stats.redactedHits += hits;
          next.push({ ...block, text });
        } else {
          next.push(block);
        }
      }
      if (changed) {
        // Append footer to the last text block to signal redaction occurred
        const lastText = next[next.length - 1];
        if (lastText?.type === "text") {
          next[next.length - 1] = {
            ...lastText,
            text: `${lastText.text}\n\u00AB\u{1F512}...\u00BB = Redacted secret`,
          };
        }
        return { content: next };
      }
      return undefined;
    });

    pi.registerCommand("stop-secrets-leaks-status", {
      description: "Show stop-secrets-leaks status",
      handler: async (_args, ctx) => {
        const s = registry.stats();
        const isOn = enabled && binaryOk;
        ctx.ui.notify(
          `stop-secrets-leaks: ${isOn ? "on" : "off"} | betterleaks timeout ${_cliTimeoutSec}s | found ${s.files} files and ${s.env} env vars with secrets | ${stats.redactedHits} secrets in tool calls were redacted`,
          isOn ? "info" : "warning",
        );
      },
    });

    pi.registerCommand("stop-secrets-leaks-toggle", {
      description: "Enable or disable stop-secrets-leaks redaction",
      handler: async (_args, ctx) => {
        enabled = !enabled;
        if (enabled) {
          await fullScan(ctx);
        }
        ctx.ui.notify(`stop-secrets-leaks ${enabled ? "enabled" : "disabled"}`, "info");
      },
    });

    pi.registerCommand("stop-secrets-leaks-rescan", {
      description: "Re-scan project and environment with betterleaks",
      handler: async (_args, ctx) => {
        await fullScan(ctx);
        const s = registry.stats();
        ctx.ui.notify(`stop-secrets-leaks re-scanned: file=${s.files} env=${s.env}`, "info");
      },
    });

    pi.registerCommand("stop-secrets-leaks-config", {
      description: "Set the scan timeout in seconds",
      handler: async (_args, ctx) => {
        const input = await ctx.ui.input("Scan timeout in seconds", String(_cliTimeoutSec));
        if (input == null) {
          ctx.ui.notify("stop-secrets-leaks-config cancelled", "info");
          return;
        }
        const sec = Number.parseInt(input, 10);
        if (Number.isNaN(sec) || sec < 1) {
          ctx.ui.notify("stop-secrets-leaks-config: must be a positive integer", "error");
          return;
        }
        const cfg = deps.configureScanTimeout(sec);
        _cliTimeoutSec = cfg.cliTimeoutSec;
        ctx.ui.notify(`Updated betterleaks timeout to ${cfg.cliTimeoutSec}s`, "info");
      },
    });
  };
}

export default function (pi: ExtensionAPI): void {
  createStopSecretsLeaks({
    isBetterleaksAvailable: defaultIsAvailable,
    scanFiles: defaultScanFiles,
    scanEnv: defaultScanEnv,
    scanText: defaultScanText,
    configureScanTimeout: defaultConfigureScanTimeout,
  })(pi);
}
