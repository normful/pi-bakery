import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { state } from "./state.js";
import { EDITOR_COLORS } from "./theme-colors.js";
import { wrapEditorRender } from "./editor.js";
import type { MutableTheme, ThemeOriginals } from "./state.js";
import {
  FAINT_ON,
  FAINT_OFF,
  FG_RESET,
  BG_RESET,
  INVISIBLE_FG,
  INVISIBLE_BG,
  LEADING_ANSI_RE,
  BG_RESET_RE,
} from "./ansi.js";

const THEME_KEY = Symbol.for("@earendil-works/pi-coding-agent:theme");

export function resolveTheme(fallbackCtx?: ExtensionContext): MutableTheme | undefined {
  // ctx.ui.theme is a Proxy that forwards reads to globalThis[THEME_KEY].
  // Patching the Proxy's target does nothing — must patch the underlying Theme instance.
  const underlying = (globalThis as unknown as Record<symbol, unknown>)[THEME_KEY] as unknown as
    | MutableTheme
    | undefined;
  const fromCtx = (fallbackCtx ?? state.ctxRef)?.ui.theme as unknown as MutableTheme | undefined;
  return underlying ?? fromCtx;
}

export function saveThemeOriginals(theme: MutableTheme): ThemeOriginals {
  const style = theme as unknown as {
    bold?: (t: string) => string;
    italic?: (t: string) => string;
    underline?: (t: string) => string;
    inverse?: (t: string) => string;
    strikethrough?: (t: string) => string;
    getFgAnsi?: (c: string) => string;
    getBgAnsi?: (c: string) => string;
  };
  const originals: ThemeOriginals = {
    fg: (theme.fg as unknown as (c: string, t: string) => string).bind(theme),
    bg: (theme.bg as unknown as (c: string, t: string) => string).bind(theme),
  };
  if (style.bold) originals.bold = style.bold.bind(theme);
  if (style.italic) originals.italic = style.italic.bind(theme);
  if (style.underline) originals.underline = style.underline.bind(theme);
  if (style.inverse) originals.inverse = style.inverse.bind(theme);
  if (style.strikethrough) originals.strikethrough = style.strikethrough.bind(theme);
  if (style.getFgAnsi) originals.getFgAnsi = style.getFgAnsi.bind(theme);
  if (style.getBgAnsi) originals.getBgAnsi = style.getBgAnsi.bind(theme);
  state.originalsByTheme.set(theme, originals);
  return originals;
}

export function patchThemeAnsi(theme: MutableTheme, originals: ThemeOriginals) {
  if (originals.getFgAnsi) {
    const originalGetFgAnsi = originals.getFgAnsi;
    theme.getFgAnsi = (color: string) => {
      if (EDITOR_COLORS.has(color)) return originalGetFgAnsi(color);
      return INVISIBLE_FG;
    };
  }
  if (originals.getBgAnsi) {
    const originalGetBgAnsi = originals.getBgAnsi;
    theme.getBgAnsi = (color: string) => {
      if (EDITOR_COLORS.has(color)) return originalGetBgAnsi(color);
      return INVISIBLE_BG;
    };
  }
}

export function patchThemeChrome(theme: MutableTheme, originals: ThemeOriginals) {
  const originalFg = originals.fg;
  theme.fg = (color: string, text: string) => {
    if (EDITOR_COLORS.has(color) && originalFg) {
      return originalFg(color, text);
    }
    return `${FAINT_ON}${INVISIBLE_FG}${text}${FAINT_OFF}${FG_RESET}`;
  };

  theme.bg = (color: string, text: string) => {
    if (EDITOR_COLORS.has(color)) {
      return originals.bg(color, text);
    }
    const base = originals.bg(color, text);
    const rest = base.replace(LEADING_ANSI_RE, "");
    // Global re-arm: a first-only replace leaked faint state after the
    // second bg reset in multi-span text. Seal fg too: a bg reset alone
    // does not clear the invisible fg, which would otherwise leak into
    // following text.
    return `${FAINT_ON}${INVISIBLE_FG}${INVISIBLE_BG}${rest.replace(BG_RESET_RE, `${BG_RESET}${FAINT_OFF}`)}${FG_RESET}`;
  };

  const originalBold = originals.bold;
  if (originalBold) {
    theme.bold = (text: string) =>
      `${FAINT_ON}${INVISIBLE_FG}${originalBold(text)}${FAINT_OFF}${FG_RESET}`;
  }
  const originalItalic = originals.italic;
  if (originalItalic) {
    theme.italic = (text: string) =>
      `${FAINT_ON}${INVISIBLE_FG}${originalItalic(text)}${FAINT_OFF}${FG_RESET}`;
  }
  const originalUnderline = originals.underline;
  if (originalUnderline) {
    theme.underline = (text: string) =>
      `${FAINT_ON}${INVISIBLE_FG}${originalUnderline(text)}${FAINT_OFF}${FG_RESET}`;
  }
  const originalInverse = originals.inverse;
  if (originalInverse) {
    theme.inverse = (text: string) =>
      `${FAINT_ON}${INVISIBLE_FG}${INVISIBLE_BG}${originalInverse(text)}${FAINT_OFF}${FG_RESET}${BG_RESET}`;
  }
  const originalStrikethrough = originals.strikethrough;
  if (originalStrikethrough) {
    theme.strikethrough = (text: string) =>
      `${FAINT_ON}${INVISIBLE_FG}${originalStrikethrough(text)}${FAINT_OFF}${FG_RESET}`;
  }
  theme.__dimPatched = true;
}

export function restoreTheme(theme: MutableTheme) {
  const originals = state.originalsByTheme.get(theme);
  if (!originals) {
    delete theme.__dimPatched;
    return;
  }
  theme.fg = originals.fg;
  theme.bg = originals.bg;
  if (originals.getFgAnsi) theme.getFgAnsi = originals.getFgAnsi;
  if (originals.getBgAnsi) theme.getBgAnsi = originals.getBgAnsi;
  if (originals.bold) theme.bold = originals.bold;
  if (originals.italic) theme.italic = originals.italic;
  if (originals.underline) theme.underline = originals.underline;
  if (originals.inverse) theme.inverse = originals.inverse;
  if (originals.strikethrough) theme.strikethrough = originals.strikethrough;
  delete theme.__dimPatched;
}

export function clearSavedTheme() {
  state.originalsByTheme.clear();
  state.patchedTheme = undefined;
}

export function maybeMigrateTheme(): void {
  if (!state.dimActive || !state.patchedTheme) return;
  const current = resolveTheme();
  if (!current || current === state.patchedTheme) return;
  if (state.originalsByTheme.has(current)) {
    state.patchedTheme = current;
    return;
  }
  if (current.__dimPatched) return;
  const fresh = saveThemeOriginals(current);
  patchThemeAnsi(current, fresh);
  patchThemeChrome(current, fresh);
  state.patchedTheme = current;
  wrapEditorRender();
}
