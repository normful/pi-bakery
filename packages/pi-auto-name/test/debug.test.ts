import { describe, it, expect, vi, afterEach } from "vitest";
import { ENTRY_TYPE } from "../src/state.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Minimal pi mock with appendEntry + registerEntryRenderer. */
function mkPi() {
  const appendEntry = vi.fn();
  const registerEntryRenderer = vi.fn();
  return {
    pi: { appendEntry, registerEntryRenderer } as any,
    appendEntry,
    registerEntryRenderer,
  };
}

describe("debug gate", () => {
  it("is a no-op when PI_AUTO_NAME_DEBUG is unset", async () => {
    vi.stubEnv("PI_AUTO_NAME_DEBUG", "");
    vi.resetModules();
    const { debug, debugEnabled, initDebug } = await import("../src/debug.js");
    const { pi, appendEntry } = mkPi();
    initDebug(pi);
    expect(debugEnabled).toBe(false);
    debug("hello");
    expect(appendEntry).not.toHaveBeenCalled();
  });

  it("appends a structured custom entry when PI_AUTO_NAME_DEBUG=1", async () => {
    vi.stubEnv("PI_AUTO_NAME_DEBUG", "1");
    vi.resetModules();
    const { debug, debugEnabled, DEBUG_ENTRY_TYPE, initDebug } = await import("../src/debug.js");
    const { pi, appendEntry } = mkPi();
    initDebug(pi);
    expect(debugEnabled).toBe(true);
    debug("hello", { x: 1 });
    expect(appendEntry).toHaveBeenCalledTimes(1);
    const [customType, data] = appendEntry.mock.calls[0];
    expect(customType).toBe(DEBUG_ENTRY_TYPE);
    expect(data.msg).toBe("hello");
    expect(data.data).toEqual({ x: 1 });
    expect(typeof data.at).toBe("string");
    expect(new Date(data.at).getTime()).not.toBeNaN();
  });

  it("omits data when only a message is passed", async () => {
    vi.stubEnv("PI_AUTO_NAME_DEBUG", "1");
    vi.resetModules();
    const { debug, initDebug } = await import("../src/debug.js");
    const { pi, appendEntry } = mkPi();
    initDebug(pi);
    debug("just a label");
    expect(appendEntry).toHaveBeenCalledTimes(1);
    const [, data] = appendEntry.mock.calls[0];
    expect(data.msg).toBe("just a label");
    expect("data" in data).toBe(false);
  });

  it("no-ops before initDebug even when the env gate is on", async () => {
    vi.stubEnv("PI_AUTO_NAME_DEBUG", "1");
    vi.resetModules();
    const { debug } = await import("../src/debug.js");
    expect(() => debug("no pi yet")).not.toThrow();
  });

  it("registers the TUI renderer lazily on first append, not at init", async () => {
    vi.stubEnv("PI_AUTO_NAME_DEBUG", "1");
    vi.resetModules();
    const { debug, DEBUG_ENTRY_TYPE, initDebug } = await import("../src/debug.js");
    const { pi, registerEntryRenderer, appendEntry } = mkPi();
    initDebug(pi);
    // Extension loading must not call action methods (they are throwing stubs).
    expect(registerEntryRenderer).not.toHaveBeenCalled();
    debug("first");
    expect(registerEntryRenderer).toHaveBeenCalledTimes(1);
    expect(registerEntryRenderer).toHaveBeenCalledWith(DEBUG_ENTRY_TYPE, expect.any(Function));
    expect(appendEntry).toHaveBeenCalledTimes(1);
    debug("second");
    expect(registerEntryRenderer).toHaveBeenCalledTimes(1); // registered once
    expect(appendEntry).toHaveBeenCalledTimes(2);
  });

  it("uses a debug type distinct from the provenance entry type", async () => {
    vi.stubEnv("PI_AUTO_NAME_DEBUG", "1");
    vi.resetModules();
    const { DEBUG_ENTRY_TYPE } = await import("../src/debug.js");
    expect(DEBUG_ENTRY_TYPE).not.toBe(ENTRY_TYPE);
  });
});

describe("renderDebugEntry", () => {
  it("shows the label and a compact inline payload when collapsed", async () => {
    vi.stubEnv("PI_AUTO_NAME_DEBUG", "1");
    vi.resetModules();
    const { renderDebugEntry } = await import("../src/debug.js");
    const theme = {
      fg: (_color: string, text: string) => text,
      bg: (_color: string, text: string) => text,
    } as any;
    const entry = {
      data: {
        msg: "syncSurfaces",
        data: { windowName: "w", surfaces: { renameTmuxWindow: true } },
        at: "...",
      },
    } as any;

    const collapsed = renderDebugEntry(entry, { expanded: false }, theme);
    const rendered = collapsed?.render(80).join("\n") ?? "";
    expect(rendered).toContain("[pi-auto-name] syncSurfaces");
    expect(rendered).toContain('"windowName":"w"'); // inline compact JSON
    expect(rendered).not.toContain("at ..."); // no timestamp when collapsed
  });

  it("expands to pretty JSON", async () => {
    vi.stubEnv("PI_AUTO_NAME_DEBUG", "1");
    vi.resetModules();
    const { renderDebugEntry } = await import("../src/debug.js");
    const theme = {
      fg: (_color: string, text: string) => text,
      bg: (_color: string, text: string) => text,
    } as any;
    const entry = {
      data: {
        msg: "syncSurfaces",
        data: { windowName: "w" },
        at: "2026-08-04T00:00:00.000Z",
      },
    } as any;

    const expanded = renderDebugEntry(entry, { expanded: true }, theme);
    const rendered = expanded?.render(80).join("\n") ?? "";
    expect(rendered).toContain("[pi-auto-name] syncSurfaces");
    expect(rendered).toContain('"windowName"'); // pretty JSON (indented keys)
  });

  it("truncates long inline payloads when collapsed", async () => {
    vi.stubEnv("PI_AUTO_NAME_DEBUG", "1");
    vi.resetModules();
    const { renderDebugEntry } = await import("../src/debug.js");
    const theme = {
      fg: (_color: string, text: string) => text,
      bg: (_color: string, text: string) => text,
    } as any;
    const long = "x".repeat(500);
    const entry = {
      data: { msg: "long", data: { seed: long }, at: "..." },
    } as any;

    const collapsed = renderDebugEntry(entry, { expanded: false }, theme);
    const rendered = collapsed?.render(200).join("\n") ?? "";
    expect(rendered).toContain("[pi-auto-name] long");
    expect(rendered).toContain("…");
    // The full 500-char seed must be truncated, not echoed verbatim.
    expect(rendered).not.toContain("x".repeat(300));
  });
});
