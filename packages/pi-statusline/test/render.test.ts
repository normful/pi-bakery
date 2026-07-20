import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { describe, expect, it, vi } from "vitest";
import { formatMetric } from "../src/format.js";
import {
  buildFooterLeft,
  buildFooterRight,
  calculateUsage,
  renderAboveEditorWidget,
  renderContextInfo,
  renderFooter,
  renderLastTurnMetrics,
  renderStreamingMetrics,
} from "../src/render.js";
import type { LastTurnAverages, Stats, TurnCounts } from "../src/types.js";
import { fg, makeTheme, stripAnsi } from "./helpers.js";

const theme = makeTheme();

function makeStats(overrides: Partial<Stats> = {}): Stats {
  return {
    turnStartTimes: new Map(),
    contextPct: undefined,
    contextTokens: null,
    contextWindow: 0,
    gitBranch: "",
    cwd: "/proj/myapp",
    liveElapsed: undefined,
    modelProvider: "",
    modelId: "",
    thinkingLevel: "off" as ThinkingLevel,
    cachedUsage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
    ...overrides,
  };
}

describe("renderContextInfo", () => {
  it("shows --% when contextPct is unset", () => {
    expect(renderContextInfo(theme, makeStats())).toEqual([fg("syntaxType", "--%")]);
    expect(renderContextInfo(theme, makeStats({ contextPct: null }))).toEqual([
      fg("syntaxType", "--%"),
    ]);
  });

  it.each([
    [5, "success", ""],
    [10, "success", ""],
    [15, "dim", ""],
    [25, "muted", "🟦"],
    [35, "toolTitle", "🟪"],
    [45, "warning", "🟧"],
    [75, "error", "🟥"],
  ])("maps pct %i to color %s with emoji %j", (pct, color, emoji) => {
    const parts = renderContextInfo(theme, makeStats({ contextPct: pct }));
    expect(parts[0]).toBe(`${emoji} ${fg(color, `${pct}%`)}`);
  });

  it("appends token usage when tokens and window are known", () => {
    const parts = renderContextInfo(
      theme,
      makeStats({ contextPct: null, contextTokens: 50_000, contextWindow: 200_000 }),
    );
    expect(parts).toContain(fg("syntaxFunction", "50K/200K"));
  });

  it("omits token usage when window is 0", () => {
    const parts = renderContextInfo(
      theme,
      makeStats({ contextPct: null, contextTokens: 50_000, contextWindow: 0 }),
    );
    expect(parts).toEqual([fg("syntaxType", "--%")]);
  });

  it("appends the live elapsed timer when set", () => {
    const parts = renderContextInfo(theme, makeStats({ contextPct: null, liveElapsed: 1_500 }));
    expect(parts).toContain(fg("syntaxOperator", "⏱ 1.5s"));
  });
});

describe("buildFooterLeft", () => {
  it("prefixes the context info with a space", () => {
    expect(buildFooterLeft(theme, makeStats())).toBe(` ${fg("syntaxType", "--%")}`);
  });
});

describe("buildFooterRight", () => {
  it("renders millicents cost with a trailing space", () => {
    const out = buildFooterRight(theme, makeStats(), []);
    expect(out).toBe(`${fg("syntaxFunction", "0m¢")} `);
  });

  it("converts dollars to millicents", () => {
    const stats = makeStats({
      cachedUsage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0.001 },
    });
    expect(buildFooterRight(theme, stats, [])).toBe(`${fg("syntaxFunction", "100m¢")} `);
  });

  it("renders the cache:input:output ratio normalized to output=1", () => {
    const stats = makeStats({
      cachedUsage: { input: 1_000, output: 100, cacheRead: 500, cacheWrite: 0, cost: 0 },
    });
    const ratio =
      fg("syntaxComment", "5c") +
      fg("dim", ":") +
      fg("syntaxVariable", "5i") +
      fg("dim", ":") +
      fg("syntaxString", "1o");
    expect(buildFooterRight(theme, stats, [])).toBe(`${fg("syntaxFunction", "0m¢")} ${ratio} `);
  });

  it("omits the ratio when output is 0", () => {
    const stats = makeStats({
      cachedUsage: { input: 1_000, output: 0, cacheRead: 500, cacheWrite: 0, cost: 0 },
    });
    expect(buildFooterRight(theme, stats, [])).toBe(`${fg("syntaxFunction", "0m¢")} `);
  });

  it("prepends any metric parts passed in", () => {
    const out = buildFooterRight(theme, makeStats(), ["METRIC"]);
    expect(out.startsWith("METRIC ")).toBe(true);
  });
});

describe("renderFooter", () => {
  it("lays out left and right within the width", () => {
    const line = renderFooter(80, theme, makeStats(), [])[0];
    expect(visibleWidth(line)).toBeLessThanOrEqual(80);
    const plain = stripAnsi(line);
    expect(plain).toContain("--%");
    expect(plain).toContain("0m¢");
  });

  it("truncates with an ellipsis when content exceeds a tiny width", () => {
    const line = renderFooter(5, theme, makeStats(), [])[0];
    expect(visibleWidth(line)).toBeLessThanOrEqual(5);
    expect(stripAnsi(line)).toContain("...");
  });
});

describe("renderAboveEditorWidget", () => {
  it("renders a dir line and a model line", () => {
    vi.stubEnv("HOME", "/home/test");
    try {
      const stats = makeStats({
        cwd: "/proj/myapp",
        gitBranch: "main",
        modelId: "gpt-4o",
        modelProvider: "openrouter",
      });
      const lines = renderAboveEditorWidget(80, theme, stats);
      expect(lines).toHaveLength(2);

      const dirLine = stripAnsi(lines[0]);
      expect(dirLine).toContain("/p/");
      expect(dirLine).toContain("myapp");
      expect(dirLine).toContain("⎇ main");

      const modelLine = stripAnsi(lines[1]);
      expect(modelLine).toContain("gpt-4o");
      expect(modelLine).toContain("(⟐  off)");
      expect(modelLine).toContain("or"); // openrouter abbreviated
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("replaces the HOME prefix with ~", () => {
    vi.stubEnv("HOME", "/home/test");
    try {
      const stats = makeStats({ cwd: "/home/test/code/pi-bakery" });
      const dirLine = stripAnsi(renderAboveEditorWidget(80, theme, stats)[0]);
      expect(dirLine).toContain("~/c/");
      expect(dirLine).toContain("pi-bakery");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("splits a slashed branch into muted prefix + colored suffix", () => {
    vi.stubEnv("HOME", "/home/test");
    try {
      const stats = makeStats({ gitBranch: "feature/foo" });
      const dirLine = stripAnsi(renderAboveEditorWidget(80, theme, stats)[0]);
      expect(dirLine).toContain("⎇ feature/");
      expect(dirLine).toContain("foo");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("renders only the thinking level when model and provider are empty", () => {
    vi.stubEnv("HOME", "/home/test");
    try {
      const modelLine = stripAnsi(renderAboveEditorWidget(80, theme, makeStats())[1]).trim();
      expect(modelLine).toBe("(⟐  off)");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("keeps both lines within the requested width", () => {
    vi.stubEnv("HOME", "/home/test");
    try {
      const stats = makeStats({ modelId: "a-very-long-model-identifier", gitBranch: "main" });
      const lines = renderAboveEditorWidget(10, theme, stats);
      expect(visibleWidth(lines[0])).toBeLessThanOrEqual(10);
      expect(visibleWidth(lines[1])).toBeLessThanOrEqual(10);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("calculateUsage", () => {
  function makeCtx(events: unknown[]): ExtensionContext {
    return { sessionManager: { getBranch: () => events } } as unknown as ExtensionContext;
  }

  it("sums usage across assistant messages only", () => {
    const ctx = makeCtx([
      {
        type: "message",
        message: {
          role: "assistant",
          usage: { input: 10, output: 20, cacheRead: 5, cacheWrite: 2, cost: { total: 0.5 } },
        },
      },
      {
        type: "message",
        message: {
          role: "user",
          usage: { input: 99, output: 99, cacheRead: 99, cacheWrite: 99, cost: { total: 99 } },
        },
      },
      {
        type: "other",
        message: {
          role: "assistant",
          usage: { input: 99, output: 99, cacheRead: 99, cacheWrite: 99, cost: { total: 99 } },
        },
      },
      {
        type: "message",
        message: {
          role: "assistant",
          usage: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, cost: { total: 0.25 } },
        },
      },
    ]);
    expect(calculateUsage(ctx)).toEqual({
      input: 11,
      output: 22,
      cacheRead: 5,
      cacheWrite: 2,
      cost: 0.75,
    });
  });

  it("returns zeros for an empty branch", () => {
    expect(calculateUsage(makeCtx([]))).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
    });
  });
});

describe("renderStreamingMetrics", () => {
  const counts = (over: Partial<TurnCounts> = {}): TurnCounts => ({
    answerCharCount: 0,
    thinkingCharCount: 0,
    toolcallCharCount: 0,
    streamPhase: null,
    ...over,
  });

  it("returns nothing before a stream starts or without a phase", () => {
    expect(
      renderStreamingMetrics(0, counts({ streamPhase: "text", answerCharCount: 10 }), 1_000),
    ).toEqual([]);
    expect(renderStreamingMetrics(1_000, counts(), 2_000)).toEqual([]);
  });

  it("computes cps for the active text phase", () => {
    const out = renderStreamingMetrics(
      1_000,
      counts({ streamPhase: "text", answerCharCount: 100 }),
      2_000,
    );
    expect(out).toEqual([formatMetric(100, "cps", "≡")]);
  });

  it("computes cps for thinking and toolcall phases with their icons", () => {
    expect(
      renderStreamingMetrics(
        1_000,
        counts({ streamPhase: "thinking", thinkingCharCount: 50 }),
        2_000,
      ),
    ).toEqual([formatMetric(50, "cps", "⟐")]);
    expect(
      renderStreamingMetrics(
        1_000,
        counts({ streamPhase: "toolcall", toolcallCharCount: 30 }),
        2_000,
      ),
    ).toEqual([formatMetric(30, "cps", "⚙")]);
  });

  it("returns nothing for zero chars or non-positive elapsed", () => {
    expect(
      renderStreamingMetrics(1_000, counts({ streamPhase: "text", answerCharCount: 0 }), 2_000),
    ).toEqual([]);
    expect(
      renderStreamingMetrics(1_000, counts({ streamPhase: "text", answerCharCount: 10 }), 1_000),
    ).toEqual([]);
    expect(
      renderStreamingMetrics(2_000, counts({ streamPhase: "text", answerCharCount: 10 }), 1_000),
    ).toEqual([]);
  });
});

describe("renderLastTurnMetrics", () => {
  const avgs = (over: Partial<LastTurnAverages> = {}): LastTurnAverages => ({
    avgAnswerCps: null,
    avgThinkingCps: null,
    avgToolcallCps: null,
    ...over,
  });

  it("returns nothing when all averages are null or non-positive", () => {
    expect(renderLastTurnMetrics(avgs())).toEqual([]);
    expect(renderLastTurnMetrics(avgs({ avgAnswerCps: 0, avgThinkingCps: -5 }))).toEqual([]);
  });

  it("joins active metrics in thinking/toolcall/answer order", () => {
    const out = renderLastTurnMetrics(avgs({ avgThinkingCps: 50, avgAnswerCps: 100 }));
    expect(out).toEqual([`${formatMetric(50, "cps", "⟐")} ${formatMetric(100, "cps", "≡")}`]);
  });
});
