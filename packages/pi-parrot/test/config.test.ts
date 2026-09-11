import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigSchema, isValidShortcutKey, loadConfig, validateConfig } from "../src/config.js";

vi.mock("@juicesharp/rpiv-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@juicesharp/rpiv-config")>();
  return {
    ...actual,
    configPath: vi.fn(() => "/fake/home/.config/pi-parrot/config.json"),
    loadJsonConfig: vi.fn(() => ({})),
  };
});

import { loadJsonConfig } from "@juicesharp/rpiv-config";

beforeEach(() => {
  vi.mocked(loadJsonConfig).mockReset();
  vi.mocked(loadJsonConfig).mockReturnValue({});
});

describe("ConfigSchema defaults", () => {
  it("applies every default", () => {
    expect(validateConfig(ConfigSchema, {})).toEqual({
      shortcut: "",
      editor: "",
    });
  });

  it("accepts overrides", () => {
    const cfg = validateConfig(ConfigSchema, {
      shortcut: "ctrl+shift+p",
      editor: "code -w",
    });
    expect(cfg.shortcut).toBe("ctrl+shift+p");
    expect(cfg.editor).toBe("code -w");
  });

  it("strips unknown keys", () => {
    const cfg = validateConfig(ConfigSchema, { bogusKey: 1 } as never);
    expect((cfg as Record<string, unknown>).bogusKey).toBeUndefined();
    expect(cfg.shortcut).toBe("");
  });
});

describe("loadConfig", () => {
  it("reads the user-global file and validates", () => {
    vi.mocked(loadJsonConfig).mockReturnValue({ editor: "hx" });
    const cfg = loadConfig();
    expect(loadJsonConfig).toHaveBeenCalledWith("/fake/home/.config/pi-parrot/config.json");
    expect(cfg.editor).toBe("hx");
    expect(cfg.shortcut).toBe("");
  });
});

describe("isValidShortcutKey", () => {
  it.each(["alt+r", "r", "ctrl+shift+p", "f6", "alt+enter", "ctrl++", "pageUp", "super+k"])(
    "accepts %s",
    (key) => {
      expect(isValidShortcutKey(key)).toBe(true);
    },
  );

  it.each(["", "altr", "ctrl+banana", "ctrl+ctrl+x", "shift+", "+r", "ctrl+shift", 42, null])(
    "rejects %s",
    (key) => {
      expect(isValidShortcutKey(key)).toBe(false);
    },
  );
});
