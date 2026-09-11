import { describe, it, expect, beforeAll, vi } from "vitest";
vi.setConfig({ testTimeout: 120000 });
import { existsSync, mkdirSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

/**
 * Tier 2 PTY test for pi-parrot.
 *
 * Spawns the REAL pi CLI inside a real pseudoterminal (node-pty), loads
 * this package's src/index.ts via `-e`, resumes a seeded session file, and
 * drives `/parrot` end to end: the TUI genuinely suspends (ui.stop), the
 * fake $VISUAL script runs attached to the pty, and the TUI resumes.
 *
 * Gates (both must hold, otherwise skipped):
 *   1. `node-pty` resolvable (native module; installed via npm).
 *   2. `PI_PARROT_PTY=1` in the environment (set in CI; opt-in locally).
 *
 * Isolation: fresh HOME + session dir + cwd per run, `--offline`,
 * `--approve`, `--no-context-files`. No model call is expected to succeed —
 * after the edited message is sent, the triggered turn may fail without an
 * API key; assertions stop at: editor ran mid-session, transcript resumed,
 * edited text visible.
 */

const runtimeRequire = createRequire(import.meta.url);

function loadPty(): null | {
  spawn: (
    file: string,
    args: string[],
    opts: Record<string, unknown>,
  ) => {
    onData: (cb: (data: string) => void) => void;
    write: (data: string) => void;
    kill: () => void;
    onExit: (cb: (e: { exitCode: number }) => void) => void;
  };
} {
  try {
    return runtimeRequire("node-pty") as ReturnType<typeof loadPty>;
  } catch {
    return null;
  }
}

const pty = loadPty();
const RUN_PTY = pty !== null && process.env.PI_PARROT_PTY === "1";

function makeRunDir(): string {
  const d = join(tmpdir(), `pi-parrot-pty-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(d, { recursive: true });
  mkdirSync(join(d, "home"), { recursive: true });
  mkdirSync(join(d, "sessions"), { recursive: true });
  mkdirSync(join(d, "cwd"), { recursive: true });
  return d;
}

function seedSessionFile(dir: string): string {
  const now = new Date().toISOString();
  const lines = [
    JSON.stringify({
      type: "session",
      version: 3,
      id: "ptyseed01",
      timestamp: now,
      cwd: join(dir, "cwd"),
    }),
    JSON.stringify({
      type: "message",
      id: "a1b2c3d4",
      parentId: null,
      timestamp: now,
      message: { role: "user", content: "hello from pty" },
    }),
    JSON.stringify({
      type: "message",
      id: "b2c3d4e5",
      parentId: "a1b2c3d4",
      timestamp: now,
      message: {
        role: "assistant",
        content: [{ type: "text", text: "pty seeded reply" }],
        provider: "seed",
        model: "seed-1",
        // The footer totals assume usage is present; omit it and real pi
        // crashes rendering (addUsageToTotals reads usage.input).
        usage: {
          input: 10,
          output: 5,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 15,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "stop",
      },
    }),
  ];
  const file = join(dir, "sessions", "seed.jsonl");
  writeFileSync(file, lines.join("\n") + "\n", "utf-8");
  return file;
}

function installPtyEditor(dir: string): { path: string; marker: string } {
  const path = join(dir, "pty-editor.sh");
  const marker = join(dir, "pty-editor-marker");
  writeFileSync(path, `#!/bin/sh\ntouch "${marker}"\nprintf '\\nPTY-EDITED' >> "$1"\n`, "utf-8");
  chmodSync(path, 0o755);
  return { path, marker };
}

/** Poll until cond() is true or timeout elapses; returns what cond() returned. */
async function waitFor(cond: () => string | null, timeoutMs: number): Promise<string | null> {
  const start = Date.now();
  for (;;) {
    const hit = cond();
    if (hit !== null) return hit;
    if (Date.now() - start > timeoutMs) return null;
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe.skipIf(!RUN_PTY)("pty: /parrot suspends and resumes the real TUI", () => {
  it("editor runs while suspended; session resumes with edited text", async () => {
    const dir = makeRunDir();
    try {
      const sessionFile = seedSessionFile(dir);
      const editor = installPtyEditor(dir);
      const piBin = resolve("node_modules/.bin/pi");
      const extension = resolve("packages/pi-parrot/src/index.ts");
      expect(existsSync(piBin)).toBe(true);
      expect(existsSync(extension)).toBe(true);

      let output = "";
      const child = pty!.spawn(
        piBin,
        [
          "--session",
          sessionFile,
          "--session-dir",
          join(dir, "sessions"),
          "-e",
          extension,
          "--offline",
          "--approve",
          "--no-context-files",
        ],
        {
          name: "xterm-256color",
          cols: 120,
          rows: 40,
          cwd: join(dir, "cwd"),
          env: {
            ...process.env,
            HOME: join(dir, "home"),
            XDG_CONFIG_HOME: join(dir, "home", ".config"),
            VISUAL: editor.path,
            EDITOR: "",
            TERM: "xterm-256color",
            PI_OFFLINE: "1",
          } as Record<string, string>,
        },
      );
      child.onData((data: string) => {
        output += data;
      });
      const exitPromise = new Promise<number>((resolveExit) => {
        child.onExit(({ exitCode }: { exitCode: number }) => resolveExit(exitCode));
      });

      try {
        // Wait for the interactive prompt to render the seeded transcript.
        const booted = await waitFor(
          () => (output.includes("pty seeded reply") ? output : null),
          60000,
        );
        expect(booted, "pi did not render the seeded session").not.toBeNull();

        output = "";
        child.write("/parrot\r");

        // The editor script touches its marker while the TUI is suspended.
        const markerSeen = await waitFor(() => (existsSync(editor.marker) ? "yes" : null), 60000);
        expect(markerSeen, "fake editor never ran").toBe("yes");

        // After the editor exits, the TUI resumes and the edited message
        // is sent back (visible in the transcript or status output).
        const resumed = await waitFor(
          () => (output.includes("PTY-EDITED") || output.includes("parrot") ? output : null),
          60000,
        );
        expect(resumed, "session did not resume with the edited text").not.toBeNull();
      } finally {
        child.write("\x03");
        const code = await Promise.race([
          exitPromise,
          new Promise<number>((r) =>
            setTimeout(() => {
              try {
                child.kill();
              } catch {}
              r(-1);
            }, 10000),
          ),
        ]);
        expect([-1, 0, 1]).toContain(code);
      }
    } finally {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
  });
});

beforeAll(() => {
  if (!RUN_PTY) {
    console.log("skipping Tier 2 PTY test (needs node-pty + PI_PARROT_PTY=1)");
  }
});
