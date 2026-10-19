import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config } from "../src/config.js";
import type { NamingContext } from "../src/context.js";

// Controllable mocks for the heavy dependencies; index.ts imports them.
const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  buildContext: vi.fn(),
  generateNames: vi.fn(),
  collectExistingSessionNames: vi.fn(),
}));

vi.mock("../src/config.js", () => ({
  loadConfig: mocks.loadConfig,
  ConfigSchema: {},
}));
vi.mock("../src/context.js", () => ({ buildContext: mocks.buildContext }));
vi.mock("../src/naming.js", () => ({
  generateNames: mocks.generateNames,
  ENVIRONMENTAL_FAILURES: new Set(["missing_prompt", "missing_model", "missing_auth"]),
  UI_RENAME_TIMEOUT_MS: 10_000,
}));
vi.mock("../src/dedup.js", () => ({
  collectExistingSessionNames: mocks.collectExistingSessionNames,
}));

import extension from "../src/index.js";

function defaultCfg(): Config {
  return {
    enabled: true,
    surfaces: {
      renamePiSession: true,
      renameHerdrPane: true,
      renameHerdrTab: true,
      renameTmuxWindow: true,
      renameZellijPane: true,
      renameZellijTab: true,
    },
    initialRenameTrigger: "first-input",
    reRenameEveryNTurns: 0,
    replaceExistingName: "always",
    respectExternalRenames: true,
    namingStyle: "natural",
    namingCase: "title",
    namingInstructions: "",
    namingContextDepth: "recent-user-messages",
    skipSessionNameDedup: false,
    namingModel: "",
    language: "en",
    windowNameMaxLength: 40,
    sessionNameMaxLength: 200,
  } as Config;
}

const NAMING_CONTEXT: NamingContext = {
  firstUserMessage: "Fix the OAuth callback",
  recentUserMessages: [],
};

interface Harness {
  pi: any;
  handlers: Map<string, (event: any, ctx: any) => Promise<unknown>>;
  commands: Map<string, (args: string, ctx: any) => Promise<void>>;
  setCfg: (cfg: Partial<Config>) => void;
  setSessionName: (name: string | undefined) => void;
  currentName: () => string | undefined;
  ctx: any;
}

function setup(): Harness {
  const handlers = new Map<string, (event: any, ctx: any) => Promise<unknown>>();
  const commands = new Map<string, (args: string, ctx: any) => Promise<void>>();
  let current: string | undefined;
  const pi = {
    on: vi.fn((event: string, handler: any) => handlers.set(event, handler)),
    registerCommand: vi.fn((name: string, options: any) => commands.set(name, options.handler)),
    setSessionName: vi.fn((name: string) => {
      current = name;
    }),
    getSessionName: vi.fn(() => current),
    appendEntry: vi.fn(),
    registerEntryRenderer: vi.fn(),
    exec: vi.fn(async () => ({ stdout: "", stderr: "", code: 0, killed: false })),
  };
  const ctx = {
    cwd: "/project",
    hasUI: false,
    isIdle: vi.fn(() => true),
    ui: { notify: vi.fn() },
    sessionManager: {
      getEntries: () => [],
      getSessionFile: () => "/sessions/current.md",
    },
    signal: undefined,
  };
  mocks.loadConfig.mockReturnValue(defaultCfg());
  mocks.collectExistingSessionNames.mockResolvedValue([]);
  mocks.buildContext.mockReturnValue(NAMING_CONTEXT);
  mocks.generateNames.mockResolvedValue({
    ok: true,
    names: { windowName: "OAuth refresh", sessionName: "Fix the OAuth callback" },
  });
  extension(pi as any);
  return {
    pi,
    handlers,
    commands,
    ctx,
    setCfg: (overrides) => mocks.loadConfig.mockReturnValue({ ...defaultCfg(), ...overrides }),
    setSessionName: (name) => {
      current = name;
    },
    currentName: () => current,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extension registration", () => {
  it("subscribes to all lifecycle events and registers /rename", () => {
    const { pi } = setup();
    const events = pi.on.mock.calls.map((c: string[]) => c[0]);
    expect(events).toContain("session_start");
    expect(events).toContain("input");
    expect(events).toContain("agent_settled");
    expect(events).toContain("session_info_changed");
    expect(events).toContain("session_shutdown");
    // turn_end / agent_end are not used — agent_settled is the sole turn boundary.
    expect(events).not.toContain("turn_end");
    expect(events).not.toContain("agent_end");
    expect(pi.registerCommand).toHaveBeenCalledWith(
      "rename",
      expect.objectContaining({ handler: expect.any(Function) }),
    );
  });
});

describe("/rename command", () => {
  it("reuses the configured pipeline after automatic naming and on repeated invocations", async () => {
    const h = setup();
    h.setCfg({
      namingStyle: "slug",
      namingCase: "sentence",
      namingInstructions: "Mention OAuth.",
      namingModel: "provider/model",
      language: "de",
      namingContextDepth: "full-conversation",
      sessionNameMaxLength: 60,
      windowNameMaxLength: 20,
    });
    await h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    await h.commands.get("rename")!("", h.ctx);
    await h.commands.get("rename")!("", h.ctx);
    expect(mocks.generateNames).toHaveBeenCalledTimes(3);
    const [, cfg, context, titles, cwd, pi] = mocks.generateNames.mock.calls[2];
    expect(cfg).toMatchObject({
      namingStyle: "slug",
      namingCase: "sentence",
      namingInstructions: "Mention OAuth.",
      namingModel: "provider/model",
      language: "de",
      namingContextDepth: "full-conversation",
      sessionNameMaxLength: 60,
      windowNameMaxLength: 20,
    });
    expect(context).toBe(NAMING_CONTEXT);
    expect(titles).toEqual([]);
    expect(cwd).toBe("/project");
    expect(pi).toBe(h.pi);
    expect(mocks.buildContext).toHaveBeenLastCalledWith(h.ctx, cfg, undefined);
    expect(h.pi.setSessionName).toHaveBeenCalledTimes(3);
    expect(h.pi.appendEntry).toHaveBeenCalledWith(
      "pi-auto-name",
      expect.objectContaining({ sessionName: "Fix the OAuth callback" }),
    );
    expect(h.ctx.ui.notify).toHaveBeenLastCalledWith("Session naming completed.", "info");
  });

  it("uses the UI timeout and waits for completion", async () => {
    const h = setup();
    h.ctx.hasUI = true;
    await h.commands.get("rename")!("", h.ctx);
    expect(mocks.generateNames.mock.calls[0][6]).toMatchObject({ timeoutMs: 10_000 });
    expect(h.pi.setSessionName).toHaveBeenCalled();
  });

  it("rejects arguments instead of silently treating them as a name or instructions", async () => {
    const h = setup();
    await h.commands.get("rename")!("My chosen name", h.ctx);
    expect(mocks.generateNames).not.toHaveBeenCalled();
    expect(h.ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("/name"), "warning");
  });

  it("rejects a busy agent without consuming the initial rename", async () => {
    const h = setup();
    h.ctx.isIdle.mockReturnValue(false);
    await h.commands.get("rename")!("", h.ctx);
    expect(mocks.generateNames).not.toHaveBeenCalled();
    expect(h.ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("idle"), "warning");
    h.ctx.isIdle.mockReturnValue(true);
    await h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    expect(mocks.generateNames).toHaveBeenCalledTimes(1);
  });

  it("respects enabled: false", async () => {
    const h = setup();
    h.setCfg({ enabled: false });
    await h.commands.get("rename")!("", h.ctx);
    expect(mocks.generateNames).not.toHaveBeenCalled();
    expect(h.ctx.ui.notify).toHaveBeenCalledWith("pi-auto-name is disabled.", "warning");
  });

  it("respects replaceExistingName: never", async () => {
    const h = setup();
    h.setCfg({ replaceExistingName: "never" });
    h.setSessionName("Keep this name");
    await h.commands.get("rename")!("", h.ctx);
    expect(mocks.generateNames).not.toHaveBeenCalled();
    expect(h.currentName()).toBe("Keep this name");
    expect(h.ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("replaceExistingName"),
      "warning",
    );
  });

  it("preserves the external-rename lock", async () => {
    const h = setup();
    h.setSessionName("External name");
    await h.handlers.get("session_info_changed")!({ name: "External name" }, h.ctx);
    await h.commands.get("rename")!("", h.ctx);
    expect(mocks.generateNames).not.toHaveBeenCalled();
    expect(h.ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("locked"), "warning");
  });

  it("can rename an external name when respectExternalRenames is false", async () => {
    const h = setup();
    h.setCfg({ respectExternalRenames: false });
    h.setSessionName("External name");
    await h.handlers.get("session_info_changed")!({ name: "External name" }, h.ctx);
    await h.commands.get("rename")!("", h.ctx);
    expect(h.currentName()).toBe("Fix the OAuth callback");
  });

  it("reports missing context and leaves the initial rename armed", async () => {
    const h = setup();
    mocks.buildContext.mockReturnValueOnce(undefined);
    await h.commands.get("rename")!("", h.ctx);
    expect(h.ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("No conversation"),
      "warning",
    );
    await h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    expect(mocks.generateNames).toHaveBeenCalledTimes(1);
  });

  it("reports context failures without applying a name", async () => {
    const h = setup();
    mocks.buildContext.mockImplementationOnce(() => {
      throw new Error("unreadable");
    });
    await h.commands.get("rename")!("", h.ctx);
    expect(h.pi.setSessionName).not.toHaveBeenCalled();
    expect(h.ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("Could not read"),
      "warning",
    );
  });

  it("does not race another rename", async () => {
    const h = setup();
    let release!: (result: unknown) => void;
    mocks.generateNames.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const pending = h.commands.get("rename")!("", h.ctx);
    await vi.waitFor(() => expect(mocks.generateNames).toHaveBeenCalledTimes(1));
    await h.commands.get("rename")!("", h.ctx);
    expect(mocks.generateNames).toHaveBeenCalledTimes(1);
    expect(h.ctx.ui.notify).toHaveBeenCalledWith("A rename is already in progress.", "warning");
    release({ ok: true, names: { windowName: "W", sessionName: "S" } });
    await pending;
  });

  it("reports generation failure and permits a manual retry", async () => {
    const h = setup();
    mocks.generateNames.mockResolvedValueOnce({ ok: false, reason: "missing_model" });
    await h.commands.get("rename")!("", h.ctx);
    expect(h.ctx.ui.notify).toHaveBeenCalledWith(
      "Name generation failed: missing_model.",
      "warning",
    );
    expect(h.pi.setSessionName).not.toHaveBeenCalled();
    await h.commands.get("rename")!("", h.ctx);
    expect(h.pi.setSessionName).toHaveBeenCalledTimes(1);
  });

  it("reports unexpected failure and clears inflight for the next command", async () => {
    const h = setup();
    mocks.generateNames.mockRejectedValueOnce(new Error("provider failed"));
    await h.commands.get("rename")!("", h.ctx);
    expect(h.ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("Rename failed"), "error");
    await h.commands.get("rename")!("", h.ctx);
    expect(h.pi.setSessionName).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite a name changed during generation", async () => {
    const h = setup();
    mocks.generateNames.mockImplementationOnce(async () => {
      h.setSessionName("Changed while naming");
      return { ok: true, names: { windowName: "W", sessionName: "S" } };
    });
    await h.commands.get("rename")!("", h.ctx);
    expect(h.currentName()).toBe("Changed while naming");
    expect(h.pi.setSessionName).not.toHaveBeenCalled();
    expect(h.ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("changed during"),
      "warning",
    );
  });

  it("leaves automatic turn intervals unchanged", async () => {
    const h = setup();
    h.setCfg({ reRenameEveryNTurns: 2 });
    await h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    await h.handlers.get("agent_settled")!({}, h.ctx);
    await h.commands.get("rename")!("", h.ctx);
    expect(mocks.generateNames).toHaveBeenCalledTimes(2);
    await h.handlers.get("agent_settled")!({}, h.ctx);
    expect(mocks.generateNames).toHaveBeenCalledTimes(3);
    await h.handlers.get("input")!({ source: "interactive", text: "More context" }, h.ctx);
    expect(mocks.generateNames).toHaveBeenCalledTimes(3);
  });

  it("does not touch an already invalidated command context", async () => {
    const h = setup();
    await h.handlers.get("session_shutdown")!({}, h.ctx);
    const staleCtx = new Proxy(
      {},
      {
        get() {
          throw new Error("stale context");
        },
      },
    );
    await expect(h.commands.get("rename")!("", staleCtx)).resolves.toBeUndefined();
    expect(mocks.generateNames).not.toHaveBeenCalled();
  });

  it("does not apply names or notify a replaced session", async () => {
    const h = setup();
    let release!: (result: unknown) => void;
    mocks.generateNames.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    let stale = false;
    const guardedCtx = new Proxy(h.ctx, {
      get(target, key) {
        if (stale) throw new Error(`stale ctx.${String(key)}`);
        return target[key];
      },
    });
    const pending = h.commands.get("rename")!("", guardedCtx);
    await vi.waitFor(() => expect(mocks.generateNames).toHaveBeenCalledTimes(1));
    await h.handlers.get("session_shutdown")!({}, h.ctx);
    await h.handlers.get("session_start")!({ reason: "new" }, h.ctx);
    stale = true;
    release({ ok: true, names: { windowName: "Old", sessionName: "Old session" } });
    await expect(pending).resolves.toBeUndefined();
    expect(h.pi.setSessionName).not.toHaveBeenCalled();
    expect(h.ctx.ui.notify).not.toHaveBeenCalled();
    await h.commands.get("rename")!("", h.ctx);
    expect(h.currentName()).toBe("Fix the OAuth callback");
  });
});

describe("input trigger (first-input)", () => {
  it("generates a name on the first real user input", async () => {
    const h = setup();
    await h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    expect(mocks.generateNames).toHaveBeenCalledTimes(1);
    const [, cfg, context, titles, cwd, pi] = mocks.generateNames.mock.calls[0];
    expect(cfg.namingStyle).toBe("natural");
    expect(context).toBe(NAMING_CONTEXT);
    expect(titles).toEqual([]);
    expect(cwd).toBe("/project");
    expect(pi).toBe(h.pi);
  });

  it("ignores extension-injected inputs", async () => {
    const h = setup();
    await h.handlers.get("input")!({ source: "extension", text: "injected" }, h.ctx);
    expect(mocks.generateNames).not.toHaveBeenCalled();
  });

  it("ignores empty and whitespace-only inputs", async () => {
    const h = setup();
    await h.handlers.get("input")!({ source: "interactive", text: "   " }, h.ctx);
    expect(mocks.generateNames).not.toHaveBeenCalled();
  });

  it("ignores input when the trigger is first-agent-settled", async () => {
    const h = setup();
    h.setCfg({ initialRenameTrigger: "first-agent-settled" });
    await h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    expect(mocks.generateNames).not.toHaveBeenCalled();
  });

  it("is a no-op when the extension is disabled", async () => {
    const h = setup();
    h.setCfg({ enabled: false });
    await h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    expect(mocks.generateNames).not.toHaveBeenCalled();
  });

  it("only renames once (done latches after the first success)", async () => {
    const h = setup();
    await h.handlers.get("input")!({ source: "interactive", text: "first" }, h.ctx);
    await h.handlers.get("input")!({ source: "interactive", text: "second" }, h.ctx);
    expect(mocks.generateNames).toHaveBeenCalledTimes(1);
  });
});

describe("agent_settled trigger (first-agent-settled)", () => {
  it("generates a name after the first agent run settles", async () => {
    const h = setup();
    h.setCfg({ initialRenameTrigger: "first-agent-settled" });
    await h.handlers.get("agent_settled")!({}, h.ctx);
    expect(mocks.generateNames).toHaveBeenCalledTimes(1);
  });

  it("returns before UI naming generation settles", async () => {
    const h = setup();
    h.ctx.hasUI = true;
    h.setCfg({ initialRenameTrigger: "first-agent-settled" });
    let releaseGeneration!: (result: {
      ok: true;
      names: { windowName: string; sessionName: string };
    }) => void;
    let generationSettled = false;
    const generation = new Promise<{
      ok: true;
      names: { windowName: string; sessionName: string };
    }>((resolve) => {
      releaseGeneration = (result) => {
        generationSettled = true;
        resolve(result);
      };
    });
    mocks.generateNames.mockReturnValueOnce(generation);

    let handlerReturned = false;
    const settled = h.handlers.get("agent_settled")!({}, h.ctx).then(() => {
      handlerReturned = true;
    });
    try {
      await vi.waitFor(() => expect(mocks.generateNames).toHaveBeenCalledTimes(1));
      expect(handlerReturned).toBe(true);
      expect(generationSettled).toBe(false);
    } finally {
      releaseGeneration({ ok: true, names: { windowName: "W", sessionName: "S" } });
      await settled;
    }
  });

  it("awaits naming generation without a UI", async () => {
    const h = setup();
    h.setCfg({ initialRenameTrigger: "first-agent-settled" });
    let releaseGeneration!: (result: {
      ok: true;
      names: { windowName: string; sessionName: string };
    }) => void;
    let generationSettled = false;
    const generation = new Promise<{
      ok: true;
      names: { windowName: string; sessionName: string };
    }>((resolve) => {
      releaseGeneration = (result) => {
        generationSettled = true;
        resolve(result);
      };
    });
    mocks.generateNames.mockReturnValueOnce(generation);

    let handlerReturned = false;
    const settled = h.handlers.get("agent_settled")!({}, h.ctx).then(() => {
      handlerReturned = true;
    });
    await vi.waitFor(() => expect(mocks.generateNames).toHaveBeenCalledTimes(1));
    expect(handlerReturned).toBe(false);
    expect(generationSettled).toBe(false);

    releaseGeneration({ ok: true, names: { windowName: "W", sessionName: "S" } });
    await settled;
    expect(handlerReturned).toBe(true);
  });

  it("does not let deferred cleanup suppress naming in a replacement session", async () => {
    const h = setup();
    h.ctx.hasUI = true;
    h.setCfg({ initialRenameTrigger: "first-agent-settled" });
    let releaseGeneration!: (result: {
      ok: true;
      names: { windowName: string; sessionName: string };
    }) => void;
    const generation = new Promise<{
      ok: true;
      names: { windowName: string; sessionName: string };
    }>((resolve) => {
      releaseGeneration = resolve;
    });
    mocks.generateNames.mockReturnValueOnce(generation);

    const oldSettled = h.handlers.get("agent_settled")!({}, h.ctx);
    await vi.waitFor(() => expect(mocks.generateNames).toHaveBeenCalledTimes(1));
    await h.handlers.get("session_shutdown")!({ reason: "reload" }, h.ctx);
    await h.handlers.get("session_start")!({ reason: "new" }, h.ctx);

    releaseGeneration({ ok: true, names: { windowName: "W", sessionName: "S" } });
    await oldSettled;
    await h.handlers.get("agent_settled")!({}, h.ctx);
    await vi.waitFor(() => expect(mocks.generateNames).toHaveBeenCalledTimes(2));
  });

  it("ignores an event whose context is already stale after session shutdown", async () => {
    const h = setup();
    h.setCfg({ initialRenameTrigger: "first-agent-settled" });

    await h.handlers.get("session_shutdown")!({ reason: "reload" }, h.ctx);
    const staleCtx = new Proxy(
      {},
      {
        get(_target, key) {
          throw new Error(`stale ctx.${String(key)} accessed`);
        },
      },
    );

    await expect(h.handlers.get("agent_settled")!({}, staleCtx)).resolves.toBeUndefined();
    expect(mocks.generateNames).not.toHaveBeenCalled();
  });

  it("does not touch the event context when shutdown happens during config loading", async () => {
    const h = setup();
    h.setCfg({ initialRenameTrigger: "first-agent-settled" });

    let stale = false;
    const staleReads: string[] = [];
    const guardedCtx: Record<string, unknown> = {};
    for (const key of Object.keys(h.ctx)) {
      Object.defineProperty(guardedCtx, key, {
        enumerable: true,
        get() {
          if (stale) {
            staleReads.push(key);
            throw new Error(`stale ctx.${key} accessed`);
          }
          return h.ctx[key];
        },
      });
    }

    const pending = h.handlers.get("agent_settled")!({}, guardedCtx);
    await h.handlers.get("session_shutdown")!({ reason: "reload" }, h.ctx);
    stale = true;

    await expect(pending).resolves.toBeUndefined();
    expect(staleReads).toEqual([]);
    expect(mocks.generateNames).not.toHaveBeenCalled();
  });
});

describe("renameOnce application", () => {
  it("applies the session name and syncs surfaces on success", async () => {
    const h = setup();
    await h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    expect(h.pi.setSessionName).toHaveBeenCalledWith("Fix the OAuth callback");
    expect(h.pi.exec).toHaveBeenCalled(); // surface sync (no-ops without env)
  });

  it("aborts the apply when the session shuts down during generation", async () => {
    const h = setup();
    let releaseGeneration!: (result: {
      ok: true;
      names: { windowName: string; sessionName: string };
    }) => void;
    mocks.generateNames.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseGeneration = resolve;
      }),
    );

    const pending = h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    await vi.waitFor(() => expect(mocks.generateNames).toHaveBeenCalledTimes(1));
    await h.handlers.get("session_shutdown")!({ reason: "reload" }, h.ctx);
    releaseGeneration({ ok: true, names: { windowName: "W", sessionName: "S" } });

    await expect(pending).resolves.toBeUndefined();
    expect(h.pi.setSessionName).not.toHaveBeenCalled();
  });

  it("aborts the apply when the session name changed mid-generation (race guard)", async () => {
    const h = setup();
    mocks.generateNames.mockImplementationOnce(async () => {
      h.setSessionName("someone-else-renamed");
      return { ok: true, names: { windowName: "W", sessionName: "S" } };
    });
    await h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    expect(h.pi.setSessionName).not.toHaveBeenCalledWith("S");
    expect(h.currentName()).toBe("someone-else-renamed");
  });

  it("skips generation entirely when the current name is not replaceable", async () => {
    const h = setup();
    h.setCfg({ replaceExistingName: "never" });
    h.setSessionName("Deliberate Name");
    await h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    expect(mocks.generateNames).not.toHaveBeenCalled();
  });

  it("collects existing session names unless skipSessionNameDedup is set", async () => {
    const h = setup();
    await h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    expect(mocks.collectExistingSessionNames).toHaveBeenCalledWith(
      "/project",
      "/sessions/current.md",
    );

    mocks.collectExistingSessionNames.mockClear();
    h.setCfg({ skipSessionNameDedup: true });
    await h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    expect(mocks.collectExistingSessionNames).not.toHaveBeenCalled();
  });
});

describe("failure handling", () => {
  it("latches done on generation failure without setting a name or retrying", async () => {
    const h = setup();
    mocks.generateNames.mockResolvedValue({ ok: false, reason: "invalid_output" });
    await h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    expect(h.pi.setSessionName).not.toHaveBeenCalled();
    // latched: a second input does not retry
    await h.handlers.get("input")!({ source: "interactive", text: "more" }, h.ctx);
    expect(mocks.generateNames).toHaveBeenCalledTimes(1);
  });
});

describe("turn-interval re-rename", () => {
  it("re-renames every N settled turns after the initial rename", async () => {
    const h = setup();
    h.setCfg({ reRenameEveryNTurns: 2 });
    // Initial rename on the first input (first-input trigger).
    await h.handlers.get("input")!({ source: "interactive", text: "first" }, h.ctx);
    expect(mocks.generateNames).toHaveBeenCalledTimes(1);

    // agent_settled is one per user-facing turn; only every 2nd settles.
    await h.handlers.get("agent_settled")!({}, h.ctx); // settled 1 → count 1
    expect(mocks.generateNames).toHaveBeenCalledTimes(1);
    await h.handlers.get("agent_settled")!({}, h.ctx); // settled 2 → count 2 → re-rename
    expect(mocks.generateNames).toHaveBeenCalledTimes(2);
    await h.handlers.get("agent_settled")!({}, h.ctx); // settled 3 → count 3
    expect(mocks.generateNames).toHaveBeenCalledTimes(2);
    await h.handlers.get("agent_settled")!({}, h.ctx); // settled 4 → count 4 → re-rename
    expect(mocks.generateNames).toHaveBeenCalledTimes(3);
  });

  it("fire-and-forget re-rename passes the UI budget when a UI is present (non-blocking)", async () => {
    const h = setup();
    h.setCfg({ reRenameEveryNTurns: 1 });
    await h.handlers.get("input")!({ source: "interactive", text: "first" }, h.ctx); // headless initial
    expect(mocks.generateNames).toHaveBeenCalledTimes(1);

    h.ctx.hasUI = true;
    // Settled turn 1 belongs to the initial rename — no re-rename yet.
    await h.handlers.get("agent_settled")!({}, h.ctx);
    expect(mocks.generateNames).toHaveBeenCalledTimes(1);
    // Settled turn 2 hits the interval: fire-and-forget re-rename — must not
    // block and must carry the UI budget.
    await h.handlers.get("agent_settled")!({}, h.ctx);
    await vi.waitFor(() => expect(mocks.generateNames).toHaveBeenCalledTimes(2));
    const lastCall = mocks.generateNames.mock.calls[mocks.generateNames.mock.calls.length - 1];
    // generateNames(ctx, cfg, context, titles, cwd, pi, options) — options carries the UI timeout.
    expect(lastCall[6]).toEqual({ timeoutMs: 10_000 });
  });

  it("returns before UI interval naming generation settles", async () => {
    const h = setup();
    h.setCfg({ reRenameEveryNTurns: 1 });
    await h.handlers.get("input")!({ source: "interactive", text: "first" }, h.ctx);
    expect(mocks.generateNames).toHaveBeenCalledTimes(1);

    h.ctx.hasUI = true;
    // Settled turn 1 belongs to the initial rename — no re-rename yet.
    await h.handlers.get("agent_settled")!({}, h.ctx);
    expect(mocks.generateNames).toHaveBeenCalledTimes(1);

    let releaseGeneration!: (result: {
      ok: true;
      names: { windowName: string; sessionName: string };
    }) => void;
    let generationSettled = false;
    const generation = new Promise<{
      ok: true;
      names: { windowName: string; sessionName: string };
    }>((resolve) => {
      releaseGeneration = (result) => {
        generationSettled = true;
        resolve(result);
      };
    });
    mocks.generateNames.mockReturnValueOnce(generation);

    let handlerReturned = false;
    const settled = h.handlers.get("agent_settled")!({}, h.ctx).then(() => {
      handlerReturned = true;
    });
    try {
      await vi.waitFor(() => expect(mocks.generateNames).toHaveBeenCalledTimes(2));
      expect(handlerReturned).toBe(true);
      expect(generationSettled).toBe(false);
    } finally {
      releaseGeneration({ ok: true, names: { windowName: "W", sessionName: "S" } });
      await settled;
    }
  });

  it("is gated by done: the initial-settled rename wins on the first settle", async () => {
    const h = setup();
    // first-agent-settled: the initial rename fires at the first settle, and
    // re-rename only starts afterwards.
    h.setCfg({ initialRenameTrigger: "first-agent-settled", reRenameEveryNTurns: 1 });
    await h.handlers.get("input")!({ source: "interactive", text: "first" }, h.ctx);
    expect(mocks.generateNames).toHaveBeenCalledTimes(0); // input ignored for this trigger

    await h.handlers.get("agent_settled")!({}, h.ctx); // initial rename
    expect(mocks.generateNames).toHaveBeenCalledTimes(1);

    await h.handlers.get("agent_settled")!({}, h.ctx); // re-rename
    expect(mocks.generateNames).toHaveBeenCalledTimes(2);
  });
});

describe("session_info_changed", () => {
  it("ignores the echo of our own rename (no extra surface sync)", async () => {
    const h = setup();
    await h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    h.pi.exec.mockClear();
    await h.handlers.get("session_info_changed")!({ name: "Fix the OAuth callback" }, h.ctx);
    expect(h.pi.exec).not.toHaveBeenCalled();
  });

  it("syncs surfaces for external renames and latches the auto-rename lock", async () => {
    const h = setup();
    await h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    h.pi.exec.mockClear();
    await h.handlers.get("session_info_changed")!({ name: "User Picked Name" }, h.ctx);
    expect(h.pi.exec).toHaveBeenCalled(); // surface sync attempted

    // lock latched: subsequent settles never re-generate
    h.setCfg({ reRenameEveryNTurns: 1 });
    await h.handlers.get("agent_settled")!({}, h.ctx);
    const before = mocks.generateNames.mock.calls.length;
    await h.handlers.get("agent_settled")!({}, h.ctx);
    expect(mocks.generateNames.mock.calls.length).toBe(before);
  });
});

describe("session_start", () => {
  it("syncs surfaces to the current name and does not rename a deliberate name", async () => {
    const h = setup();
    h.setSessionName("Resumed Deliberate");
    await h.handlers.get("session_start")!({ reason: "resume" }, h.ctx);
    expect(mocks.generateNames).not.toHaveBeenCalled();
    // unnamed → no surface sync either (no window name to apply)
    h.setSessionName(undefined);
    h.pi.exec.mockClear();
    await h.handlers.get("session_start")!({ reason: "new" }, h.ctx);
    expect(h.pi.exec).not.toHaveBeenCalled();
  });
});
