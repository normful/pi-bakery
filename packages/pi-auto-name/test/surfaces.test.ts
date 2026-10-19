import { describe, it, expect, vi, afterAll } from "vitest";
import type { Config } from "../src/config.js";
import type { RenameState } from "../src/state.js";

// Env vars are captured at module scope, so set them before the static import.
const ORIG_ENV = vi.hoisted(() => ({
  herdr: process.env.HERDR_PANE_ID,
  herdrTab: process.env.HERDR_TAB_ID,
  tmux: process.env.TMUX,
  tmuxPane: process.env.TMUX_PANE,
  zellij: process.env.ZELLIJ_PANE_ID,
}));

vi.hoisted(() => {
  process.env.HERDR_PANE_ID = "pane-1";
  process.env.HERDR_TAB_ID = ""; // clear ambient env so tests exercise the pane-get path
  process.env.TMUX = "tmux";
  process.env.TMUX_PANE = "%3";
  process.env.ZELLIJ_PANE_ID = "2";
});

import { applySessionName, windowNameForSync, syncSurfaces } from "../src/surfaces.js";
import { ENTRY_TYPE } from "../src/state.js";

afterAll(() => {
  process.env.HERDR_PANE_ID = ORIG_ENV.herdr;
  process.env.HERDR_TAB_ID = ORIG_ENV.herdrTab;
  process.env.TMUX = ORIG_ENV.tmux;
  process.env.TMUX_PANE = ORIG_ENV.tmuxPane;
  process.env.ZELLIJ_PANE_ID = ORIG_ENV.zellij;
});

function mkConfig(
  overrides: Omit<Partial<Config>, "surfaces"> & { surfaces?: Partial<Config["surfaces"]> } = {},
): Config {
  return {
    surfaces: {
      renamePiSession: true,
      renameHerdrPane: true,
      renameHerdrTab: true,
      renameTmuxWindow: true,
      renameZellijPane: true,
      renameZellijTab: true,
    },
    replaceExistingName: "always",
    ...overrides,
  } as Config;
}

function mkState(): RenameState {
  return {
    done: false,
    inflight: false,
    lastAutoName: undefined,
    lastAutoWindowName: undefined,
    autoRenameLocked: false,
    turnsSeen: 0,
    nameAtGenerationStart: undefined,
  };
}

/** Queue of exec responses; each entry is matched by command + args prefix. */
function mkPi(execImpl: (command: string, args: string[]) => Promise<unknown> | unknown) {
  const exec = vi.fn(async (command: string, args: string[], options?: any) => {
    const result = await execImpl(command, args);
    return typeof result === "string"
      ? { stdout: result, stderr: "", code: 0, killed: false }
      : (result ?? { stdout: "", stderr: "", code: 0, killed: false });
  });
  const setSessionName = vi.fn();
  const getSessionName = vi.fn(() => "stored-session");
  const appendEntry = vi.fn();
  return {
    pi: { exec, setSessionName, getSessionName, appendEntry } as any,
    exec,
    setSessionName,
    getSessionName,
    appendEntry,
  };
}

const HERDR_PANE_JSON = JSON.stringify({
  pane: { pane_id: "pane-1", tab_id: "tab-9" }, // no label → default → rename allowed
});
const HERDR_TAB_JSON = JSON.stringify({ tab: { tab_id: "tab-9", label: "1", number: 1 } });
const ZELLIJ_PANES_JSON = JSON.stringify([{ id: 2, tab_id: 7 }]);

function fullSurfaceExec() {
  return vi.fn((command: string, args: string[]) => {
    if (command === "herdr" && args[0] === "pane" && args[1] === "get") return HERDR_PANE_JSON;
    if (command === "herdr" && args[0] === "tab" && args[1] === "get") return HERDR_TAB_JSON;
    if (command === "zellij" && args[0] === "action" && args[1] === "list-panes")
      return ZELLIJ_PANES_JSON;
    return { stdout: "", stderr: "", code: 0, killed: false };
  });
}

describe("applySessionName", () => {
  it("sets the session name and records provenance with the stored name", async () => {
    const { pi, setSessionName, getSessionName, appendEntry } = mkPi(() => {});
    const state = mkState();
    await applySessionName(pi, state, mkConfig(), "new-session", "New Window");

    expect(setSessionName).toHaveBeenCalledWith("new-session");
    expect(getSessionName).toHaveBeenCalled();
    expect(state.lastAutoName).toBe("stored-session"); // stored (normalized) name wins
    expect(state.lastAutoWindowName).toBe("New Window");
    const [customType, data] = appendEntry.mock.calls[0];
    expect(customType).toBe(ENTRY_TYPE);
    expect(data.sessionName).toBe("stored-session");
    expect(data.windowName).toBe("New Window");
  });

  it("falls back to the requested name when getSessionName is undefined", async () => {
    const { pi, appendEntry } = mkPi(() => {});
    pi.getSessionName = vi.fn(() => undefined);
    const state = mkState();
    await applySessionName(pi, state, mkConfig(), "new-session");

    expect(state.lastAutoName).toBe("new-session");
    const [, data] = appendEntry.mock.calls[0];
    expect(data.sessionName).toBe("new-session");
  });

  it("sets lastAutoName before setSessionName so a synchronous echo is recognized", async () => {
    const seenAtSet: (string | undefined)[] = [];
    const state = mkState();
    const pi = {
      setSessionName: vi.fn((name: string) => seenAtSet.push(state.lastAutoName)),
      getSessionName: vi.fn(() => "stored-session"),
      appendEntry: vi.fn(),
    } as any;
    await applySessionName(pi, state, mkConfig(), "new-session", "New Window");
    // A synchronous session_info_changed echo fired inside setSessionName would
    // read lastAutoName at this moment — it must already be our new name.
    expect(seenAtSet[0]).toBe("new-session");
  });

  it("does nothing to the session when renamePiSession is false (no rename, no provenance)", async () => {
    const { pi, setSessionName, appendEntry } = mkPi(() => {});
    const state = mkState();
    await applySessionName(
      pi,
      state,
      mkConfig({ surfaces: { renamePiSession: false } }),
      "new-session",
      "Win",
    );

    expect(setSessionName).not.toHaveBeenCalled();
    expect(appendEntry).not.toHaveBeenCalled();
    expect(state.lastAutoName).toBeUndefined();
  });
});

describe("windowNameForSync", () => {
  it("reuses the stored window name when it matches the current session name", () => {
    const state = mkState();
    state.lastAutoName = "s";
    state.lastAutoWindowName = "Stored Window";
    expect(windowNameForSync(state, "s")).toBe("Stored Window");
  });

  it("compacts the session name when it differs from the stored one", () => {
    const state = mkState();
    state.lastAutoName = "other";
    state.lastAutoWindowName = "Stale Window";
    expect(windowNameForSync(state, "A brand new session name")).toBe("A brand new session");
  });

  it("falls back to the stored window name when no session name exists", () => {
    const state = mkState();
    state.lastAutoWindowName = "Fallback Window";
    expect(windowNameForSync(state, undefined)).toBe("Fallback Window");
  });
});

describe("syncSurfaces (herdr + tmux + zellij present)", () => {
  it("renames every enabled surface exactly once", async () => {
    const exec = fullSurfaceExec();
    const { pi } = mkPi(exec);
    await syncSurfaces(pi, mkConfig(), "My Window");

    const calls = exec.mock.calls.map((c) => [c[0], c[1]]);
    expect(calls).toContainEqual(["herdr", ["pane", "get", "pane-1"]]);
    expect(calls).toContainEqual(["herdr", ["pane", "rename", "pane-1", "My Window"]]);
    expect(calls).toContainEqual(["herdr", ["tab", "get", "tab-9"]]);
    expect(calls).toContainEqual(["herdr", ["tab", "rename", "tab-9", "My Window"]]);
    // tmux targets the pane directly — no window_id display-message lookup
    expect(calls).toContainEqual(["tmux", ["rename-window", "-t", "%3", "My Window"]]);
    expect(calls).not.toContainEqual([
      "tmux",
      ["display-message", "-p", "-t", "%3", "#{window_id}"],
    ]);
    expect(calls).toContainEqual(["zellij", ["action", "list-panes", "-j", "-t"]]);
    expect(calls).toContainEqual(["zellij", ["action", "rename-pane", "-p", "2", "My Window"]]);
    expect(calls).toContainEqual(["zellij", ["action", "rename-tab", "-t", "7", "My Window"]]);
  });

  it("does nothing when the window name is undefined", async () => {
    const exec = fullSurfaceExec();
    const { pi } = mkPi(exec);
    await syncSurfaces(pi, mkConfig(), undefined);
    expect(exec).not.toHaveBeenCalled();
  });

  it("respects per-surface enable flags", async () => {
    const exec = fullSurfaceExec();
    const { pi } = mkPi(exec);
    const cfg = mkConfig({
      surfaces: {
        renameHerdrPane: false,
        renameHerdrTab: false,
        renameTmuxWindow: true,
        renameZellijPane: true,
        renameZellijTab: true,
      },
    });
    await syncSurfaces(pi, cfg, "My Window");
    const commands = exec.mock.calls.map((c) => c[0]);
    expect(commands.filter((c) => c === "herdr")).toEqual([]);
    expect(commands).toContain("tmux");
    expect(commands).toContain("zellij");
  });

  it("honors replaceExistingName for herdr pane/tab: always renames, never preserves custom labels", async () => {
    const exec = vi.fn((command: string, args: string[]) => {
      if (command === "herdr" && args[0] === "pane" && args[1] === "get") {
        return JSON.stringify({ pane: { pane_id: "pane-1", label: "Custom", tab_id: "tab-9" } });
      }
      if (command === "herdr" && args[0] === "tab" && args[1] === "get") {
        return JSON.stringify({ tab: { tab_id: "tab-9", label: "Custom Tab", number: 1 } });
      }
      return { stdout: "", stderr: "", code: 0, killed: false };
    });
    const { pi } = mkPi(exec);
    // default (always) renames even custom labels
    await syncSurfaces(pi, mkConfig(), "My Window");
    expect(exec).toHaveBeenCalledWith("herdr", ["pane", "rename", "pane-1", "My Window"]);
    expect(exec).toHaveBeenCalledWith("herdr", ["tab", "rename", "tab-9", "My Window"]);

    // replaceExistingName: "never" preserves custom labels
    exec.mockClear();
    await syncSurfaces(pi, mkConfig({ replaceExistingName: "never" }), "My Window");
    expect(exec).not.toHaveBeenCalledWith("herdr", ["pane", "rename", "pane-1", "My Window"]);
    expect(exec).not.toHaveBeenCalledWith("herdr", ["tab", "rename", "tab-9", "My Window"]);
  });

  it("skips the zellij tab rename when the pane is gone, but still renames the pane", async () => {
    const exec = vi.fn((command: string, args: string[]) => {
      if (command === "zellij" && args[0] === "action" && args[1] === "list-panes") {
        return JSON.stringify([{ id: 99, tab_id: 3 }]); // our pane id 2 is gone
      }
      return { stdout: "", stderr: "", code: 0, killed: false };
    });
    const { pi } = mkPi(exec);
    await syncSurfaces(pi, mkConfig(), "My Window");
    expect(exec).toHaveBeenCalledWith("zellij", ["action", "rename-pane", "-p", "2", "My Window"]);
    expect(exec).not.toHaveBeenCalledWith("zellij", [
      "action",
      "rename-tab",
      "-t",
      "3",
      "My Window",
    ]);
  });

  it("swallows surface exec failures (non-fatal)", async () => {
    const exec = vi.fn(() => {
      throw new Error("herdr not installed");
    });
    const { pi } = mkPi(exec);
    await expect(syncSurfaces(pi, mkConfig(), "My Window")).resolves.toBeUndefined();
  });
});

describe("surfaces absent (no env)", () => {
  it("no-ops tmux/zellij and probes (then skips) herdr when env vars are missing", async () => {
    vi.stubEnv("HERDR_PANE_ID", "");
    vi.stubEnv("TMUX", "");
    vi.stubEnv("TMUX_PANE", "");
    vi.stubEnv("ZELLIJ_PANE_ID", "");
    vi.resetModules();
    const fresh = await import("../src/surfaces.js");

    const exec = vi.fn(async (command: string, args: string[]) => ({
      stdout: "",
      stderr: "",
      code: 0,
      killed: false,
    }));
    await fresh.syncSurfaces({ exec } as any, mkConfig(), "My Window");
    // herdr tries `pane current` even without HERDR_PANE_ID; the empty response
    // fails to parse and the rename is skipped. tmux/zellij are pure env guards.
    const calls = exec.mock.calls.map((c) => [c[0], c[1]] as [string, string[]]);
    expect(calls).toContainEqual(["herdr", ["pane", "current"]]);
    expect(calls.some((c) => c[0] === "tmux" || c[0] === "zellij")).toBe(false);
    expect(calls.some((c) => c[0] === "herdr" && c[1][0] === "rename")).toBe(false);
    vi.unstubAllEnvs();
  });

  it("resolves herdr ids via `herdr pane current` when HERDR_PANE_ID is missing", async () => {
    vi.stubEnv("HERDR_PANE_ID", "");
    vi.stubEnv("HERDR_TAB_ID", "");
    vi.resetModules();
    const fresh = await import("../src/surfaces.js");

    const exec = vi.fn((command: string, args: string[]): any => {
      if (command === "herdr" && args[0] === "pane" && args[1] === "current") {
        return {
          // the fallback trusts a pane only on positive ownership evidence
          stdout: JSON.stringify({
            result: {
              pane: {
                pane_id: "w44:p9",
                tab_id: "w44:t9",
                agent: "pi",
                cwd: process.cwd(),
              },
            },
          }),
          stderr: "",
          code: 0,
          killed: false,
        };
      }
      if (command === "herdr" && args[0] === "pane" && args[1] === "get") {
        return { stdout: HERDR_PANE_JSON, stderr: "", code: 0, killed: false };
      }
      if (command === "herdr" && args[0] === "tab" && args[1] === "get") {
        return { stdout: HERDR_TAB_JSON, stderr: "", code: 0, killed: false };
      }
      return { stdout: "", stderr: "", code: 0, killed: false };
    });
    await fresh.syncSurfaces({ exec } as any, mkConfig(), "My Window");
    const calls = exec.mock.calls.map((c) => [c[0], c[1]] as [string, string[]]);
    expect(calls).toContainEqual(["herdr", ["pane", "current"]]);
    expect(calls).toContainEqual(["herdr", ["pane", "rename", "w44:p9", "My Window"]]);
    expect(calls).toContainEqual(["herdr", ["tab", "rename", "w44:t9", "My Window"]]);
    vi.unstubAllEnvs();
  });
});

/** Exec mock that answers the `pane current` fallback; `pane` is the payload under `result.pane`. */
function herdrCurrentExec(pane: unknown) {
  return vi.fn((command: string, args: string[]) => {
    if (command === "herdr" && args[0] === "pane" && args[1] === "current") {
      return JSON.stringify({ result: { pane } });
    }
    if (command === "herdr" && args[0] === "pane" && args[1] === "get") return HERDR_PANE_JSON;
    if (command === "herdr" && args[0] === "tab" && args[1] === "get") return HERDR_TAB_JSON;
    return { stdout: "", stderr: "", code: 0, killed: false };
  });
}

/** Run one fallback sync with `HERDR_PANE_ID` unset and return the exec call list. */
async function fallbackCalls(pane: unknown, sessionFile?: string) {
  vi.stubEnv("HERDR_PANE_ID", "");
  vi.stubEnv("HERDR_TAB_ID", "");
  try {
    const exec = herdrCurrentExec(pane);
    const { pi } = mkPi(exec);
    await syncSurfaces(pi, mkConfig(), "My Window", sessionFile);
    return exec.mock.calls.map((c) => [c[0], c[1]] as [string, string[]]);
  } finally {
    vi.unstubAllEnvs();
  }
}

const PANE_RENAMED: [string, string[]] = ["herdr", ["pane", "rename", "w44:p9", "My Window"]];
const TAB_RENAMED: [string, string[]] = ["herdr", ["tab", "rename", "w44:t9", "My Window"]];

describe("syncSurfaces (herdr pane-current fallback ownership)", () => {
  it("renames when the focused pane hosts pi in this directory", async () => {
    const calls = await fallbackCalls({
      pane_id: "w44:p9",
      tab_id: "w44:t9",
      agent: "pi",
      cwd: process.cwd(),
    });
    expect(calls).toContainEqual(PANE_RENAMED);
    expect(calls).toContainEqual(TAB_RENAMED);
  });

  it("renames when the pane's cwd is spelled differently", async () => {
    const calls = await fallbackCalls({
      pane_id: "w44:p9",
      tab_id: "w44:t9",
      agent: "pi",
      cwd: `${process.cwd()}/`,
    });
    expect(calls).toContainEqual(PANE_RENAMED);
  });

  it("renames when only the foreground cwd matches", async () => {
    const calls = await fallbackCalls({
      pane_id: "w44:p9",
      tab_id: "w44:t9",
      agent: "pi",
      cwd: "/elsewhere",
      foreground_cwd: process.cwd(),
    });
    expect(calls).toContainEqual(PANE_RENAMED);
  });

  it("renames when the pane reports this session's transcript", async () => {
    const calls = await fallbackCalls(
      {
        pane_id: "w44:p9",
        tab_id: "w44:t9",
        agent_session: { kind: "path", value: "/sessions/ours.jsonl" },
      },
      "/sessions/ours.jsonl",
    );
    expect(calls).toContainEqual(PANE_RENAMED);
    expect(calls).toContainEqual(TAB_RENAMED);
  });

  it("skips a pane that hosts another agent", async () => {
    const calls = await fallbackCalls({
      pane_id: "w44:p9",
      tab_id: "w44:t9",
      agent: "codex",
      cwd: process.cwd(),
    });
    expect(calls).toContainEqual(["herdr", ["pane", "current"]]);
    expect(calls).not.toContainEqual(PANE_RENAMED);
    expect(calls).not.toContainEqual(TAB_RENAMED);
  });

  it("skips a pi pane in another directory", async () => {
    const calls = await fallbackCalls({
      pane_id: "w44:p9",
      tab_id: "w44:t9",
      agent: "pi",
      cwd: "/elsewhere",
    });
    expect(calls).not.toContainEqual(PANE_RENAMED);
    expect(calls).not.toContainEqual(TAB_RENAMED);
  });

  it("skips a pi pane that reports another pi session", async () => {
    const calls = await fallbackCalls(
      {
        pane_id: "w44:p9",
        tab_id: "w44:t9",
        agent: "pi",
        cwd: process.cwd(),
        agent_session: {
          agent: "pi",
          kind: "path",
          source: "herdr:pi",
          value: "/sessions/other.jsonl",
        },
      },
      "/sessions/ours.jsonl",
    );
    expect(calls).not.toContainEqual(PANE_RENAMED);
    expect(calls).not.toContainEqual(TAB_RENAMED);
  });

  it("skips a payload without agent and cwd", async () => {
    const calls = await fallbackCalls({ pane_id: "w44:p9", tab_id: "w44:t9" });
    expect(calls).toContainEqual(["herdr", ["pane", "current"]]);
    expect(calls).not.toContainEqual(PANE_RENAMED);
    expect(calls).not.toContainEqual(TAB_RENAMED);
  });

  it("logs the refusal with the observed pane fields", async () => {
    vi.stubEnv("HERDR_PANE_ID", "");
    vi.stubEnv("HERDR_TAB_ID", "");
    vi.stubEnv("PI_AUTO_NAME_DEBUG", "1");
    vi.resetModules();
    const { syncSurfaces: freshSyncSurfaces } = await import("../src/surfaces.js");
    const { initDebug } = await import("../src/debug.js");
    const exec = herdrCurrentExec({
      pane_id: "w44:p9",
      tab_id: "w44:t9",
      agent: "codex",
      cwd: "/elsewhere",
    });
    const { pi, appendEntry } = mkPi(exec);
    pi.registerEntryRenderer = vi.fn(); // debug() registers its renderer lazily
    initDebug(pi);

    await freshSyncSurfaces(pi, mkConfig(), "My Window");

    const refusal = appendEntry.mock.calls.find(([, entry]) =>
      String(entry?.msg ?? "").includes("is not this pi's pane"),
    );
    expect(refusal).toBeDefined();
    expect(refusal?.[1]?.data).toMatchObject({ agent: "codex", cwd: "/elsewhere" });
    vi.unstubAllEnvs();
  });

  const SAME_CWD_PI = {
    pane_id: "w44:p9",
    tab_id: "w44:t9",
    agent: "pi",
    cwd: process.cwd(),
  };

  // A matching cwd cannot separate two pi sessions in one directory, so with a
  // transcript of our own it is not evidence of anything.
  it("skips a same-cwd pi pane when this session has a transcript", async () => {
    const calls = await fallbackCalls(SAME_CWD_PI, "/sessions/ours.jsonl");
    expect(calls).toContainEqual(["herdr", ["pane", "current"]]);
    expect(calls).not.toContainEqual(PANE_RENAMED);
    expect(calls).not.toContainEqual(TAB_RENAMED);
  });

  it("skips a path-kind session whose value is empty", async () => {
    const calls = await fallbackCalls(
      { ...SAME_CWD_PI, agent_session: { kind: "path", value: "" } },
      "/sessions/ours.jsonl",
    );
    expect(calls).not.toContainEqual(PANE_RENAMED);
    expect(calls).not.toContainEqual(TAB_RENAMED);
  });

  it("skips a pane reporting a transcript when this session has none", async () => {
    const calls = await fallbackCalls({
      ...SAME_CWD_PI,
      agent_session: { kind: "path", value: "/sessions/other.jsonl" },
    });
    expect(calls).not.toContainEqual(PANE_RENAMED);
    expect(calls).not.toContainEqual(TAB_RENAMED);
  });
});
