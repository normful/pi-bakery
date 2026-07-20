import type { AgentMessage, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { AssistantMessageEvent } from "@earendil-works/pi-ai";
import type {
  AgentEndEvent,
  BeforeAgentStartEvent,
  ExtensionAPI,
  ExtensionContext,
  SessionShutdownEvent,
  SessionStartEvent,
  TurnEndEvent,
  TurnStartEvent,
} from "@earendil-works/pi-coding-agent";
import { safeDivide } from "./format.js";
import {
  calculateUsage,
  renderAboveEditorWidget,
  renderFooter,
  renderLastTurnMetrics,
  renderStreamingMetrics,
} from "./render.js";
import type { LastTurnAverages, Stats, TimerState, TurnCounts } from "./types.js";

// These event types exist in the package internals but are not publicly exported,
// so we define them locally.
interface MessageStartEvent {
  type: "message_start";
  message: AgentMessage;
}
interface MessageUpdateEvent {
  type: "message_update";
  message: AgentMessage;
  assistantMessageEvent: AssistantMessageEvent;
}
interface MessageEndEvent {
  type: "message_end";
  message: AgentMessage;
}

// ModelSelectEvent is not exported from the package, so we define it locally
interface ModelSelectEvent {
  type: "model_select";
  model: { provider: string; id: string };
  previousModel: { provider: string; id: string } | undefined;
  source: string;
}

interface ThinkingLevelSelectEvent {
  type: "thinking_level_select";
  level: ThinkingLevel;
  previousLevel: ThinkingLevel;
}

// --- Module-level state (owned by the orchestrator; render.ts stays pure) ---

const stats: Stats = {
  // Map of turnIndex -> start timestamp for tracking runtimes
  turnStartTimes: new Map<number, number>(),
  // Cached status values for footer
  contextPct: undefined as number | undefined,
  contextTokens: null,
  contextWindow: 0,
  gitBranch: "",
  cwd: process.cwd(),
  // Live elapsed timer (for footer display)
  liveElapsed: undefined as number | undefined,
  // Model info for footer
  modelProvider: "",
  modelId: "",
  thinkingLevel: "off" as ThinkingLevel,
  cachedUsage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
};

const turnCounts: TurnCounts = {
  answerCharCount: 0,
  thinkingCharCount: 0,
  toolcallCharCount: 0,
  streamPhase: null,
};

const lastTurnAverages: LastTurnAverages = {
  avgAnswerCps: null,
  avgThinkingCps: null,
  avgToolcallCps: null,
};

const timerState: TimerState = {
  agentStartMs: null,
  timerInterval: null,
};

// Simple stream start timestamp for CPS calculation
let streamStartMs = 0;

// Track old dispose functions so we can clean up on session reload
let _prevWidgetAboveDispose: (() => void) | undefined;
let _prevFooterDispose: (() => void) | undefined;

function clearTimer() {
  if (timerState.timerInterval) {
    clearInterval(timerState.timerInterval);
    timerState.timerInterval = null;
  }
}

/** Update cached context stats from a live ctx (called from event handlers only, not from render). */
function updateContextStats(ctx: ExtensionContext) {
  const cu = ctx.getContextUsage?.();
  if (cu) {
    stats.contextPct = cu.percent;
    stats.contextTokens = cu.tokens;
    stats.contextWindow = cu.contextWindow;
  }
  stats.cachedUsage = calculateUsage(ctx);
}

export default function init(pi: ExtensionAPI) {
  pi.on("before_agent_start", (_event: BeforeAgentStartEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;

    // Hide built-in working loader row entirely
    ctx.ui.setWorkingVisible(false);

    timerState.agentStartMs = Date.now();
  });

  pi.on("turn_start", (event: TurnStartEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;

    // Track turn start time by turnIndex
    stats.turnStartTimes.set(event.turnIndex, event.timestamp);
    updateContextStats(ctx);

    // Start live elapsed timer - will be displayed in footer
    clearTimer();
    timerState.timerInterval = setInterval(() => {
      if (!timerState.agentStartMs) return;
      const elapsed = Date.now() - timerState.agentStartMs;
      // Store in stats so footer can read it
      stats.liveElapsed = elapsed;
    }, 800);
  });

  pi.on("turn_end", (event: TurnEndEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;

    stats.turnStartTimes.delete(event.turnIndex);
    clearTimer();
    stats.liveElapsed = undefined;
    updateContextStats(ctx);
  });

  pi.on("agent_end", (_event: AgentEndEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;
    clearTimer();
    if (timerState.agentStartMs) {
      stats.liveElapsed = Date.now() - timerState.agentStartMs;
    }
  });

  pi.on("session_shutdown", (_event: SessionShutdownEvent, _ctx: ExtensionContext) => {
    clearTimer();
    streamStartMs = 0;
    lastTurnAverages.avgAnswerCps = null;
    lastTurnAverages.avgThinkingCps = null;
    lastTurnAverages.avgToolcallCps = null;
    // Dispose widget/footer subscriptions
    if (_prevWidgetAboveDispose) {
      _prevWidgetAboveDispose();
      _prevWidgetAboveDispose = undefined;
    }
    if (_prevFooterDispose) {
      _prevFooterDispose();
      _prevFooterDispose = undefined;
    }
  });

  // --- CPS tracking ---

  pi.on("message_start", (event: MessageStartEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;
    if (event.message?.role === "assistant") {
      lastTurnAverages.avgAnswerCps = null;
      lastTurnAverages.avgThinkingCps = null;
      lastTurnAverages.avgToolcallCps = null;
      turnCounts.answerCharCount = 0;
      turnCounts.thinkingCharCount = 0;
      turnCounts.toolcallCharCount = 0;
      turnCounts.streamPhase = null;
      streamStartMs = Date.now();
    }
  });

  pi.on("message_update", (event: MessageUpdateEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;
    const ev = event.assistantMessageEvent;
    if (ev?.type === "thinking_start") {
      turnCounts.streamPhase = "thinking";
    }
    if (ev?.type === "text_start") {
      turnCounts.streamPhase = "text";
    }
    if (ev?.type === "toolcall_start") {
      turnCounts.streamPhase = "toolcall";
    }
    if (ev?.type === "text_delta") {
      turnCounts.answerCharCount += ev.delta.length;
    }
    if (ev?.type === "thinking_delta") {
      turnCounts.thinkingCharCount += ev.delta.length;
    }
    if (ev?.type === "toolcall_delta") {
      turnCounts.toolcallCharCount += ev.delta.length;
    }
  });

  pi.on("message_end", (event: MessageEndEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;
    if (event.message?.role === "assistant" && streamStartMs > 0) {
      const elapsedMs = Date.now() - streamStartMs;
      if (elapsedMs > 0) {
        lastTurnAverages.avgAnswerCps = safeDivide(turnCounts.answerCharCount, elapsedMs);
        lastTurnAverages.avgThinkingCps = safeDivide(turnCounts.thinkingCharCount, elapsedMs);
        lastTurnAverages.avgToolcallCps = safeDivide(turnCounts.toolcallCharCount, elapsedMs);
      }
      streamStartMs = 0;
    }
  });

  pi.on("session_start", (_event: SessionStartEvent, ctx: ExtensionContext) => {
    // event.reason: "startup" | "reload" | "new" | "resume" | "fork"
    // event.previousSessionFile: set for "new", "resume", "fork"
    if (!ctx.hasUI) return;

    // Dispose previous widget/footer subscriptions before registering new ones
    if (_prevWidgetAboveDispose) {
      _prevWidgetAboveDispose();
      _prevWidgetAboveDispose = undefined;
    }
    if (_prevFooterDispose) {
      _prevFooterDispose();
      _prevFooterDispose = undefined;
    }

    ctx.ui.setWorkingIndicator({ frames: [] });

    // Reset stats
    stats.turnStartTimes.clear();
    stats.cachedUsage = {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
    };
    updateContextStats(ctx);
    stats.gitBranch = "";
    stats.cwd = ctx.cwd;
    stats.modelProvider = String(ctx.model?.provider ?? "");
    stats.modelId = String(ctx.model?.id ?? "");
    stats.thinkingLevel = pi.getThinkingLevel();

    // Reset timer state
    timerState.agentStartMs = null;
    clearTimer();

    const widgetAboveResult = ctx.ui.setWidget("widget-above", (_tui, theme) => {
      const renderStats = stats;

      return {
        dispose: undefined,
        invalidate() {},
        render(w: number): string[] {
          return renderAboveEditorWidget(w, theme, renderStats);
        },
      };
    });
    if (typeof widgetAboveResult === "function") _prevWidgetAboveDispose = widgetAboveResult;

    const footerResult = ctx.ui.setFooter((_tui, theme, footerData) => {
      // Initialize git branch from footerData
      stats.gitBranch = footerData.getGitBranch() ?? "";

      const unsubBranch = footerData.onBranchChange(() => {
        stats.gitBranch = footerData.getGitBranch() ?? "";
      });

      return {
        dispose: unsubBranch,
        invalidate() {},
        render(width: number): string[] {
          // Compute live metric parts at render time from orchestrator-owned state.
          const metricParts = [
            ...renderStreamingMetrics(streamStartMs, turnCounts, Date.now()),
            ...renderLastTurnMetrics(lastTurnAverages),
          ];
          return renderFooter(width, theme, stats, metricParts);
        },
      };
    });
    if (typeof footerResult === "function") _prevFooterDispose = footerResult;
  });

  // Listen for model changes to update the widget
  pi.on("model_select", (_event: ModelSelectEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;

    stats.modelProvider = String(ctx.model?.provider ?? "");
    stats.modelId = String(ctx.model?.id ?? "");
  });

  // Listen for thinking level changes to update the widget
  pi.on("thinking_level_select", (_event: ThinkingLevelSelectEvent, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;

    stats.thinkingLevel = pi.getThinkingLevel();
  });
}
