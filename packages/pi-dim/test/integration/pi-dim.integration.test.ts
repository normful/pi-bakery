import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.setConfig({ testTimeout: 15000 });
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { state } from "../../src/state.js";
import { __dimScreenTest } from "../../src/dim.js";
import { EDITOR_TAG, FAINT_ON, INVISIBLE_FG, INVISIBLE_BG, RESET_ALL } from "../../src/ansi.js";
import { findEditor, wrapEditorRender, restoreEditorRender } from "../../src/editor.js";
import { maybeMigrateTheme } from "../../src/theme-patch.js";
import { installStdoutDim, uninstallStdoutDim } from "../../src/stdout-dim.js";
import piDimFactory from "../../src/index.js";
import { createHarness, loadThemeModule, THEME_KEY } from "./harness.js";

const { dimStdoutText } = __dimScreenTest;
const ESC = String.fromCharCode(27);

/**
 * Integration tests for pi-dim (Groups A–D).
 *
 * The extension keeps module-singleton state (state.ts) and touches
 * process-global resources (patched theme methods, wrapped
 * process.stdout.write), so everything lives in this one file — vitest
 * isolates modules per file — with a strict reset in afterEach.
 */

function resetDimState(): void {
  state.dimEnabled = true;
  state.dimActive = false;
  state.originalsByTheme.clear();
  state.patchedTheme = undefined;
  state.savedStdoutWrite = undefined;
  state.stdoutCarry = "";
  state.tuiRef = undefined;
  state.ctxRef = undefined;
  state.tuiCaptureRegistered = false;
  state.promptActive = false;
  state.wrapRetryTick = 0;
  state.patchedEditor = undefined;
  state.savedEditorRender = undefined;
}

beforeEach(() => {
  resetDimState();
});

const initialGlobalTheme = saveGlobalTheme();

afterEach(() => {
  // Force-clear process-global side effects even if a test failed mid-dim.
  try {
    uninstallStdoutDim();
  } catch {}
  resetDimState();
  restoreGlobalTheme(initialGlobalTheme);
  vi.restoreAllMocks();
});

// --- shared fakes ---

type CommandHandler = (args: string, ctx: never) => Promise<void> | void;
type EventHandler = (event: unknown, ctx: never) => Promise<void> | void;

function createFakePi() {
  const commands = new Map<string, { handler: CommandHandler }>();
  const handlers = new Map<string, EventHandler[]>();
  const pi = {
    registerCommand: (name: string, opts: { handler: CommandHandler }) => {
      commands.set(name, opts);
    },
    on: (event: string, handler: EventHandler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
  };
  return { pi, commands, handlers };
}

async function emit(
  handlers: Map<string, EventHandler[]>,
  event: string,
  ctx: never,
): Promise<void> {
  for (const h of handlers.get(event) ?? []) await h({}, ctx);
}

function fakeCtx(theme: Theme, idle = true) {
  const widgetCalls: Array<{ key: string; content: unknown }> = [];
  const ctx = {
    mode: "tui",
    ui: {
      theme,
      setWidget: (key: string, content: unknown) => {
        widgetCalls.push({ key, content });
      },
    },
    isIdle: () => idle,
  } as never;
  return { ctx, widgetCalls };
}

function freshTheme(): Theme {
  const mod = loadThemeModule();
  const theme = mod.getThemeByName(mod.getDefaultTheme());
  if (!theme) throw new Error("could not load the default built-in theme for tests");
  return theme;
}

/** Snapshot observable theme behavior for byte-identical restore assertions. */
function snapshotTheme(theme: Theme) {
  return {
    fgMdCode: theme.fg("mdCode", "hi"),
    fgText: theme.fg("text", "hi"),
    fgAccent: theme.fg("accent", "hi"),
    fgSuccess: theme.fg("success", "hi"),
    bgSelected: theme.bg("selectedBg", "hi"),
    bold: theme.bold("hi"),
    italic: theme.italic("hi"),
    underline: theme.underline("hi"),
    inverse: theme.inverse("hi"),
    strikethrough: theme.strikethrough("hi"),
    fgAnsiMdCode: theme.getFgAnsi("mdCode"),
    fgAnsiText: theme.getFgAnsi("text"),
    bgAnsiSelected: theme.getBgAnsi("selectedBg"),
  };
}

/** Records every dimActive transition for the duration of fn. */
function recordDimActive() {
  const values: boolean[] = [];
  let current = state.dimActive;
  Object.defineProperty(state, "dimActive", {
    configurable: true,
    get: () => current,
    set: (v: boolean) => {
      values.push(v);
      current = v;
    },
  });
  return {
    values,
    restore: () => {
      Object.defineProperty(state, "dimActive", {
        configurable: true,
        writable: true,
        value: current,
      });
    },
  };
}

function saveGlobalTheme(): unknown {
  return (globalThis as unknown as Record<symbol, unknown>)[THEME_KEY];
}

function restoreGlobalTheme(prev: unknown): void {
  (globalThis as unknown as Record<symbol, unknown>)[THEME_KEY] = prev;
}

// --- Group A: lifecycle through the real runner ---

describe("integration: lifecycle through real runner (Group A)", () => {
  it("dims mid-turn and clears after agent_settled, restoring stdout", async () => {
    const h = await createHarness({ mode: "tui" });
    try {
      const rec = recordDimActive();
      try {
        h.faux.setResponses([fauxAssistantMessage("ok")]);
        await h.session.prompt("hello");
        // agent_start -> dim on, agent_settled -> dim off, nothing else flips it.
        expect(rec.values).toEqual([true, false]);
        expect(state.dimActive).toBe(false);
        // Uninstall restores a bound copy of the pre-turn write, so assert
        // behaviorally: wrapper released, post-turn output verbatim.
        expect(state.savedStdoutWrite).toBeUndefined();
        const probe: string[] = [];
        const currentWrite = process.stdout.write;
        (process.stdout as unknown as { write: typeof process.stdout.write }).write = ((
          chunk: string | Uint8Array,
        ) => {
          probe.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("binary"));
          return true;
        }) as typeof process.stdout.write;
        try {
          process.stdout.write(`hi${RESET_ALL}there`);
        } finally {
          process.stdout.write = currentWrite;
        }
        expect(probe.join("")).toBe(`hi${RESET_ALL}there`);
      } finally {
        rec.restore();
      }
    } finally {
      h.cleanup();
    }
  });

  it("print mode never dims", async () => {
    const h = await createHarness({ mode: "print" });
    try {
      const rec = recordDimActive();
      try {
        h.faux.setResponses([fauxAssistantMessage("ok")]);
        await h.session.prompt("hello");
        expect(rec.values).toEqual([]);
        expect(state.dimActive).toBe(false);
      } finally {
        rec.restore();
      }
    } finally {
      h.cleanup();
    }
  });
});

describe("integration: commands and shutdown wiring (Group A)", () => {
  it("registers /dim and /undim (replacing v13 /dim-toggle)", async () => {
    const { pi, commands } = createFakePi();
    (piDimFactory as (pi: unknown) => void)(pi as never);
    expect([...commands.keys()].sort()).toEqual(["dim", "undim"]);
  });

  it("/dim enables without applying while idle; applies mid-run", async () => {
    const theme = freshTheme();
    const before = snapshotTheme(theme);
    const { pi, commands } = createFakePi();
    (piDimFactory as (pi: unknown) => void)(pi as never);

    const idle = fakeCtx(theme, true);
    await commands.get("dim")!.handler("", idle.ctx as never);
    expect(state.dimEnabled).toBe(true);
    expect(state.dimActive).toBe(false);

    const running = fakeCtx(theme, false);
    await commands.get("dim")!.handler("", running.ctx as never);
    expect(state.dimActive).toBe(true);
    expect(theme.fg("mdCode", "hi")).not.toBe(before.fgMdCode);

    await commands.get("undim")!.handler("", running.ctx as never);
    expect(state.dimEnabled).toBe(false);
    expect(state.dimActive).toBe(false);
    expect(snapshotTheme(theme)).toEqual(before);
  });

  it("/dim stays off mid-run while a prompt is active, re-applies on prompt end", async () => {
    const theme = freshTheme();
    const { pi, commands, handlers } = createFakePi();
    (piDimFactory as (pi: unknown) => void)(pi as never);
    const running = fakeCtx(theme, false);

    await emit(handlers, "ui_prompt_start", running.ctx as never);
    await commands.get("dim")!.handler("", running.ctx as never);
    expect(state.dimActive).toBe(false);

    await emit(handlers, "ui_prompt_end", running.ctx as never);
    expect(state.dimActive).toBe(true);

    await emit(handlers, "agent_settled", running.ctx as never);
    expect(state.dimActive).toBe(false);
  });

  it("session_shutdown clears dim, unregisters the widget, and drops refs", async () => {
    const theme = freshTheme();
    const { pi, handlers } = createFakePi();
    (piDimFactory as (pi: unknown) => void)(pi as never);
    const running = fakeCtx(theme, false);

    await emit(handlers, "agent_start", running.ctx as never);
    expect(state.dimActive).toBe(true);

    await emit(handlers, "session_shutdown", running.ctx as never);
    expect(state.dimActive).toBe(false);
    expect(running.widgetCalls.at(-1)).toEqual({
      key: "__dim-screen-tui-capture",
      content: undefined,
    });
    expect(state.tuiRef).toBeUndefined();
    expect(state.ctxRef).toBeUndefined();
  });
});

// --- Group B: theme fidelity on a real Theme ---

describe("integration: theme fidelity on a real Theme (Group B)", () => {
  it("patches non-editor lanes faint+invisible, keeps editor bright, restores byte-identical", async () => {
    const prev = saveGlobalTheme();
    restoreGlobalTheme(undefined);
    try {
      const theme = freshTheme();
      const before = snapshotTheme(theme);
      const { pi, handlers } = createFakePi();
      (piDimFactory as (pi: unknown) => void)(pi as never);
      const { ctx } = fakeCtx(theme, false);

      await emit(handlers, "agent_start", ctx as never);
      expect(state.dimActive).toBe(true);

      const dimmed = theme.fg("mdCode", "hi");
      expect(dimmed).toContain(FAINT_ON);
      expect(dimmed).toContain(INVISIBLE_FG);
      expect(dimmed).not.toBe(before.fgMdCode);
      // Editor lanes stay bright.
      expect(theme.fg("text", "hi")).toBe(before.fgText);
      expect(theme.fg("accent", "hi")).toBe(before.fgAccent);
      expect(theme.getFgAnsi("text")).toBe(before.fgAnsiText);
      expect(theme.getFgAnsi("mdCode")).toBe(INVISIBLE_FG);
      expect(theme.getBgAnsi("selectedBg")).toBe(INVISIBLE_BG);

      await emit(handlers, "agent_settled", ctx as never);
      expect(state.dimActive).toBe(false);
      // Byte-identical restore: same observable outputs, patch flag cleared.
      // (Method identity is not asserted: restore installs bound copies of
      // the originals, which behave identically.)
      expect(snapshotTheme(theme)).toEqual(before);
      expect((theme as unknown as { __dimPatched?: boolean }).__dimPatched).toBeUndefined();
    } finally {
      restoreGlobalTheme(prev);
    }
  });

  it("mid-dim theme swap migrates the patch; the active theme restores cleanly", async () => {
    const prev = saveGlobalTheme();
    try {
      const mod = loadThemeModule();
      const t1 = mod.getThemeByName(mod.getDefaultTheme());
      const t2 = mod.getThemeByName(mod.getDefaultTheme());
      if (!t1 || !t2) throw new Error("could not load built-in themes");
      expect(t1).not.toBe(t2);
      const before2 = snapshotTheme(t2);

      mod.setThemeInstance(t1);
      const { pi, handlers } = createFakePi();
      (piDimFactory as (pi: unknown) => void)(pi as never);
      const { ctx } = fakeCtx(t1, false);

      await emit(handlers, "agent_start", ctx as never);
      expect(themeIsDimmed(t1)).toBe(true);

      // Mid-dim /theme swap, then the stdout write path migrates the patch.
      mod.setThemeInstance(t2);
      maybeMigrateTheme();
      expect(state.patchedTheme).toBe(t2 as never);
      expect(themeIsDimmed(t2)).toBe(true);

      await emit(handlers, "agent_settled", ctx as never);
      expect(snapshotTheme(t2)).toEqual(before2);
      expect(state.patchedTheme).toBeUndefined();
      expect(state.originalsByTheme.size).toBe(0);
      // The abandoned theme keeps its patched methods: clearDim restores only
      // the active theme and then discards all saved originals. This mirrors
      // v13 and is harmless — the theme is no longer active.
      expect(themeIsDimmed(t1)).toBe(true);
    } finally {
      restoreGlobalTheme(prev);
    }
  });

  function themeIsDimmed(theme: Theme): boolean {
    return theme.getFgAnsi("mdCode") === INVISIBLE_FG;
  }
});

// --- Group C: stdout lane end-to-end ---

describe("integration: stdout lane end-to-end (Group C)", () => {
  function stubStdout() {
    const recorded: string[] = [];
    let callbacks = 0;
    const origWrite = process.stdout.write;
    (process.stdout as unknown as { write: typeof process.stdout.write }).write = ((
      chunk: string | Uint8Array,
      ...args: unknown[]
    ) => {
      const cb = args.find((a) => typeof a === "function") as (() => void) | undefined;
      if (cb) {
        callbacks += 1;
        cb();
      }
      recorded.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("binary"));
      return true;
    }) as typeof process.stdout.write;
    return {
      recorded,
      callbacks: () => callbacks,
      origWrite,
      restore: () => {
        process.stdout.write = origWrite;
      },
    };
  }

  it("mid-escape splits rejoin losslessly; binary passes through; uninstall flushes carry", () => {
    const stub = stubStdout();
    try {
      state.dimActive = true;
      installStdoutDim();

      const sgr = `${ESC}[38;2;255;0;0m`;
      const whole = `hello${sgr}world`;
      const cut = `hello${ESC}[38;2`.length;
      process.stdout.write(whole.slice(0, cut)); // split mid-escape
      process.stdout.write(whole.slice(cut));

      process.stdout.write(`pre${ESC}_di`); // split mid-tag
      process.stdout.write("m:e" + String.fromCharCode(7) + "tagged");

      const bin = new Uint8Array([0, 255, 1, 2, 3]);
      process.stdout.write(bin);

      process.stdout.write(`tail${ESC}[3`); // trailing partial held as carry
      uninstallStdoutDim();
      state.dimActive = false;

      const expected =
        // Split mid-escape seals "hello" in its own segment; the rejoined
        // escape opens the next one. No bytes lost, SGR stays valid.
        dimStdoutText("hello") +
        dimStdoutText(`${ESC}[38;2;255;0;0mworld`) +
        // "pre" was already emitted dimmed in the first chunk, before the tag
        // existed; the completed tag then passes "tagged" through bright.
        dimStdoutText("pre") +
        `${RESET_ALL}tagged` +
        Buffer.from(bin).toString("binary") +
        dimStdoutText("tail") +
        `${ESC}[3`;
      expect(stub.recorded.join("")).toBe(expected);
      // Uninstall restores a bound copy of the pre-install write, so assert
      // behaviorally: the wrapper released the stream.
      expect(state.savedStdoutWrite).toBeUndefined();
    } finally {
      stub.restore();
    }
  });

  it("write callback fires exactly once through the wrapper", () => {
    const stub = stubStdout();
    try {
      state.dimActive = true;
      installStdoutDim();
      process.stdout.write("x", () => {});
      uninstallStdoutDim();
      state.dimActive = false;
      expect(stub.callbacks()).toBe(1);
      expect(stub.recorded.join("")).toBe(dimStdoutText("x"));
    } finally {
      stub.restore();
    }
  });
});

// --- Group D: editor discovery ---

describe("integration: editor discovery (Group D)", () => {
  function makeEditor(lines = ["code line"]) {
    return {
      render: (_width: number) => [...lines],
      getText: () => lines.join("\n"),
      borderColor: "accent",
    };
  }

  it("captures the TUI through the runner-registered widget factory", async () => {
    const h = await createHarness({ mode: "tui" });
    try {
      h.faux.setResponses([fauxAssistantMessage("ok")]);
      await h.session.prompt("hello");
      const cap = h.widgetCalls.find((c) => c.key === "__dim-screen-tui-capture");
      expect(cap).toBeDefined();
      expect(typeof cap!.content).toBe("function");

      const editor = makeEditor();
      const fakeTui = { invalidate: () => {}, requestRender: () => {}, children: [editor] };
      const component = (
        cap!.content as (tui: unknown, theme: unknown) => { dispose?: () => void }
      )(fakeTui, h.theme);
      expect(state.tuiRef).toBe(fakeTui as never);
      component.dispose?.();
      expect(state.tuiRef).toBeUndefined();
    } finally {
      h.cleanup();
    }
  });

  it("findEditor walks children, mounted roots, and layout roots; cycles terminate", () => {
    const editor = makeEditor();
    expect(findEditor({ children: [{ children: [editor] }] })).toBe(editor);
    expect(findEditor({ getMountedRoots: () => [{ layoutRoot: { editor } }] })).toBe(editor);
    expect(findEditor({ children: [{ render: 1 }] })).toBeUndefined();
    const cyclic: { children: unknown[] } = { children: [] };
    cyclic.children.push(cyclic);
    expect(findEditor(cyclic)).toBeUndefined();
  });

  it("wrapEditorRender tags lines bright; restore puts the original render back", () => {
    const editor = makeEditor(["a", "b"]);
    state.tuiRef = { children: [editor] } as never;
    wrapEditorRender();
    const wrappedRender = editor.render;
    expect(editor.render(80)).toEqual([`${RESET_ALL}${EDITOR_TAG}a`, `${RESET_ALL}${EDITOR_TAG}b`]);
    restoreEditorRender();
    // Restore installs a bound copy of the original, so assert behaviorally:
    // output untagged again and the wrapper released.
    expect(editor.render).not.toBe(wrappedRender);
    expect(editor.render(80)).toEqual(["a", "b"]);
  });
});
