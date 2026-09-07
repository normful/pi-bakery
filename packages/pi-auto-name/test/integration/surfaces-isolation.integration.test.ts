import { describe, it, expect, afterEach, vi } from "vitest";
vi.setConfig({ testTimeout: 15000 });
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { fauxWindowSession } from "./fixtures.js";
import { createHarness } from "./harness.js";
import type { Harness } from "./harness.js";

function mainResponse(text = "ok") {
  return fauxAssistantMessage(text);
}

const harnesses: Harness[] = [];
afterEach(() => {
  while (harnesses.length) harnesses.pop()!.cleanup();
  vi.restoreAllMocks();
});

const SURFACE_ENV_KEYS = [
  "HERDR_ENV",
  "HERDR_PANE_ID",
  "HERDR_TAB_ID",
  "TMUX",
  "TMUX_PANE",
  "ZELLIJ",
  "ZELLIJ_PANE_ID",
] as const;

describe("integration: surface isolation", () => {
  it("inherited multiplexer env is cleared and no multiplexer spawn escapes", async () => {
    // Poison the env BEFORE createHarness, mimicking `npm run test` inside a
    // real herdr/tmux/zellij session. The harness must clear it so the naming
    // run below cannot route a rename at the developer's real session.
    const saved: Record<string, string | undefined> = {};
    for (const key of SURFACE_ENV_KEYS) {
      saved[key] = process.env[key];
      process.env[key] = `poison-${key}`;
    }
    const h = await createHarness({ config: { initialRenameTrigger: "first-input" } });
    try {
      for (const key of SURFACE_ENV_KEYS) expect(process.env[key]).toBeUndefined();
      h.faux.setResponses([
        fauxWindowSession("OAuth fix", "Fix the OAuth callback"),
        mainResponse(),
      ]);
      await h.session.prompt("fix oauth please");
      expect(h.sessionManager.getSessionName()).toBe("Fix the OAuth callback");
      expect(h.execCalls).toEqual([]);
    } finally {
      // cleanup() restores the poison values it captured at creation; put the
      // true originals back afterwards so nothing leaks to other tests.
      h.cleanup();
      for (const key of SURFACE_ENV_KEYS) {
        const value = saved[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("opt-in surfaces stay hermetic: spawns are recorded and blocked", async () => {
    const h = await createHarness({
      config: {
        initialRenameTrigger: "first-input",
        surfaces: {
          renameHerdrPane: true,
          renameHerdrTab: true,
          renameTmuxWindow: true,
          renameZellijPane: true,
          renameZellijTab: true,
        },
      },
    });
    harnesses.push(h);
    // Poison AFTER creation (cleared env): surfaces.ts reads process.env live,
    // so targeting still resolves the poison ids — but exec is stubbed, so
    // every spawn is recorded and blocked instead of reaching a real session.
    process.env.HERDR_PANE_ID = "poison-pane";
    process.env.HERDR_TAB_ID = "poison-tab";
    process.env.TMUX = "poison-tmux";
    process.env.TMUX_PANE = "%poison";
    process.env.ZELLIJ_PANE_ID = "poison-zellij";
    try {
      h.faux.setResponses([
        fauxWindowSession("OAuth fix", "Fix the OAuth callback"),
        mainResponse(),
      ]);
      await h.session.prompt("fix oauth please");
      // Blocked surface failures are non-fatal: the session rename still lands.
      expect(h.sessionManager.getSessionName()).toBe("Fix the OAuth callback");
      expect(h.execCalls.length).toBeGreaterThan(0);
      for (const call of h.execCalls) {
        expect(["herdr", "tmux", "zellij"]).toContain(call.command);
      }
      expect(h.execCalls.some((call) => call.args.includes("poison-pane"))).toBe(true);
    } finally {
      delete process.env.HERDR_PANE_ID;
      delete process.env.HERDR_TAB_ID;
      delete process.env.TMUX;
      delete process.env.TMUX_PANE;
      delete process.env.ZELLIJ_PANE_ID;
    }
  });
});
