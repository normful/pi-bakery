import { join } from "node:path";
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
import { getAgentDir } from "@earendil-works/pi-coding-agent";

const TOP_LEVEL_DEFAULTS: Partial<Config> = {
  enabled: true,
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
      namingCase: "sentence",
      namingInstructions: "Mention the affected service.",
      language: "zh-CN",
      initialRenameTrigger: "first-agent-settled",
      reRenameEveryNTurns: 3,
      sessionNameMaxLength: 50,
      windowNameMaxLength: 25,
    });
    expect(cfg.namingStyle).toBe("slug");
    expect(cfg.namingCase).toBe("sentence");
    expect(cfg.namingInstructions).toBe("Mention the affected service.");
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
      .mockReturnValueOnce({}) // XDG config
      .mockReturnValueOnce({
        namingStyle: "slug",
        language: "fr",
        namingCase: "sentence",
        namingInstructions: "Global naming preference.",
      }) // preferred user config
      .mockReturnValueOnce({ language: "de", namingInstructions: "" }); // project override
    const cfg = loadConfig("/some/project");

    expect(loadJsonConfig).toHaveBeenCalledTimes(3);
    expect(loadJsonConfig).toHaveBeenNthCalledWith(
      1,
      "/fake/home/.config/pi-auto-name/config.json",
    );
    expect(loadJsonConfig).toHaveBeenNthCalledWith(
      2,
      join("/fake/home/.pi/agent", "pi-auto-name.json"),
    );
    expect(loadJsonConfig).toHaveBeenNthCalledWith(
      3,
      join("/some/project", ".pi", "pi-auto-name.json"),
    );

    expect(cfg.namingStyle).toBe("slug"); // from user base
    expect(cfg.language).toBe("de"); // project wins
    expect(cfg.namingCase).toBe("sentence");
    expect(cfg.namingInstructions).toBe(""); // project can clear global instructions
  });

  it("uses the agent directory returned by Pi rather than a hardcoded home path", () => {
    const agentDir = join("/custom", "pi-agent");
    vi.mocked(getAgentDir).mockReturnValueOnce(agentDir);
    loadConfig("/p");
    expect(loadJsonConfig).toHaveBeenNthCalledWith(2, join(agentDir, "pi-auto-name.json"));
  });

  it("keeps XDG settings when the agent and project configs are empty", () => {
    vi.mocked(loadJsonConfig)
      .mockReturnValueOnce({ language: "fr", enabled: false })
      .mockReturnValueOnce({})
      .mockReturnValueOnce({});
    const cfg = loadConfig("/p");
    expect(cfg.language).toBe("fr");
    expect(cfg.enabled).toBe(false);
  });

  it("applies XDG, agent, and project precedence per field", () => {
    vi.mocked(loadJsonConfig)
      .mockReturnValueOnce({
        namingStyle: "slug",
        language: "fr",
        reRenameEveryNTurns: 1,
      })
      .mockReturnValueOnce({ language: "de", reRenameEveryNTurns: 2 })
      .mockReturnValueOnce({ reRenameEveryNTurns: 3 });
    const cfg = loadConfig("/p");

    expect(cfg.namingStyle).toBe("slug"); // XDG config
    expect(cfg.language).toBe("de"); // agent config wins over XDG
    expect(cfg.reRenameEveryNTurns).toBe(3); // project wins over both user sources
  });

  it("deep-merges nested surface objects across all config sources", () => {
    vi.mocked(loadJsonConfig)
      .mockReturnValueOnce({ surfaces: { renameTmuxWindow: false } })
      .mockReturnValueOnce({ surfaces: { renameZellijTab: false } })
      .mockReturnValueOnce({ surfaces: { renamePiSession: false } });
    const cfg = loadConfig("/p");
    expect(cfg.surfaces.renameTmuxWindow).toBe(false); // XDG config
    expect(cfg.surfaces.renameZellijTab).toBe(false); // preferred user config
    expect(cfg.surfaces.renamePiSession).toBe(false); // project override
    expect(cfg.surfaces.renameHerdrPane).toBe(true); // default elsewhere
  });
});
