import { describe, it, expect, vi } from "vitest";
import {
  ENTRY_TYPE,
  createState,
  recordAutoRename,
  restoreProvenance,
  type RenameState,
} from "../src/state.js";

describe("createState", () => {
  it("initializes every field to its default", () => {
    expect(createState()).toEqual({
      done: false,
      inflight: false,
      lastAutoName: undefined,
      lastAutoWindowName: undefined,
      autoRenameLocked: false,
      turnsSeen: 0,
      nameAtGenerationStart: undefined,
    });
  });
});

describe("recordAutoRename", () => {
  it("records the stored session name and persists provenance", () => {
    const appendEntry = vi.fn();
    const state = createState();
    recordAutoRename({ appendEntry } as any, state, "my-session", "My Window");

    expect(state.lastAutoName).toBe("my-session");
    expect(state.lastAutoWindowName).toBe("My Window");
    expect(appendEntry).toHaveBeenCalledTimes(1);
    const [customType, data] = appendEntry.mock.calls[0];
    expect(customType).toBe(ENTRY_TYPE);
    expect(data.sessionName).toBe("my-session");
    expect(data.windowName).toBe("My Window");
    expect(typeof data.at).toBe("string");
  });

  it("leaves the window name untouched when not provided", () => {
    const appendEntry = vi.fn();
    const state = createState();
    state.lastAutoWindowName = "Previous Window";
    recordAutoRename({ appendEntry } as any, state, "my-session");

    expect(state.lastAutoWindowName).toBe("Previous Window");
    const [, data] = appendEntry.mock.calls[0];
    expect(data.windowName).toBeUndefined();
  });
});

describe("restoreProvenance", () => {
  function mkCtx(entries: unknown[]) {
    return { sessionManager: { getEntries: () => entries } } as any;
  }

  it("restores session and window names from our auto entries", () => {
    const state = createState();
    const entries = [
      {
        type: "custom",
        customType: ENTRY_TYPE,
        data: { sessionName: "resumed-session", windowName: "Resumed Window" },
      },
    ];
    restoreProvenance(mkCtx(entries), state);
    expect(state.lastAutoName).toBe("resumed-session");
    expect(state.lastAutoWindowName).toBe("Resumed Window");
  });

  it("restores the window name verbatim (already canonical when written)", () => {
    const state = createState();
    const entries = [
      {
        type: "custom",
        customType: ENTRY_TYPE,
        data: { sessionName: "s", windowName: "A Long Window Name" },
      },
    ];
    restoreProvenance(mkCtx(entries), state);
    expect(state.lastAutoWindowName).toBe("A Long Window Name");
  });

  it("preserves non-natural style window names without re-compacting", () => {
    const state = createState();
    const entries = [
      {
        type: "custom",
        customType: ENTRY_TYPE,
        data: { sessionName: "s", windowName: "billing｜api" },
      },
      {
        type: "custom",
        customType: ENTRY_TYPE,
        data: { sessionName: "t", windowName: "fix-the-retry-loop" },
      },
    ];
    restoreProvenance(mkCtx(entries), state);
    expect(state.lastAutoWindowName).toBe("fix-the-retry-loop");
  });

  it("ignores entries of other types and custom types", () => {
    const state = createState();
    const entries = [
      { type: "message", customType: ENTRY_TYPE, data: { sessionName: "x" } },
      { type: "custom", customType: "other-extension", data: { sessionName: "y" } },
    ];
    restoreProvenance(mkCtx(entries), state);
    expect(state.lastAutoName).toBeUndefined();
  });

  it("ignores malformed data", () => {
    const state = createState();
    const entries = [
      { type: "custom", customType: ENTRY_TYPE, data: {} },
      { type: "custom", customType: ENTRY_TYPE, data: undefined },
    ];
    restoreProvenance(mkCtx(entries), state);
    expect(state.lastAutoName).toBeUndefined();
    expect(state.lastAutoWindowName).toBeUndefined();
  });
});
