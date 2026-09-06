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

/** Poll for a condition; resolves true when met, false on deadline. Keeps green runs fast and red runs bounded. */
async function waitFor(cond: () => boolean, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (cond()) return true;
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, 25));
  }
}

async function waitForName(h: Harness, timeoutMs = 5000): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const name = h.sessionManager.getSessionName();
    if (name !== undefined || Date.now() > deadline) return name;
    await new Promise((r) => setTimeout(r, 25));
  }
}

describe("integration: mid-rename session switch (Group H)", () => {
  it("reload while the naming fetch is parked aborts its signal", async () => {
    const h = await createHarness({
      config: { initialRenameTrigger: "first-input" },
      ui: true,
      reloadable: true,
    });
    harnesses.push(h);

    let releaseNaming!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseNaming = resolve;
    });
    void releaseNaming;
    let namingFetchStarted = false;
    let namingSignal: AbortSignal | undefined;
    let namingSignalAborted = false;
    const noteAbort = () => {
      namingSignalAborted = true;
    };

    // Shared-queue router (see Group G): naming contexts park on the gate so
    // the reload lands mid-fetch; main contexts resolve immediately. The
    // factory's second arg carries the provider stream options, so the
    // signal the naming fetch actually runs with is directly observable.
    // The factory emulates a well-behaved (abort-cooperative, fetch-like)
    // provider: on abort it stops waiting and reports stopReason "aborted".
    const router = async (context: unknown, options?: { signal?: AbortSignal }) => {
      const text = JSON.stringify(context);
      if (!text.includes("WINDOW:")) return mainResponse("first ok");
      namingFetchStarted = true;
      namingSignal = options?.signal;
      if (namingSignal?.aborted) noteAbort();
      else namingSignal?.addEventListener("abort", noteAbort);
      await Promise.race([
        gate,
        new Promise<void>((resolve) => {
          if (namingSignal?.aborted) resolve();
          else namingSignal?.addEventListener("abort", () => resolve(), { once: true });
        }),
      ]);
      if (namingSignal?.aborted) {
        noteAbort();
        return fauxAssistantMessage("", { stopReason: "aborted" as const });
      }
      return fauxWindowSession("Stale Window", "Stale Session Name");
    };
    h.faux.setResponses([router, router, router, router]);

    await h.session.prompt("first");
    expect(await waitFor(() => namingFetchStarted)).toBe(true);

    await h.session.reload();
    h.reregisterFauxApi();

    // The stale fetch must be preempted by the switch — not left running to
    // timeoutMs and dropped at the next pipeline checkpoint. Pre-fix the
    // extension passes signal: undefined (Bug 03), so nothing can abort.
    expect(namingSignal).toBeDefined();
    expect(await waitFor(() => namingSignalAborted)).toBe(true);
  });

  it("stale rename never lands and the next session renames cleanly", async () => {
    const h = await createHarness({
      config: { initialRenameTrigger: "first-input" },
      ui: true,
      reloadable: true,
    });
    harnesses.push(h);

    let releaseNaming!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseNaming = resolve;
    });
    let namingFetchStarted = false;
    let phase: "stale" | "fresh" = "stale";

    const router = async (context: unknown) => {
      const text = JSON.stringify(context);
      if (!text.includes("WINDOW:")) {
        if (text.includes('"text":"second"')) return mainResponse("second ok");
        return mainResponse("first ok");
      }
      if (phase === "fresh") return fauxWindowSession("Fresh Window", "Fresh Session Name");
      namingFetchStarted = true;
      await gate;
      return fauxWindowSession("Stale Window", "Stale Session Name");
    };
    h.faux.setResponses([router, router, router, router]);

    await h.session.prompt("first");
    expect(await waitFor(() => namingFetchStarted)).toBe(true);

    await h.session.reload();
    h.reregisterFauxApi();
    releaseNaming();
    phase = "fresh";

    // The parked stale fetch resolves now, but its name must never land on
    // the reloaded session — and the aborted run must not latch done/inflight
    // in a way that blocks the new session's own rename.
    h.faux.setResponses([router, router, router, router]);
    await h.session.prompt("second turn here");
    expect(await waitForName(h)).toBe("Fresh Session Name");
    expect(h.sessionManager.getSessionName()).not.toBe("Stale Session Name");
  });
});
