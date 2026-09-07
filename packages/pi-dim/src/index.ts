import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { state } from "./state.js";
import {
  saveThemeOriginals,
  patchThemeAnsi,
  patchThemeChrome,
  restoreTheme,
  clearSavedTheme,
  resolveTheme,
} from "./theme-patch.js";
import { wrapEditorRender, restoreEditorRender, rerenderTui } from "./editor.js";
import { installStdoutDim, uninstallStdoutDim } from "./stdout-dim.js";

function rememberCtx(ctx: ExtensionContext | undefined) {
  if (ctx && ctx.mode === "tui") state.ctxRef = ctx;
}

function ensureTuiCapture(ctx: ExtensionContext) {
  if (state.tuiCaptureRegistered) return;
  state.tuiCaptureRegistered = true;
  ctx.ui.setWidget("__dim-screen-tui-capture", (tui: TUI) => {
    state.tuiRef = tui;
    return {
      render: () => [],
      invalidate: () => {},
      dispose: () => {
        if (state.tuiRef === tui) state.tuiRef = undefined;
        state.tuiCaptureRegistered = false;
      },
    };
  });
}

function applyDim(ctx: ExtensionContext) {
  if (!state.dimEnabled || state.dimActive) return;
  if (ctx.mode !== "tui") return;
  const theme = resolveTheme(ctx);
  if (!theme || theme.__dimPatched) return;
  const originals = saveThemeOriginals(theme);
  patchThemeAnsi(theme, originals);
  patchThemeChrome(theme, originals);
  state.patchedTheme = theme;
  wrapEditorRender();
  installStdoutDim();
  state.dimActive = true;
  rerenderTui();
}

function clearDim(callerCtx?: ExtensionContext) {
  if (!state.dimActive) return;
  rememberCtx(callerCtx);
  const theme = state.patchedTheme ?? resolveTheme(callerCtx);
  if (theme) restoreTheme(theme);
  restoreEditorRender();
  state.dimActive = false;
  clearSavedTheme();
  uninstallStdoutDim();
  rerenderTui();
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("dim", {
    description: "Enable dim while agent is running",
    handler: async (_args, ctx) => {
      rememberCtx(ctx);
      state.dimEnabled = true;
      if (!state.dimActive && !state.promptActive) {
        const idle = ctx?.isIdle() ?? state.ctxRef?.isIdle() ?? true;
        if (!idle) {
          const c = ctx.mode === "tui" ? ctx : (state.ctxRef ?? ctx);
          applyDim(c);
        }
      }
    },
  });

  pi.registerCommand("undim", {
    description: "Disable dim while agent is running",
    handler: async (_args, ctx) => {
      rememberCtx(ctx);
      state.dimEnabled = false;
      clearDim(ctx);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    rememberCtx(ctx);
    if (ctx.mode === "tui") ensureTuiCapture(ctx);
    if (state.dimActive) clearDim(ctx);
  });

  pi.on("agent_start", async (_event, ctx) => {
    rememberCtx(ctx);
    if (ctx.mode === "tui") ensureTuiCapture(ctx);
    applyDim(ctx);
  });

  pi.on("agent_settled", async (_event, ctx) => {
    clearDim(ctx);
  });

  type UiPromptSubscribe = {
    on(
      event: "ui_prompt_start" | "ui_prompt_end",
      handler: (event: { type: string }, ctx: ExtensionContext) => void | Promise<void>,
    ): void;
  };
  const uiPromptPi = pi as unknown as UiPromptSubscribe;
  uiPromptPi.on("ui_prompt_start", async (_event, ctx) => {
    state.promptActive = true;
    clearDim(ctx);
  });

  uiPromptPi.on("ui_prompt_end", async (_event, ctx) => {
    state.promptActive = false;
    rememberCtx(ctx);
    const idle = ctx?.isIdle() ?? state.ctxRef?.isIdle() ?? true;
    if (!idle && state.dimEnabled && !state.dimActive) {
      const c = ctx ?? state.ctxRef;
      if (c) applyDim(c);
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    clearDim(ctx);
    const cleanupCtx = ctx.mode === "tui" ? ctx : state.ctxRef;
    if (cleanupCtx) cleanupCtx.ui.setWidget("__dim-screen-tui-capture", undefined);
    state.tuiRef = undefined;
    state.ctxRef = undefined;
  });
}
