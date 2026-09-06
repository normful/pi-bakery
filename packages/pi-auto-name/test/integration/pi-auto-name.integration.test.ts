import { describe, it, expect, afterEach, vi } from "vitest";
vi.setConfig({ testTimeout: 15000 });
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { fauxWindowSession, fauxInvalidOutput, fauxErrorOutput } from "./fixtures.js";
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

describe("integration: trigger semantics (Group A)", () => {
  it("first-input: prompt sets session name via real input+LLM", async () => {
    const h = await createHarness({ config: { initialRenameTrigger: "first-input" } });
    harnesses.push(h);
    // input handler fires before agent turn: queue naming first, then main
    h.faux.setResponses([fauxWindowSession("OAuth fix", "Fix the OAuth callback"), mainResponse()]);
    await h.session.prompt("fix oauth please");
    expect(h.sessionManager.getSessionName()).toBe("Fix the OAuth callback");
    expect(h.eventsOfType("session_info_changed" as never).length).toBeGreaterThanOrEqual(1);
  });

  it("first-input ignored when trigger is first-agent-settled", async () => {
    const h = await createHarness({ config: { initialRenameTrigger: "first-agent-settled" } });
    harnesses.push(h);
    // deferred naming after agent_settled: main first, naming second
    h.faux.setResponses([mainResponse(), fauxWindowSession("OAuth fix", "Fix the OAuth callback")]);
    await h.session.prompt("fix oauth please");
    expect(h.sessionManager.getSessionName()).toBe("Fix the OAuth callback");
  });

  it("disabled: no rename on prompt", async () => {
    const h = await createHarness({ config: { enabled: false } });
    harnesses.push(h);
    h.faux.setResponses([mainResponse()]);
    await h.session.prompt("fix oauth please");
    expect(h.sessionManager.getSessionName()).toBeUndefined();
  });

  it("replaceExistingName:never with pre-set name skips rename", async () => {
    const h = await createHarness({ config: { replaceExistingName: "never" } });
    harnesses.push(h);
    h.sessionManager.appendSessionInfo("Deliberate Name");
    h.faux.setResponses([mainResponse()]);
    await h.session.prompt("fix oauth please");
    expect(h.sessionManager.getSessionName()).toBe("Deliberate Name");
  });

  it("done latch: second prompt does not re-rename when initial was first-input", async () => {
    const h = await createHarness({ config: { initialRenameTrigger: "first-input" } });
    harnesses.push(h);
    h.faux.setResponses([
      fauxWindowSession("OAuth fix", "Fix the OAuth callback"),
      mainResponse("first ok"),
    ]);
    await h.session.prompt("first");
    const name1 = h.sessionManager.getSessionName();
    h.faux.setResponses([mainResponse("second ok")]);
    await h.session.prompt("second");
    expect(h.sessionManager.getSessionName()).toBe(name1);
  });

  it("first-agent-settled: initial rename fires after agent settles", async () => {
    const h = await createHarness({ config: { initialRenameTrigger: "first-agent-settled" } });
    harnesses.push(h);
    h.faux.setResponses([mainResponse(), fauxWindowSession("OAuth fix", "Fix the OAuth callback")]);
    await h.session.prompt("fix oauth please");
    expect(h.sessionManager.getSessionName()).toBe("Fix the OAuth callback");
  });
});

describe("integration: re-rename & ownership (Group B)", () => {
  it("respectExternalRenames:true external set latches autoRenameLocked", async () => {
    const h = await createHarness({
      config: { initialRenameTrigger: "first-input", reRenameEveryNTurns: 1 },
    });
    harnesses.push(h);
    h.faux.setResponses([fauxWindowSession("W1", "Name 1"), mainResponse()]);
    await h.session.prompt("first");
    expect(h.sessionManager.getSessionName()).toBe("Name 1");
    h.session.setSessionName("User Picked");
    h.faux.setResponses([mainResponse()]);
    await h.session.prompt("second");
    expect(h.sessionManager.getSessionName()).toBe("User Picked");
  });

  it("reRenameEveryNTurns:2 re-renames on settled turns 2 and 4 only", async () => {
    const h = await createHarness({
      config: { initialRenameTrigger: "first-input", reRenameEveryNTurns: 2 },
    });
    harnesses.push(h);
    h.faux.setResponses([fauxWindowSession("Initial Name", "Initial Name"), mainResponse()]);
    await h.session.prompt("first");
    expect(h.sessionManager.getSessionName()).toBe("Initial Name");

    // turn 2 hits the interval: rename fires
    h.faux.setResponses([mainResponse(), fauxWindowSession("Second Turn", "Second Turn")]);
    await h.session.prompt("second");
    expect(h.sessionManager.getSessionName()).toBe("Second Turn");

    // turn 3 misses the interval: name stays
    h.faux.setResponses([mainResponse()]);
    await h.session.prompt("third");
    expect(h.sessionManager.getSessionName()).toBe("Second Turn");

    // turn 4 hits the interval again
    h.faux.setResponses([mainResponse(), fauxWindowSession("Fourth Turn", "Fourth Turn")]);
    await h.session.prompt("fourth");
    expect(h.sessionManager.getSessionName()).toBe("Fourth Turn");
  });

  it("reRenameEveryNTurns:1 re-renames on every settled turn after the initial", async () => {
    const h = await createHarness({
      config: { initialRenameTrigger: "first-input", reRenameEveryNTurns: 1 },
    });
    harnesses.push(h);
    h.faux.setResponses([fauxWindowSession("First Name", "First Name"), mainResponse()]);
    await h.session.prompt("first");
    expect(h.sessionManager.getSessionName()).toBe("First Name");

    h.faux.setResponses([mainResponse(), fauxWindowSession("Second Name", "Second Name")]);
    await h.session.prompt("second");
    expect(h.sessionManager.getSessionName()).toBe("Second Name");

    h.faux.setResponses([mainResponse(), fauxWindowSession("Third Name", "Third Name")]);
    await h.session.prompt("third");
    expect(h.sessionManager.getSessionName()).toBe("Third Name");
  });

  it("reRenameEveryNTurns:0 never re-renames after the initial", async () => {
    const h = await createHarness({
      config: { initialRenameTrigger: "first-input", reRenameEveryNTurns: 0 },
    });
    harnesses.push(h);
    h.faux.setResponses([fauxWindowSession("Only Name", "Only Name"), mainResponse()]);
    await h.session.prompt("first");
    expect(h.sessionManager.getSessionName()).toBe("Only Name");

    h.faux.setResponses([mainResponse(), mainResponse()]);
    await h.session.prompt("second");
    await h.session.prompt("third");
    expect(h.sessionManager.getSessionName()).toBe("Only Name");
    expect(h.eventsOfType("session_info_changed" as never).length).toBe(1);
  });

  it("re-rename with first-agent-settled keeps initial separate from interval", async () => {
    const h = await createHarness({
      config: { initialRenameTrigger: "first-agent-settled", reRenameEveryNTurns: 2 },
    });
    harnesses.push(h);
    // turn 1: main response, then initial rename at settle
    h.faux.setResponses([mainResponse(), fauxWindowSession("Initial Two", "Initial Two")]);
    await h.session.prompt("first");
    expect(h.sessionManager.getSessionName()).toBe("Initial Two");

    // turn 2 hits the interval (turnsSeen 2 % 2 === 0): re-rename
    h.faux.setResponses([mainResponse(), fauxWindowSession("Second Round", "Second Round")]);
    await h.session.prompt("second");
    expect(h.sessionManager.getSessionName()).toBe("Second Round");
  });

  it("interval re-rename recovers after a total initial failure", async () => {
    const h = await createHarness({
      config: { initialRenameTrigger: "first-input", reRenameEveryNTurns: 2 },
    });
    harnesses.push(h);
    // turn 1: single-word seed, invalid model output 3x, and a fallback with
    // nothing usable -> total failure latches with no name.
    h.faux.setResponses([
      fauxInvalidOutput(),
      fauxInvalidOutput(),
      fauxInvalidOutput(),
      mainResponse(),
    ]);
    await h.session.prompt("x");
    expect(h.sessionManager.getSessionName()).toBeUndefined();

    // turn 2 hits the interval: the latched done re-arms and naming recovers.
    h.faux.setResponses([mainResponse(), fauxWindowSession("Second Turn", "Second Turn")]);
    await h.session.prompt("second turn here");
    expect(h.sessionManager.getSessionName()).toBe("Second Turn");
  });
});

describe("integration: naming pipeline (Group C)", () => {
  it("dedup does not break naming (skip flag respected)", async () => {
    const h1 = await createHarness({ config: { skipSessionNameDedup: false } });
    harnesses.push(h1);
    h1.faux.setResponses([fauxWindowSession("W", "Some Session Name"), mainResponse()]);
    await h1.session.prompt("fix oauth");
    expect(h1.sessionManager.getSessionName()).toBeDefined();

    const h2 = await createHarness({ config: { skipSessionNameDedup: true } });
    harnesses.push(h2);
    h2.faux.setResponses([fauxWindowSession("W", "Other Session Name"), mainResponse()]);
    await h2.session.prompt("fix oauth");
    expect(h2.sessionManager.getSessionName()).toBeDefined();
  });

  it("style/locale budgets do not break naming", async () => {
    const h = await createHarness({
      config: {
        namingStyle: "slug",
        language: "vi",
        windowNameMaxLength: 12,
        sessionNameMaxLength: 40,
      },
    });
    harnesses.push(h);
    h.faux.setResponses([fauxWindowSession("oauth-fix", "oauth-fix-session"), mainResponse()]);
    await h.session.prompt("fix oauth");
    expect(h.sessionManager.getSessionName()).toBeDefined();
  });

  it("topic-project style with window budget", async () => {
    const h = await createHarness({
      config: { namingStyle: "topic-project", windowNameMaxLength: 12, sessionNameMaxLength: 200 },
    });
    harnesses.push(h);
    h.faux.setResponses([
      fauxWindowSession("Fix auth｜pi-bakery", "Fix auth with retry"),
      mainResponse(),
    ]);
    await h.session.prompt("fix auth");
    expect(h.sessionManager.getSessionName()).toBeDefined();
  });

  it("failure latch: invalid output 3x keeps name via fallback", async () => {
    const h = await createHarness();
    harnesses.push(h);
    h.faux.setResponses([
      fauxInvalidOutput(),
      fauxInvalidOutput(),
      fauxInvalidOutput(),
      mainResponse(),
    ]);
    await h.session.prompt("fix oauth");
    expect(h.sessionManager.getSessionName()).toBeDefined();
  });

  it("error stopReason fallback still produces a name", async () => {
    const h = await createHarness();
    harnesses.push(h);
    h.faux.setResponses([
      fauxErrorOutput("no key"),
      fauxErrorOutput("no key"),
      fauxErrorOutput("no key"),
      mainResponse(),
    ]);
    await h.session.prompt("fix oauth");
    expect(h.sessionManager.getSessionName()).toBeDefined();
  });

  it("oversized input is truncated, naming still lands", async () => {
    const h = await createHarness();
    harnesses.push(h);
    h.faux.setResponses([fauxWindowSession("OAuth fix", "Fix the OAuth callback"), mainResponse()]);
    await h.session.prompt(`fix oauth please ${"padding ".repeat(20000)}`);
    expect(h.sessionManager.getSessionName()).toBe("Fix the OAuth callback");
  });
});

describe("integration: lifecycle & surfaces (Groups D/E)", () => {
  it("session_info_changed echo does not trigger extra surface sync loop", async () => {
    const h = await createHarness();
    harnesses.push(h);
    h.faux.setResponses([fauxWindowSession("W", "My Session"), mainResponse()]);
    await h.session.prompt("fix oauth");
    const countBefore = h.eventsOfType("session_info_changed" as never).length;
    h.session.setSessionName("My Session");
    expect(h.eventsOfType("session_info_changed" as never).length).toBe(countBefore + 1);
  });
});

describe("integration: resume/reload provenance (Group F)", () => {
  it("reload does not re-fire the initial rename for an already named session", async () => {
    const h = await createHarness({
      config: { initialRenameTrigger: "first-input", reRenameEveryNTurns: 1 },
      reloadable: true,
    });
    harnesses.push(h);
    h.faux.setResponses([fauxWindowSession("First Name", "First Name"), mainResponse()]);
    await h.session.prompt("first");
    expect(h.sessionManager.getSessionName()).toBe("First Name");

    await h.session.reload();
    h.reregisterFauxApi();
    // turn 2 input is skipped (done latched from provenance): nothing
    // consumes the head, so the main turn echoes the naming response and
    // the main response stays pending.
    h.faux.setResponses([fauxWindowSession("Spurious Name", "Spurious Name"), mainResponse()]);
    await h.session.prompt("second");
    expect(h.sessionManager.getSessionName()).toBe("First Name");
    expect(h.faux.getPendingResponseCount()).toBe(1);

    // intervals still work after reload: turn 3 hits N=1 and re-renames,
    // which also proves the extension is live on the new runner.
    h.faux.setResponses([mainResponse(), fauxWindowSession("Third Turn", "Third Turn")]);
    await h.session.prompt("third turn here");
    expect(h.sessionManager.getSessionName()).toBe("Third Turn");
  });

  it("reload restores the external-rename lock from provenance", async () => {
    const h = await createHarness({
      config: { initialRenameTrigger: "first-input" },
      reloadable: true,
    });
    harnesses.push(h);
    h.faux.setResponses([fauxWindowSession("First Name", "First Name"), mainResponse()]);
    await h.session.prompt("first");
    expect(h.sessionManager.getSessionName()).toBe("First Name");

    // external rename locks (in-memory); reload wipes memory but the
    // transcript provenance lets session_start re-derive the lock.
    h.session.setSessionName("User Picked");
    await h.session.reload();
    h.reregisterFauxApi();
    h.faux.setResponses([fauxWindowSession("Spurious Name", "Spurious Name"), mainResponse()]);
    await h.session.prompt("second turn here");
    expect(h.sessionManager.getSessionName()).toBe("User Picked");
  });
});
