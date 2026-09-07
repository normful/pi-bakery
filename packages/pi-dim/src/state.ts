import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";

export type ThemeOriginals = {
  fg: (c: string, t: string) => string;
  bg: (c: string, t: string) => string;
  bold?: (t: string) => string;
  italic?: (t: string) => string;
  underline?: (t: string) => string;
  inverse?: (t: string) => string;
  strikethrough?: (t: string) => string;
  getFgAnsi?: (c: string) => string;
  getBgAnsi?: (c: string) => string;
};

export type ThemePatch = {
  fg: (color: string, text: string) => string;
  bg: (color: string, text: string) => string;
  getFgAnsi?: (color: string) => string;
  getBgAnsi?: (color: string) => string;
  bold?: (text: string) => string;
  italic?: (text: string) => string;
  underline?: (text: string) => string;
  inverse?: (text: string) => string;
  strikethrough?: (text: string) => string;
};

export type EditorLike = {
  render: (width: number) => string[];
  getText: () => string;
  borderColor: unknown;
};

export type MutableTheme = ThemePatch & Record<string, unknown> & { __dimPatched?: boolean };

export const state = {
  dimEnabled: true,
  dimActive: false,
  originalsByTheme: new Map<object, ThemeOriginals>(),
  patchedTheme: undefined as MutableTheme | undefined,
  savedStdoutWrite: undefined as typeof process.stdout.write | undefined,
  stdoutCarry: "",
  tuiRef: undefined as TUI | undefined,
  ctxRef: undefined as ExtensionContext | undefined,
  tuiCaptureRegistered: false,
  promptActive: false,
  wrapRetryTick: 0,
  patchedEditor: undefined as EditorLike | undefined,
  savedEditorRender: undefined as ((width: number) => string[]) | undefined,
};
