import { describe, expect, it } from "vitest";
import { lookupSpeedColor, SPEED_RESET } from "../src/color.js";
import {
  colorModelId,
  formatDuration,
  formatMetric,
  formatTokens,
  safeDivide,
  truncatePath,
} from "../src/format.js";
import { fg, makeTheme } from "./helpers.js";

const theme = makeTheme();

describe("formatTokens", () => {
  it("leaves sub-thousand values untouched", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(999)).toBe("999");
  });

  it("formats exact thousands/millions/billions without decimals", () => {
    expect(formatTokens(1_000)).toBe("1K");
    expect(formatTokens(2_000)).toBe("2K");
    expect(formatTokens(1_000_000)).toBe("1M");
    expect(formatTokens(1_000_000_000)).toBe("1B");
  });

  it("formats fractional values with one decimal", () => {
    expect(formatTokens(1_500)).toBe("1.5K");
    expect(formatTokens(2_500_000)).toBe("2.5M");
    expect(formatTokens(1_500_000_000)).toBe("1.5B");
    expect(formatTokens(1_234)).toBe("1.2K");
  });

  it("drops a trailing .0 produced by rounding", () => {
    // 1.04B -> toFixed(1) === "1.0" -> "1B"
    expect(formatTokens(1_040_000_000)).toBe("1B");
  });
});

describe("formatDuration", () => {
  it("formats sub-second as ms", () => {
    expect(formatDuration(0)).toBe("0ms");
    expect(formatDuration(500)).toBe("500ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  it("formats sub-minute as seconds with one decimal", () => {
    expect(formatDuration(1_000)).toBe("1.0s");
    expect(formatDuration(1_500)).toBe("1.5s");
    expect(formatDuration(30_000)).toBe("30.0s");
  });

  it("formats a minute or more as Xm Ys", () => {
    expect(formatDuration(60_000)).toBe("1m 0s");
    expect(formatDuration(61_000)).toBe("1m 1s");
    expect(formatDuration(90_000)).toBe("1m 30s");
  });
});

describe("safeDivide", () => {
  it("divides numerator by denominator expressed in seconds", () => {
    expect(safeDivide(100, 1_000)).toBe(100);
    expect(safeDivide(100, 2_000)).toBe(50);
    expect(safeDivide(0, 1_000)).toBe(0);
  });

  it("returns 0 for zero or negative denominators", () => {
    expect(safeDivide(100, 0)).toBe(0);
    expect(safeDivide(100, -1_000)).toBe(0);
  });
});

describe("formatMetric", () => {
  it("wraps value with speed color, icon, unit and reset", () => {
    expect(formatMetric(100, "cps", "≡")).toBe(`${lookupSpeedColor(100)}≡ 100cps${SPEED_RESET}`);
  });

  it("uses one decimal below 5 and rounding at/above 5", () => {
    expect(formatMetric(2.34, "cps", "⟐")).toBe(`${lookupSpeedColor(2.34)}⟐ 2.3cps${SPEED_RESET}`);
    expect(formatMetric(4.9, "cps", "≡")).toBe(`${lookupSpeedColor(4.9)}≡ 4.9cps${SPEED_RESET}`);
    expect(formatMetric(5, "cps", "≡")).toBe(`${lookupSpeedColor(5)}≡ 5cps${SPEED_RESET}`);
  });
});

describe("colorModelId", () => {
  it("colors the whole ID as syntaxNumber when there is no omni/free", () => {
    expect(colorModelId("gpt-4o", theme)).toBe(fg("syntaxNumber", "gpt-4o"));
  });

  it("highlights omni with syntaxFunction and the rest with syntaxNumber", () => {
    expect(colorModelId("gpt-omni", theme)).toBe(
      fg("syntaxNumber", "gpt-") + fg("syntaxFunction", "omni"),
    );
    expect(colorModelId("omni", theme)).toBe(fg("syntaxFunction", "omni"));
  });

  it("matches omni case-insensitively", () => {
    expect(colorModelId("OMNI-4o", theme)).toBe(
      fg("syntaxFunction", "OMNI") + fg("syntaxNumber", "-4o"),
    );
  });

  it("colors a trailing :free suffix", () => {
    expect(colorModelId("gemini:free", theme)).toBe(
      fg("syntaxNumber", "gemini") + fg("syntaxNumber", ":") + fg("syntaxFunction", "free"),
    );
  });

  it("colors a trailing -free suffix", () => {
    expect(colorModelId("llama-free", theme)).toBe(
      fg("syntaxNumber", "llama") + fg("syntaxNumber", "-") + fg("syntaxFunction", "free"),
    );
  });

  it("combines omni coloring with a trailing free suffix", () => {
    expect(colorModelId("gpt-omni:free", theme)).toBe(
      fg("syntaxNumber", "gpt-") +
        fg("syntaxFunction", "omni") +
        fg("syntaxNumber", ":") +
        fg("syntaxFunction", "free"),
    );
  });
});

describe("truncatePath", () => {
  it("returns empty and root unchanged", () => {
    expect(truncatePath("")).toBe("");
    expect(truncatePath("/")).toBe("/");
  });

  it("abbreviates non-final segments longer than 3 chars", () => {
    expect(truncatePath("/Users/norman/code")).toBe("/U/n/code");
    expect(truncatePath("~/code/pi-bakery")).toBe("~/c/pi-bakery");
  });

  it("keeps short segments and the final segment intact", () => {
    expect(truncatePath("/a/b")).toBe("/a/b");
    expect(truncatePath("/ab/cd/ef")).toBe("/ab/cd/ef");
    expect(truncatePath("short")).toBe("short");
  });
});
