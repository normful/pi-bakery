import { describe, it, expect, vi } from "vitest";
import { buildColorDisplayLines, ALL_COLORS } from "../src/index.js";

const mockTheme = {
  getFgAnsi: (color: string) => (color === "accent" ? "\x1b[38;5;2m" : "\x1b[38;5;7m"),
};

describe("buildColorDisplayLines", () => {
  it("returns one line per color", () => {
    const lines = buildColorDisplayLines(mockTheme, ALL_COLORS);
    expect(lines).toHaveLength(ALL_COLORS.length);
  });

  it("pads color names to 24 characters", () => {
    const lines = buildColorDisplayLines(mockTheme, ["accent"]);
    expect(lines[0]).toMatch(/^accent\s{18}/);
  });

  it("wraps sample text in ANSI color codes", () => {
    const lines = buildColorDisplayLines(mockTheme, ["accent"]);
    expect(lines[0]).toContain("\x1b[38;5;2mThe quick brown fox\x1b[0m");
  });

  it("uses a custom sample text when provided", () => {
    const lines = buildColorDisplayLines(mockTheme, ["text"], "Hello");
    expect(lines[0]).toContain("Hello");
    expect(lines[0]).not.toContain("The quick brown fox");
  });

  it("ends every line with the ANSI reset code", () => {
    const lines = buildColorDisplayLines(mockTheme, ALL_COLORS);
    const resetCode = "\x1b[0m";
    for (const line of lines) {
      expect(line.endsWith(resetCode)).toBe(true);
    }
  });

  it("returns an empty array when given no colors", () => {
    const lines = buildColorDisplayLines(mockTheme, []);
    expect(lines).toEqual([]);
  });

  it("prepends each color name at the start of each line", () => {
    const colors = ["accent", "border", "error"];
    const lines = buildColorDisplayLines(mockTheme, colors);
    expect(lines[0]).toMatch(/^accent\s{2,}/);
    expect(lines[1]).toMatch(/^border\s{2,}/);
    expect(lines[2]).toMatch(/^error\s{2,}/);
  });

  it("calls getFgAnsi for each color in order", () => {
    const getFgAnsi = (color: string) => `\x1b[38;5;${color === "success" ? "2" : "1"}m`;
    const spy = vi.fn(getFgAnsi);
    buildColorDisplayLines({ getFgAnsi: spy }, ["success", "error"]);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, "success");
    expect(spy).toHaveBeenNthCalledWith(2, "error");
  });
});
