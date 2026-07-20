import { describe, expect, it } from "vitest";
import {
  buildSpeedColors,
  CWD_COLORS,
  hashString,
  hslToRgb,
  lerpRgb,
  lookupSpeedColor,
  pickCwdColor,
  SPEED_LUT_MAX,
} from "../src/color.js";

describe("hslToRgb", () => {
  it("produces primary colors at full saturation / half lightness", () => {
    expect(hslToRgb(0, 1, 0.5)).toEqual([255, 0, 0]);
    expect(hslToRgb(120, 1, 0.5)).toEqual([0, 255, 0]);
    expect(hslToRgb(240, 1, 0.5)).toEqual([0, 0, 255]);
  });

  it("produces black and white at zero saturation extremes", () => {
    expect(hslToRgb(0, 0, 0)).toEqual([0, 0, 0]);
    expect(hslToRgb(0, 0, 1)).toEqual([255, 255, 255]);
  });
});

describe("hashString", () => {
  it("is deterministic", () => {
    expect(hashString("pi-bakery")).toBe(hashString("pi-bakery"));
  });

  it("is always non-negative", () => {
    for (const s of ["", "a", "abc", "a".repeat(100), "π-statusline"]) {
      expect(hashString(s)).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns the seed for an empty string", () => {
    expect(hashString("")).toBe(5381);
  });

  it("differs for different inputs", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("lerpRgb", () => {
  it("returns the endpoints at t=0 and t=1", () => {
    expect(lerpRgb([0, 0, 0], [10, 20, 30], 0)).toEqual([0, 0, 0]);
    expect(lerpRgb([0, 0, 0], [10, 20, 30], 1)).toEqual([10, 20, 30]);
  });

  it("interpolates each channel independently", () => {
    expect(lerpRgb([0, 0, 0], [10, 20, 30], 0.5)).toEqual([5, 10, 15]);
    expect(lerpRgb([180, 50, 50], [190, 160, 40], 0.5)).toEqual([185, 105, 45]);
  });
});

describe("CWD_COLORS palette", () => {
  it("has 64 in-range RGB triples", () => {
    expect(CWD_COLORS).toHaveLength(64);
    for (const [r, g, b] of CWD_COLORS) {
      for (const ch of [r, g, b]) {
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe("pickCwdColor", () => {
  it("is deterministic for the same text", () => {
    expect(pickCwdColor("pi-bakery")).toEqual(pickCwdColor("pi-bakery"));
  });

  it("always returns a color from the palette", () => {
    for (const s of ["main", "feature/foo", "pi-bakery", "x"]) {
      expect(CWD_COLORS).toContainEqual(pickCwdColor(s));
    }
  });
});

describe("lookupSpeedColor", () => {
  it("returns the dull-red endpoint at 0", () => {
    expect(lookupSpeedColor(0)).toBe("\x1b[38;2;180;50;50m");
  });

  it("returns the dull-yellow endpoint at the 30 band boundary", () => {
    expect(lookupSpeedColor(30)).toBe("\x1b[38;2;190;160;40m");
  });

  it("returns the dull-green plateau at and above the max", () => {
    expect(lookupSpeedColor(SPEED_LUT_MAX)).toBe("\x1b[38;2;50;160;60m");
    expect(lookupSpeedColor(150)).toBe("\x1b[38;2;50;160;60m");
  });

  it("clamps out-of-range values into the LUT", () => {
    expect(lookupSpeedColor(-50)).toBe(lookupSpeedColor(0));
    expect(lookupSpeedColor(9999)).toBe(lookupSpeedColor(SPEED_LUT_MAX));
  });

  it("rounds fractional values to the nearest index", () => {
    expect(lookupSpeedColor(29.6)).toBe(buildSpeedColors[30]);
  });

  it("builds exactly SPEED_LUT_MAX + 1 entries", () => {
    expect(buildSpeedColors).toHaveLength(SPEED_LUT_MAX + 1);
  });
});
