import type { ThinkingLevel } from "@earendil-works/pi-agent-core";

export interface UsageStats {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
}

export interface Stats {
  turnStartTimes: Map<number, number>;
  contextPct: number | null | undefined;
  contextTokens: number | null;
  contextWindow: number;
  gitBranch: string;
  cwd: string;
  liveElapsed: number | undefined;
  modelProvider: string;
  modelId: string;
  thinkingLevel: ThinkingLevel;
  // Cached usage for footer display (no ctx access during render)
  cachedUsage: UsageStats;
}

export interface TurnCounts {
  answerCharCount: number;
  thinkingCharCount: number;
  toolcallCharCount: number;
  streamPhase: "thinking" | "text" | "toolcall" | null;
}

export interface LastTurnAverages {
  avgAnswerCps: number | null;
  avgThinkingCps: number | null;
  avgToolcallCps: number | null;
}

export interface TimerState {
  agentStartMs: number | null;
  timerInterval: ReturnType<typeof setInterval> | null;
}
