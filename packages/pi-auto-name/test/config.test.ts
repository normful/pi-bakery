import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigSchema, loadConfig, validateConfig, type Config } from "../src/config.js";

vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@earendil-works/pi-coding-agent")>();
  return {
    ...actual,
    getAgentDir: vi.fn(() => "/fake/home/.pi/agent"),
  };
});

vi.mock("@juicesharp/rpiv-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@juicesharp/rpiv-config")>();
  return {
    ...actual,
    configPath: vi.fn(() => "/fake/home/.config/pi-auto-name/config.json"),
    loadJsonConfig: vi.fn(() => ({})),
  };
});

import { loadJsonConfig } from "@juicesharp/rpiv-config";

const TOP_LEVEL_DEFAULTS: Partial<Config> = {
  enabled: true,
  initialRenameTrigger: "first-input",
  reRenameEveryNTurns: 0,
  replaceExistingName: "always",
  respectExternalRenames: true,
  namingStyle: "natural",
  namingContextDepth: "recent-user-messages",
  skipSessionNameDedup: false,
  namingModel: "",
  language: "en",
  windowNameMaxLength: undefined,
  sessionNameMaxLength: undefined,
};

describe("ConfigSchema top-level defaults (via rpiv-config validateConfig)", () => {
  it("applies every scalar default", () => {
    const cfg = validateConfig(ConfigSchema, {});
    for (const [key, value] of Object.entries(TOP_LEVEL_DEFAULTS)) {
      expect(cfg[key as keyof Config], key).toEqual(value);
    }
  });

  it("accepts valid scalar overrides", () => {
    const cfg = validateConfig(ConfigSchema, {
      namingStyle: "slug",
      language: "zh-CN",
      initialRenameTrigger: "first-agent-settled",
      reRenameEveryNTurns: 3,
      sessionNameMaxLength: 50,
      windowNameMaxLength: 25,
    });
    expect(cfg.namingStyle).toBe("slug");
    expect(cfg.language).toBe("zh-CN");
    expect(cfg.initialRenameTrigger).toBe("first-agent-settled");
    expect(cfg.reRenameEveryNTurns).toBe(3);
    expect(cfg.sessionNameMaxLength).toBe(50);
    expect(cfg.windowNameMaxLength).toBe(25);
  });

  it("strips unknown keys (rpiv-config Value.Clean contract)", () => {
    const cfg = validateConfig(ConfigSchema, { bogusKey: 1 } as any);
    expect((cfg as any).bogusKey).toBeUndefined();
    expect(cfg.namingStyle).toBe("natural");
  });
});

describe("loadConfig (nested defaults deep-merged)", () => {
  beforeEach(() => {
    vi.mocked(loadJsonConfig).mockReset();
    vi.mocked(loadJsonConfig).mockReturnValue({});
  });

  it("returns full defaults including nested surfaces", () => {
    const cfg = loadConfig("/p");
    expect(cfg.surfaces).toEqual({
      renamePiSession: true,
      renameHerdrPane: true,
      renameHerdrTab: true,
      renameTmuxWindow: true,
      renameZellijPane: true,
      renameZellijTab: true,
    });
    for (const [key, value] of Object.entries(TOP_LEVEL_DEFAULTS)) {
      expect(cfg[key as keyof Config], key).toEqual(value);
    }
  });

  it("keeps untouched surfaces when a partial surfaces override is given", () => {
    vi.mocked(loadJsonConfig)
      .mockReturnValueOnce({})
      .mockReturnValueOnce({ surfaces: { renameTmuxWindow: false } });
    const cfg = loadConfig("/p");
    expect(cfg.surfaces.renameTmuxWindow).toBe(false);
    expect(cfg.surfaces.renamePiSession).toBe(true);
    expect(cfg.surfaces.renameZellijTab).toBe(true);
  });

  it("loads the preferred user-global config from Pi's agent directory", () => {
    vi.mocked(loadJsonConfig)
      .mockReturnValueOnce({}) // legacy fallback
      .mockReturnValueOnce({ namingStyle: "slug" }) // preferred user config
      .mockReturnValueOnce({}); // project override
    const cfg = loadConfig("/some/project");

    expect(loadJsonConfig).toHaveBeenCalledTimes(3);
    expect(loadJsonConfig).toHaveBeenNthCalledWith(
      1,
      "/fake/home/.config/pi-auto-name/config.json",
    );
    expect(loadJsonConfig).toHaveBeenNthCalledWith(2, "/fake/home/.pi/agent/pi-auto-name.json");
    expect(loadJsonConfig).toHaveBeenNthCalledWith(3, "/some/project/.pi/pi-auto-name.json");
    expect(cfg.namingStyle).toBe("slug");
  });

  it("applies legacy, preferred user, and project precedence per field", () => {
    vi.mocked(loadJsonConfig)
      .mockReturnValueOnce({
        namingStyle: "slug",
        language: "fr",
        reRenameEveryNTurns: 1,
      })
      .mockReturnValueOnce({ language: "de", reRenameEveryNTurns: 2 })
      .mockReturnValueOnce({ reRenameEveryNTurns: 3 });
    const cfg = loadConfig("/p");

    expect(cfg.namingStyle).toBe("slug"); // legacy fallback
    expect(cfg.language).toBe("de"); // preferred user config wins over legacy
    expect(cfg.reRenameEveryNTurns).toBe(3); // project wins over both user sources
  });

  it("deep-merges nested surface objects across all config sources", () => {
    vi.mocked(loadJsonConfig)
      .mockReturnValueOnce({ surfaces: { renameTmuxWindow: false } })
      .mockReturnValueOnce({ surfaces: { renameZellijTab: false } })
      .mockReturnValueOnce({ surfaces: { renamePiSession: false } });
    const cfg = loadConfig("/p");
    expect(cfg.surfaces.renameTmuxWindow).toBe(false); // legacy fallback
    expect(cfg.surfaces.renameZellijTab).toBe(false); // preferred user config
    expect(cfg.surfaces.renamePiSession).toBe(false); // project override
    expect(cfg.surfaces.renameHerdrPane).toBe(true); // default elsewhere
  });
});
