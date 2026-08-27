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
  type NamingSession,
} from "./naming.js";
import { collectExistingSessionNames } from "./dedup.js";
import { applySessionName, syncSurfaces, windowNameForSync } from "./surfaces.js";
import { debug, initDebug } from "./debug.js";

/**
 * Everything a rename run needs from the event context, captured synchronously
 * after the session lifecycle guard and before the naming pipeline yields, so
 * the deferred flow never touches a stale-guarded ctx getter.
 */
interface PreparedRename {
  activeSession: { active: boolean };
  state: RenameState;
  c: Config;
  currentName: string | undefined;
  context: NamingContext;
  cwd: string;
  sessionFile: string | undefined;
  session: NamingSession;
}

export default function (pi: ExtensionAPI): void {
  // NB: no action calls (appendEntry / registerEntryRenderer / ...) here — during
  // extension loading the runtime actions are throwing stubs. initDebug only
  // stores pi; the first gated debug() call (from an event handler) registers
  // the renderer and appends entries.
  initDebug(pi);
  let state: RenameState = createState();
  let cfg: Config | undefined;
  let lifecycle = { active: true };

  /**
   * Delayed initialization: capture cwd before yielding, then load config
   * without retaining the event ctx across the dynamic import boundary.
   */
  async function config(cwd: string): Promise<Config> {
    if (!cfg) {
      const { loadConfig } = await import("./config.js");
      cfg = loadConfig(cwd);
    }
    return cfg;
  }

  /**
   * Guard checks + synchronous preparation, run after config loading confirms
   * the event's session is still active. Returns undefined when the rename is
   * skipped (disabled, done, inflight/locked, un-replaceable name, or no
   * naming context yet).
   *
   * Crucially, the naming context is built HERE - before the naming pipeline's
   * first await and after the lifecycle check - so `ctx.sessionManager` is read
   * only while the session remains active. Session-bound values go into a plain
   * `PreparedRename` snapshot; the (possibly deferred) flow that follows never
   * touches a stale-guarded ctx getter again.
   */
  function prepareRename(
    ctx: ExtensionContext,
    options: { timeoutMs?: number } | undefined,
  ): PreparedRename | undefined {
    // cfg is read synchronously so this preparation remains before the next
    // await in every caller. config(cwd) has already populated the cache.
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
      return undefined;
    }

    const currentName = pi.getSessionName();
    if (!canReplace(currentName, c.replaceExistingName)) {
      debug("renameOnce: name not replaceable — latching done", {
        currentName,
        policy: c.replaceExistingName,
      });
      state.done = true;
      return undefined;
    }

    // Build the naming context synchronously with the fresh ctx.
    let context: NamingContext | undefined;
    try {
      context = buildContext(ctx, c);
    } catch (error) {
      debug("renameOnce: buildContext failed", String(error));
      return undefined;
    }
    if (!context) {
      debug("renameOnce: no naming context available");
      return undefined;
    }

    state.inflight = true;
    state.nameAtGenerationStart = currentName;
    debug("renameOnce: starting generation", {
      currentName,
      timeoutMs: options?.timeoutMs,
    });
    return {
      activeSession: lifecycle,
      state,
      c,
      currentName,
      context,
      cwd: ctx.cwd,
      sessionFile: ctx.sessionManager.getSessionFile(),
      session: {
        modelRegistry: ctx.modelRegistry,
        model: ctx.model,
        signal: ctx.signal,
      },
    };
  }

  /**
   * The rename pipeline on top of a prepared snapshot (no ctx access). Each
   * risky step is wrapped in its own small try/catch that logs exactly where it
   * failed and rethrows, so the caller of the pipeline still resets `inflight`/
   * `done` and debug pinpoints the failing stage.
   */
  async function completeRename(
    p: PreparedRename,
    options: { timeoutMs?: number } | undefined,
  ): Promise<void> {
    const { c, currentName } = p;

    // Step 1: collect existing sibling session names (dedup hints). A failure
    // here is non-fatal — the prompt just loses the dedup hints. Uses the
    // captured cwd/sessionFile, not ctx.
    let titles: string[] = [];
    if (!c.skipSessionNameDedup) {
      try {
        titles = await collectExistingSessionNames(p.cwd, p.sessionFile);
      } catch (error) {
        debug(
          "renameOnce: collectExistingSessionNames failed — continuing without dedup",
          String(error),
        );
        titles = [];
      }
    }
    if (!p.activeSession.active) return;

    // Step 2: generate the names (LLM + fallback) from the prebuilt context and
    // captured session refs. generateNames returns its failures rather than
    // throwing, so a throw here would be unexpected.
    let result: GenerateNamesResult;
    try {
      result = await generateNames(p.session, c, p.context, titles, p.cwd, pi, options);
    } catch (error) {
      debug("renameOnce: generateNames threw unexpectedly", String(error));
      throw error;
    }
    if (!p.activeSession.active) return;
    debug("renameOnce: generateNames result", result);

    if (!result.ok) {
      await handleFailure(result.reason);
      return;
    }

    // Step 3: apply the session name (race-guarded).
    try {
      if (p.state.autoRenameLocked || pi.getSessionName() !== p.state.nameAtGenerationStart) {
        debug("renameOnce: race guard abort — session name changed during generation", {
          nameAtGenerationStart: p.state.nameAtGenerationStart,
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
      await applySessionName(pi, p.state, c, result.names.sessionName, result.names.windowName);
    } catch (error) {
      debug("renameOnce: applySessionName failed", String(error));
      throw error;
    }
    if (!p.activeSession.active) return;

    // Step 4: sync surfaces to the generated window name.
    try {
      await syncSurfaces(pi, c, result.names.windowName);
    } catch (error) {
      debug("renameOnce: syncSurfaces failed", String(error));
      throw error;
    }
  }

  /**
   * Awaited rename: prepare synchronously with the active event ctx, then run the
   * pipeline to completion. Fired inside the event dispatch for headless flows
   * (`agent_settled` and `input`), so any error propagates to the runtime, which
   * wraps the handler await in try/catch and reports it rather than crashing.
   */
  async function renameOnce(
    ctx: ExtensionContext,
    options?: { timeoutMs?: number },
  ): Promise<void> {
    const p = prepareRename(ctx, options);
    if (!p) return;
    try {
      await completeRename(p, options);
    } finally {
      p.state.inflight = false;
      p.state.done = true;
    }
  }

  /**
   * Deferred rename for interactive first-input and UI agent_settled flows:
   * same synchronous preparation (fresh ctx), but the LLM call + apply run
   * fire-and-forget so the user's turn is never blocked. The body swallows its
   * own errors: a deferred continuation can never be an unhandled rejection
   * (which would crash pi). If the session is replaced/reloaded mid-flight,
   * the rename for the replaced session is then simply skipped.
   */
  function renameOnceDeferred(ctx: ExtensionContext, options?: { timeoutMs?: number }): void {
    const p = prepareRename(ctx, options);
    if (!p) return;
    void (async () => {
      try {
        await completeRename(p, options);
      } catch (error) {
        debug("renameOnce: deferred rename aborted mid-flight", String(error));
      } finally {
        p.state.inflight = false;
        p.state.done = true;
      }
    })();
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
    lifecycle.active = false;
    lifecycle = { active: true };
    const run = lifecycle;
    state = createState();
    cfg = undefined;
    const cwd = ctx.cwd;
    restoreProvenance(ctx, state);
    const c = await config(cwd);
    if (!run.active) return;
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
    const run = lifecycle;
    if (!run.active) return;
    const cwd = ctx.cwd;
    const c = await config(cwd);
    if (!run.active) return;
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
    // prepare synchronously (fresh ctx) and defer only the LLM + apply with a
    // shorter naming budget so the rename lands before the agent gets far into
    // its turn. Headless (RPC/print) awaits the full budget (§4 rule 5 note;
    // Gap 5).
    if (ctx.hasUI) {
      renameOnceDeferred(ctx, { timeoutMs: UI_RENAME_TIMEOUT_MS });
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
    const run = lifecycle;
    if (!run.active) return;
    const cwd = ctx.cwd;
    const c = await config(cwd);
    if (!run.active) return;
    if (!c.enabled) return;
    state.turnsSeen += 1;

    // Initial rename (first-agent-settled trigger): fires after the first
    // agent run has fully settled, so the naming context is stable. With a UI,
    // defer the naming request so the next user turn is not blocked; headless
    // callers keep the awaited behavior.
    if (c.initialRenameTrigger === "first-agent-settled" && !state.done) {
      debug("agent_settled: triggering initial rename", { hasUI: ctx.hasUI });
      if (ctx.hasUI) {
        renameOnceDeferred(ctx, { timeoutMs: UI_RENAME_TIMEOUT_MS });
      } else {
        await renameOnce(ctx, { timeoutMs: undefined });
      }
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
          renameOnceDeferred(ctx, { timeoutMs: UI_RENAME_TIMEOUT_MS });
        } else {
          await renameOnce(ctx, { timeoutMs: undefined });
        }
        state.done = prevDone || state.done;
      }
    }
  });

  pi.on("session_info_changed", async (event, ctx) => {
    const run = lifecycle;
    if (!run.active) return;
    const cwd = ctx.cwd;
    const c = await config(cwd);
    if (!run.active) return;
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

  pi.on("session_shutdown", async () => {
    lifecycle.active = false;
  });
}
