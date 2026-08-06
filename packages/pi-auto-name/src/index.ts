// index.ts — entry point: event wiring + orchestration.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Config } from "./config.js";
import { createState, restoreProvenance, type RenameState } from "./state.js";
import { canReplace, handleSessionInfoChanged } from "./ownership.js";
import { buildContext, type NamingContext } from "./context.js";
import {
  generateNames,
  UI_RENAME_TIMEOUT_MS,
  type GenerateFailureReason,
  type GenerateNamesResult,
} from "./naming.js";
import { collectExistingSessionNames } from "./dedup.js";
import { applySessionName, syncSurfaces, windowNameForSync } from "./surfaces.js";
import { debug, initDebug } from "./debug.js";

/**
 * True when a captured ctx has been invalidated by a session replacement or
 * reload (e.g. /new, /fork, /reload, or a session switch). Every ExtensionContext
 * getter calls assertActive(), which throws the stale-instance error once the
 * runner has been replaced; probing the cheapest getter is how we detect that
 * without depending on error-message strings.
 */
function isStaleCtx(ctx: ExtensionContext): boolean {
  try {
    void ctx.cwd;
    return false;
  } catch {
    return true;
  }
}

export default function (pi: ExtensionAPI): void {
  // NB: no action calls (appendEntry / registerEntryRenderer / ...) here — during
  // extension loading the runtime actions are throwing stubs. initDebug only
  // stores pi; the first gated debug() call (from an event handler) registers
  // the renderer and appends entries.
  initDebug(pi);
  let state: RenameState = createState();
  let cfg: Config | undefined;

  /**
   * Delayed initialization: `loadConfig` (and its transitive load of
   * pi-coding-agent + rpiv-config + typebox) is only pulled in on the first
   * call — which happens inside an event handler, well after the extension's
   * measured import window — instead of at module evaluation time.
   */
  async function config(ctx: ExtensionContext): Promise<Config> {
    if (!cfg) {
      const { loadConfig } = await import("./config.js");
      cfg = loadConfig(ctx.cwd);
    }
    return cfg;
  }

  async function renameOnce(
    ctx: ExtensionContext,
    options?: { timeoutMs?: number },
  ): Promise<void> {
    // cfg is read synchronously (not via the async config()) so the guard below
    // runs before the first await — matching the pre-lazy-config sync behavior.
    // Every caller awaits config(ctx) before invoking renameOnce, so cfg is
    // already cached here; the fire-and-forget callers rely on this guard
    // running synchronously (they reset state.done right after `void renameOnce`).
    const c = cfg as Config;
    if (!c.enabled || state.done || state.inflight || state.autoRenameLocked) {
      // A completed initial rename (`done` or `!enabled`) is the expected
      // steady-state between re-renames — not worth logging on every input.
      // Log only the transient blocks that indicate something may be stuck.
      if (state.inflight || state.autoRenameLocked) {
        debug("renameOnce: skip (inflight or locked)", {
          enabled: c.enabled,
          done: state.done,
          inflight: state.inflight,
          autoRenameLocked: state.autoRenameLocked,
        });
      }
      return;
    }

    const currentName = pi.getSessionName();
    if (!canReplace(currentName, c.replaceExistingName)) {
      debug("renameOnce: name not replaceable — latching done", {
        currentName,
        policy: c.replaceExistingName,
      });
      state.done = true;
      return;
    }

    state.inflight = true;
    state.nameAtGenerationStart = currentName;
    debug("renameOnce: starting generation", {
      currentName,
      timeoutMs: options?.timeoutMs,
    });
    try {
      await runRenameFlow(ctx, c, currentName, options);
    } catch (error) {
      if (isStaleCtx(ctx)) {
        // The session was replaced or reloaded mid-flow (e.g. /new, /fork,
        // /reload, or a session switch while the naming LLM call was in
        // flight). Every ctx getter asserts activity, so the captured ctx can
        // no longer touch the session manager. Nothing to fix — just skip
        // naming for the replaced session instead of crashing pi.
        debug("renameOnce: session replaced/reloaded mid-flow — aborting rename", String(error));
        return;
      }
      throw error;
    } finally {
      state.inflight = false;
      state.done = true;
    }
  }

  /**
   * The rename pipeline. Each risky step is wrapped in its own small
   * try/catch that logs exactly where it failed and rethrows, so `renameOnce`'s
   * finally still resets `inflight`/`done` and the caller observes the failure
   * while debug pinpoints the failing stage.
   */
  async function runRenameFlow(
    ctx: ExtensionContext,
    c: Config,
    currentName: string | undefined,
    options: { timeoutMs?: number } | undefined,
  ): Promise<void> {
    // Step 1: collect existing sibling session names (dedup hints). A failure
    // here is non-fatal — the prompt just loses the dedup hints.
    let titles: string[] = [];
    if (!c.skipSessionNameDedup) {
      try {
        titles = await collectExistingSessionNames(ctx.cwd, ctx.sessionManager.getSessionFile());
      } catch (error) {
        debug(
          "renameOnce: collectExistingSessionNames failed — continuing without dedup",
          String(error),
        );
        titles = [];
      }
    }

    // Step 2: build the naming context. Undefined → nothing to name yet.
    let context: NamingContext | undefined;
    try {
      context = await buildContext(ctx, c);
    } catch (error) {
      debug("renameOnce: buildContext failed", String(error));
      throw error;
    }
    if (!context) {
      debug("renameOnce: no naming context available");
      return;
    }

    // Step 3: generate the names (LLM + fallback). generateNames returns its
    // failures rather than throwing, so a throw here would be unexpected.
    let result: GenerateNamesResult;
    try {
      result = await generateNames(ctx, c, context, titles, ctx.cwd, pi, options);
    } catch (error) {
      debug("renameOnce: generateNames threw unexpectedly", String(error));
      throw error;
    }
    debug("renameOnce: generateNames result", result);

    if (!result.ok) {
      await handleFailure(result.reason);
      return;
    }

    // Step 4: apply the session name (race-guarded).
    try {
      if (state.autoRenameLocked || pi.getSessionName() !== state.nameAtGenerationStart) {
        debug("renameOnce: race guard abort — session name changed during generation", {
          nameAtGenerationStart: state.nameAtGenerationStart,
          current: pi.getSessionName(),
        });
        return;
      }
      debug("renameOnce: applying names", {
        previous: currentName,
        next: result.names.sessionName,
        changed: currentName !== result.names.sessionName,
        windowName: result.names.windowName,
      });
      await applySessionName(pi, state, c, result.names.sessionName, result.names.windowName);
    } catch (error) {
      debug("renameOnce: applySessionName failed", String(error));
      throw error;
    }

    // Step 5: sync surfaces to the generated window name.
    try {
      await syncSurfaces(pi, c, result.names.windowName);
    } catch (error) {
      debug("renameOnce: syncSurfaces failed", String(error));
      throw error;
    }
  }

  /**
   * Total-failure handling. Any naming failure latches `done` (renameOnce's
   * finally sets it), so there is no temporary title and no mid-session retry:
   * the session simply keeps its current / pi-derived default name and the
   * initial rename does not land this session.
   */
  async function handleFailure(reason: GenerateFailureReason): Promise<void> {
    debug("renameOnce: name generation failed — latching done (no retry)", { reason });
  }

  pi.on("session_start", async (event, ctx) => {
    state = createState();
    cfg = undefined;
    const c = await config(ctx);
    restoreProvenance(ctx, state);
    debug("session_start", {
      reason: event.reason,
      restored: {
        lastAutoName: state.lastAutoName,
        lastAutoWindowName: state.lastAutoWindowName,
      },
    });

    // Respect an existing deliberate name; still sync surfaces to a window
    // name derived from it (stored window name, else compacted session name).
    const currentName = pi.getSessionName();
    if (currentName && !canReplace(currentName, c.replaceExistingName)) {
      debug("session_start: existing deliberate name — initial rename skipped", { currentName });
      state.done = true;
    }
    debug("session_start: syncing surfaces", { currentName });
    await syncSurfaces(pi, c, windowNameForSync(state, currentName));
  });

  pi.on("input", async (event, ctx) => {
    const c = await config(ctx);
    if (!c.enabled || c.initialRenameTrigger !== "first-input") {
      debug("input: ignored", {
        enabled: c.enabled,
        trigger: c.initialRenameTrigger,
      });
      return;
    }
    if (event.source === "extension") {
      debug("input: ignored (extension source)");
      return; // injected by another extension, not the user
    }
    const text = (event.text ?? "").trim();
    if (!text) {
      debug("input: ignored (empty text)");
      return;
    }
    debug("input: triggering rename", {
      hasUI: ctx.hasUI,
      text: text.slice(0, 80),
    });
    // With a UI present, never block the user's turn on the naming LLM call:
    // fire-and-forget with a shorter naming budget so the rename lands before
    // the agent gets far into its turn. Headless (RPC/print) awaits the full
    // budget (§4 rule 5 note; Gap 5).
    if (ctx.hasUI) {
      void renameOnce(ctx, { timeoutMs: UI_RENAME_TIMEOUT_MS });
      return;
    }
    await renameOnce(ctx);
  });

  /**
   * agent_settled fires once pi will not continue running automatically —
   * after auto-retries, compaction-retries, and queued follow-ups are all
   * done. That makes it the one clean boundary per *user-facing* turn: one
   * real user input = one agent_settled. Contrast agent_end (fires mid-
   * activity, while pi may still auto-compact/retry or run follow-ups) and
   * turn_end (fires once per model continuation), which is why the initial
   * rename and the turn-interval re-rename both live here.
   */
  pi.on("agent_settled", async (_event, ctx) => {
    const c = await config(ctx);
    if (!c.enabled) return;
    state.turnsSeen += 1;

    // Initial rename (first-agent-settled trigger): fires after the first
    // agent run has fully settled, so the naming context is stable.
    if (c.initialRenameTrigger === "first-agent-settled" && !state.done) {
      debug("agent_settled: triggering initial rename", { hasUI: ctx.hasUI });
      if (ctx.hasUI) {
        void renameOnce(ctx, { timeoutMs: UI_RENAME_TIMEOUT_MS });
        return;
      }
      await renameOnce(ctx);
      return;
    }

    // Turn-interval re-rename. agent_settled counts real user-facing turns
    // (one input = one settled turn), so reRenameEveryNTurns behaves exactly
    // as its name implies — no per-continuation churn, and it fires at the
    // settled boundary rather than mid-turn.
    if (c.reRenameEveryNTurns > 0 && state.done && state.turnsSeen % c.reRenameEveryNTurns === 0) {
      const currentName = pi.getSessionName();
      const blocked = state.inflight || state.autoRenameLocked;
      const replaceable = canReplace(currentName, c.replaceExistingName);
      debug("agent_settled: re-rename check", {
        turnsSeen: state.turnsSeen,
        interval: c.reRenameEveryNTurns,
        currentName,
        inflight: state.inflight,
        autoRenameLocked: state.autoRenameLocked,
        canReplace: replaceable,
        renamed: !blocked && replaceable,
      });
      if (!blocked && replaceable) {
        const prevDone = state.done;
        state.done = false; // allow a re-run
        if (ctx.hasUI) {
          void renameOnce(ctx, { timeoutMs: UI_RENAME_TIMEOUT_MS });
        } else {
          await renameOnce(ctx);
        }
        state.done = prevDone || state.done;
      }
    }
  });

  pi.on("session_info_changed", async (event, ctx) => {
    const c = await config(ctx);
    const isEcho = event.name === state.lastAutoName;
    debug("session_info_changed", {
      name: event.name,
      isEcho,
      lastAutoName: state.lastAutoName,
      respectExternalRenames: c.respectExternalRenames,
    });
    handleSessionInfoChanged(state, event.name, c.respectExternalRenames);
    // Echoes of our own rename already synced surfaces inside renameOnce;
    // only external renames (user /name, RPC, other extensions) re-sync here.
    if (!isEcho) await syncSurfaces(pi, c, windowNameForSync(state, event.name));
  });
}
