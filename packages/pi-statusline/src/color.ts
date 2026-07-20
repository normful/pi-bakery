// ── CWD hash-color palette ──
// 64 colors evenly distributed in hue, HSL → RGB computed once at module init.
// Used to give each directory a consistent distinct color via raw ANSI escapes.

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export const CWD_COLORS: readonly [number, number, number][] = (() => {
  const palette: [number, number, number][] = [];
  for (let i = 0; i < 64; i++) {
    const hue = (i / 64) * 360;
    // Alternate saturation and lightness for more visual variety
    const sat = i % 2 === 0 ? 0.7 : 0.85;
    const light = i % 2 === 0 ? 0.5 : 0.55;
    palette.push(hslToRgb(hue, sat, light));
  }
  return palette;
})();

export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash |= 0; // force 32-bit integer
  }
  return Math.abs(hash);
}

/** Pick a deterministic (hash-based) color from the palette for the given path segment text. */
export function pickCwdColor(text: string): [number, number, number] {
  const idx = hashString(text) % CWD_COLORS.length;
  const color = CWD_COLORS[idx];
  if (color) return color;
  return [180, 180, 180]; // fallback gray (should never reach)
}

// ── Speed color lookup table (built once at module init) ──
//
// Flipped ordering (slow = red, fast = green) with dim/dull shades.
// Max intensity ~190 to avoid harsh pure-255 hues. All endpoint colors
// mix in cross-channel components for a muted, stylish look.
//
// Bands (flipped):
//   0–30:   dull red → dull yellow
//   30–50:  dull yellow → dull blue
//   50–100: dull blue → dull cyan
//   100–150: dull cyan → dull green
//   150+:    dull green plateau

export const SPEED_RESET = "\x1b[0m";
export const SPEED_LUT_MAX = 200;

// Dim endpoint colors (r, g, b) — no channel exceeds 190
const DULL_RED: readonly [number, number, number] = [180, 50, 50];
const DULL_YELLOW: readonly [number, number, number] = [190, 160, 40];
const DULL_BLUE: readonly [number, number, number] = [50, 80, 190];
const DULL_CYAN: readonly [number, number, number] = [40, 170, 180];
const DULL_GREEN: readonly [number, number, number] = [50, 160, 60];

/** Linear interpolation between two RGB tuples. */
export function lerpRgb(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export const buildSpeedColors: readonly string[] = (() => {
  const lookup = Array.from<string>({ length: SPEED_LUT_MAX + 1 });
  for (let i = 0; i <= SPEED_LUT_MAX; i++) {
    let r: number, g: number, b: number;
    if (i <= 30) {
      // 0-30: dull red → dull yellow
      const t = i / 30;
      [r, g, b] = lerpRgb(DULL_RED, DULL_YELLOW, t);
    } else if (i <= 50) {
      // 30-50: dull yellow → dull blue
      const t = (i - 30) / 20;
      [r, g, b] = lerpRgb(DULL_YELLOW, DULL_BLUE, t);
    } else if (i <= 100) {
      // 50-100: dull blue → dull cyan
      const t = (i - 50) / 50;
      [r, g, b] = lerpRgb(DULL_BLUE, DULL_CYAN, t);
    } else if (i <= 150) {
      // 100-150: dull cyan → dull green
      const t = (i - 100) / 50;
      [r, g, b] = lerpRgb(DULL_CYAN, DULL_GREEN, t);
    } else {
      // 150+: dull green plateau
      [r, g, b] = DULL_GREEN;
    }
    lookup[i] = `\x1b[38;2;${r};${g};${b}m`;
  }
  return lookup;
})();

/** Clamp a value to the speed color LUT range [0, SPEED_LUT_MAX] and look up the ANSI color escape. */
export function lookupSpeedColor(value: number): string {
  const idx = Math.max(0, Math.min(SPEED_LUT_MAX, Math.round(value)));
  return buildSpeedColors[idx] ?? "";
}
