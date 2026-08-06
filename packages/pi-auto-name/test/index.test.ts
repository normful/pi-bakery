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
  setCfg: (cfg: Partial<Config>) => void;
  setSessionName: (name: string | undefined) => void;
  currentName: () => string | undefined;
  ctx: any;
}

function setup(): Harness {
  const handlers = new Map<string, (event: any, ctx: any) => Promise<unknown>>();
  let current: string | undefined;
  const pi = {
    on: vi.fn((event: string, handler: any) => handlers.set(event, handler)),
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
  it("subscribes to all lifecycle events and registers no manual command", () => {
    const { pi } = setup();
    const events = pi.on.mock.calls.map((c: string[]) => c[0]);
    expect(events).toContain("session_start");
    expect(events).toContain("input");
    expect(events).toContain("agent_settled");
    expect(events).toContain("session_info_changed");
    // turn_end / agent_end are not used — agent_settled is the sole turn boundary.
    expect(events).not.toContain("turn_end");
    expect(events).not.toContain("agent_end");
    expect(pi.registerCommand).toBeUndefined();
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
});

describe("renameOnce application", () => {
  it("applies the session name and syncs surfaces on success", async () => {
    const h = setup();
    await h.handlers.get("input")!({ source: "interactive", text: "Fix OAuth" }, h.ctx);
    expect(h.pi.setSessionName).toHaveBeenCalledWith("Fix the OAuth callback");
    expect(h.pi.exec).toHaveBeenCalled(); // surface sync (no-ops without env)
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
    // Fire-and-forget re-rename — must not block and must carry the UI budget.
    await h.handlers.get("agent_settled")!({}, h.ctx);
    await vi.waitFor(() => expect(mocks.generateNames).toHaveBeenCalledTimes(2));
    const lastCall = mocks.generateNames.mock.calls[mocks.generateNames.mock.calls.length - 1];
    // generateNames(ctx, cfg, context, titles, cwd, pi, options) — options carries the UI timeout.
    expect(lastCall[6]).toEqual({ timeoutMs: 10_000 });
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
