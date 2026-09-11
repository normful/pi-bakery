import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.setConfig({ testTimeout: 15000 });
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import parrotFactory, { PARROT_CUSTOM_MESSAGE_TYPE } from "../../src/index.js";
import { createHarness, installFakeEditor } from "./harness.js";
import type { Harness } from "./harness.js";

const CLEAR_SCREEN = "\x1b[2J\x1b[H";

/**
 * Tier 1 integration tests for pi-parrot (Groups A–E).
 *
 * Real AgentSession + real extension runner + real /parrot command
 * dispatch, with a recording fake TUI (stop/start/requestRender order) and
 * fake $VISUAL shell scripts standing in for the external editor.
 * Everything lives in this one file — vitest isolates modules per file —
 * because env vars and process.stdout.write are process-global.
 */

// --- process-global env save/restore ---

const ENV_KEYS = ["VISUAL", "EDITOR", "PARROT_MARKER", "PARROT_PRISTINE_COPY"] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.restoreAllMocks();
});

// --- helpers ---

function stubStdout() {
  const recorded: string[] = [];
  const origWrite = process.stdout.write;
  (process.stdout as unknown as { write: typeof process.stdout.write }).write = ((
    chunk: string | Uint8Array,
    ...args: unknown[]
  ) => {
    const cb = args.find((a) => typeof a === "function") as (() => void) | undefined;
    if (cb) cb();
    recorded.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("binary"));
    return true;
  }) as typeof process.stdout.write;
  return {
    recorded,
    restore: () => {
      process.stdout.write = origWrite;
    },
  };
}

/** pi-parrot-*.md temp files present in os.tmpdir() right now. */
function parrotTempFiles(): string[] {
  return readdirSync(tmpdir()).filter((f) => f.startsWith("pi-parrot-") && f.endsWith(".md"));
}

function findParrotMessage(branch: SessionEntry[]) {
  return branch.find(
    (e) => (e as { customType?: string }).customType === PARROT_CUSTOM_MESSAGE_TYPE,
  );
}

async function seedAssistantReply(h: Harness, text: string) {
  h.faux.setResponses([fauxAssistantMessage(text)]);
  await h.session.prompt("hello");
}

async function runParrot(h: Harness, followUpText: string) {
  // The triggered follow-up turn needs a canned faux response.
  h.faux.setResponses([fauxAssistantMessage(followUpText)]);
  const stdout = stubStdout();
  const before = new Set(parrotTempFiles());
  try {
    await h.session.prompt("/parrot");
    return { stdout: stdout.recorded.join(""), before };
  } finally {
    stdout.restore();
  }
}

// --- Group A: full flow through the real runner ---

describe("integration: full /parrot flow through real runner (Group A)", () => {
  it("suspends TUI around the editor, sends edited text, cleans up", async () => {
    const h = await createHarness({ mode: "tui" });
    try {
      const reply = "line1\nline2\n\nline3 with unicode: 短";
      await seedAssistantReply(h, reply);

      const editor = installFakeEditor(h.tempDir, "ok");
      process.env.VISUAL = editor.path;
      process.env.PARROT_MARKER = editor.marker;
      process.env.PARROT_PRISTINE_COPY = editor.pristineCopy;

      const { stdout, before } = await runParrot(h, "follow-up ok");

      // 1. The editor actually ran: marker file touched by the script.
      expect(existsSync(editor.marker)).toBe(true);

      // 2. Suspension protocol in order: stop -> start -> requestRender.
      const kinds = h.tuiEvents.map((e) => e.event);
      expect(kinds).toEqual(["stop", "start", "requestRender"]);

      // 3. Editor ran while the TUI was stopped (cross-process timestamps).
      const stop = h.tuiEvents[0]!.at;
      const start = h.tuiEvents[1]!.at;
      const { statSync } = await import("node:fs");
      const markerMtime = statSync(editor.marker).mtimeMs;
      expect(markerMtime).toBeGreaterThanOrEqual(stop);
      expect(markerMtime).toBeLessThanOrEqual(start);

      // 4. Screen was cleared for the editor handoff.
      expect(stdout).toContain(CLEAR_SCREEN);

      // 5. No temp files leaked (only pre-existing ones may remain).
      expect(parrotTempFiles().filter((f) => !before.has(f))).toEqual([]);

      // 6. Edited content was sent back as a parrot custom message.
      const branch = h.session.sessionManager.getBranch();
      const sent = findParrotMessage(branch);
      expect(sent).toBeDefined();
      expect((sent as unknown as { content: string }).content).toContain("PARROT-EDITED");
      expect((sent as unknown as { content: string }).content).toContain("line1");

      // 7. The triggered follow-up turn completed.
      const lastAssistant = [...branch].reverse().find((e) => e.type === "message");
      expect(lastAssistant).toBeDefined();
    } finally {
      h.cleanup();
    }
  });

  it("hands the editor the last assistant text byte-identical", async () => {
    const h = await createHarness({ mode: "tui" });
    try {
      const reply = "alpha\n\nbeta 短";
      await seedAssistantReply(h, reply);

      const editor = installFakeEditor(h.tempDir, "ok");
      process.env.VISUAL = editor.path;
      process.env.PARROT_MARKER = editor.marker;
      process.env.PARROT_PRISTINE_COPY = editor.pristineCopy;

      await runParrot(h, "follow-up ok");

      // The fake editor copied $1 aside before appending: pristine bytes
      // must equal the assistant text exactly (Group E).
      const { readFileSync } = await import("node:fs");
      expect(readFileSync(editor.pristineCopy, "utf-8")).toBe(reply);
    } finally {
      h.cleanup();
    }
  });
});

// --- Group B: suspension protocol under failure ---

describe("integration: TUI resumes even when the editor fails (Group B)", () => {
  it("nonzero editor exit still resumes TUI and warns without sending", async () => {
    const h = await createHarness({ mode: "tui" });
    try {
      await seedAssistantReply(h, "some reply");

      const editor = installFakeEditor(h.tempDir, "fail");
      process.env.VISUAL = editor.path;
      process.env.PARROT_MARKER = editor.marker;
      process.env.PARROT_PRISTINE_COPY = editor.pristineCopy;

      await runParrot(h, "unused");

      expect(existsSync(editor.marker)).toBe(true);
      expect(h.tuiEvents.map((e) => e.event)).toEqual(["stop", "start", "requestRender"]);
      expect(h.notifyCalls.some((n) => n.type === "warning" && n.message.includes("3"))).toBe(true);
      expect(findParrotMessage(h.session.sessionManager.getBranch())).toBeUndefined();
    } finally {
      h.cleanup();
    }
  });

  it("editor deleting the file resumes TUI and reports a read error", async () => {
    const h = await createHarness({ mode: "tui" });
    try {
      await seedAssistantReply(h, "some reply");

      const editor = installFakeEditor(h.tempDir, "delete");
      process.env.VISUAL = editor.path;
      process.env.PARROT_MARKER = editor.marker;
      process.env.PARROT_PRISTINE_COPY = editor.pristineCopy;

      await runParrot(h, "unused");

      expect(existsSync(editor.marker)).toBe(true);
      expect(h.tuiEvents.map((e) => e.event)).toEqual(["stop", "start", "requestRender"]);
      expect(
        h.notifyCalls.some(
          (n) => n.type === "error" && n.message.includes("Could not read edited file"),
        ),
      ).toBe(true);
      expect(findParrotMessage(h.session.sessionManager.getBranch())).toBeUndefined();
    } finally {
      h.cleanup();
    }
  });
});

// --- Group C: editor configuration and empty content ---

describe("integration: editor config and empty content (Group C)", () => {
  it("missing $VISUAL/$EDITOR notifies instead of spawning", async () => {
    const h = await createHarness({ mode: "tui" });
    try {
      await seedAssistantReply(h, "some reply");
      delete process.env.VISUAL;
      delete process.env.EDITOR;

      // Marker path would only exist if a script ran; point it at tempDir
      // and assert nothing creates it.
      const phantom = `${h.tempDir}/must-never-exist`;
      process.env.PARROT_MARKER = phantom;

      await runParrot(h, "unused");

      expect(existsSync(phantom)).toBe(false);
      expect(
        h.notifyCalls.some((n) => n.type === "error" && n.message.includes("No editor configured")),
      ).toBe(true);
      expect(findParrotMessage(h.session.sessionManager.getBranch())).toBeUndefined();
    } finally {
      h.cleanup();
    }
  });

  it("empty edited file notifies and sends nothing", async () => {
    const h = await createHarness({ mode: "tui" });
    try {
      await seedAssistantReply(h, "some reply");

      const editor = installFakeEditor(h.tempDir, "empty");
      process.env.VISUAL = editor.path;
      process.env.PARROT_MARKER = editor.marker;
      process.env.PARROT_PRISTINE_COPY = editor.pristineCopy;

      await runParrot(h, "unused");

      expect(existsSync(editor.marker)).toBe(true);
      expect(h.notifyCalls.some((n) => n.message === "No message to send")).toBe(true);
      expect(findParrotMessage(h.session.sessionManager.getBranch())).toBeUndefined();
    } finally {
      h.cleanup();
    }
  });
});

// --- Group D: preconditions ---

describe("integration: preconditions (Group D)", () => {
  it("no assistant messages: error, editor never spawns, TUI untouched", async () => {
    const h = await createHarness({ mode: "tui" });
    try {
      const phantom = `${h.tempDir}/must-never-exist`;
      process.env.PARROT_MARKER = phantom;

      await runParrot(h, "unused");

      expect(existsSync(phantom)).toBe(false);
      expect(h.tuiEvents).toEqual([]);
      expect(
        h.notifyCalls.some(
          (n) => n.type === "error" && n.message.includes("No assistant messages"),
        ),
      ).toBe(true);
    } finally {
      h.cleanup();
    }
  });

  it("non-UI mode refuses via direct handler invocation", async () => {
    const h = await createHarness({ mode: "tui" });
    try {
      await seedAssistantReply(h, "some reply");

      const commands = new Map<string, { handler: (args: string, ctx: never) => Promise<void> }>();
      (parrotFactory as (pi: unknown) => void)({
        registerCommand: (n: string, o: never) => commands.set(n, o),
        registerShortcut: () => {},
      } as never);
      const notifyCalls: Array<{ message: string; type?: string }> = [];
      const ctx = {
        hasUI: false,
        ui: {
          notify: (message: string, type?: string) => {
            notifyCalls.push({ message, type });
          },
        },
        sessionManager: h.session.sessionManager,
      } as never;

      await commands.get("parrot")!.handler("", ctx);

      expect(notifyCalls.some((n) => n.message.includes("requires interactive mode"))).toBe(true);
      expect(h.tuiEvents).toEqual([]);
    } finally {
      h.cleanup();
    }
  });
});
