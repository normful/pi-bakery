/**
 * Parrot: open the last assistant message in $VISUAL/$EDITOR, then send
 * the saved edits back as the next message.
 *
 * Usage: /parrot, plus an optional shortcut (none by default).
 */

import { spawnSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type {
  ExtensionCommandContext,
  ExtensionContext,
  ExtensionUIContext,
} from "@earendil-works/pi-coding-agent";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { TextContent } from "@earendil-works/pi-ai";
import { USER_CONFIG_PATH, isValidShortcutKey, loadConfig } from "./config.js";

export const PARROT_DESCRIPTION =
  "Open last AI message in external editor, then send edited message after you save and exit external editor";
export const PARROT_CUSTOM_MESSAGE_TYPE = "parrot squawking";

/**
 * Find the last assistant message text on the current branch.
 * Excludes thinking content, returns only user-visible text.
 */
export function findLastAssistantMessage(sessionEntry: SessionEntry[]): string | undefined {
  for (let i = sessionEntry.length - 1; i >= 0; i--) {
    const entry = sessionEntry[i];
    if (!entry || entry.type !== "message") continue;

    const msg = entry.message;
    if (!msg || msg.role !== "assistant") continue;

    const textParts = msg.content
      .filter((c): c is TextContent => c.type === "text")
      .map((c) => c.text);

    if (textParts.length > 0) {
      return textParts.join("\n\n");
    }
  }
  return undefined;
}

export function getEditorCommand(configuredEditor = ""): string {
  return configuredEditor || process.env.VISUAL || process.env.EDITOR || "";
}

/**
 * Result from running the external editor
 */
export interface EditorResult {
  content: string | null;
  error: string | null;
  exitCode: number | null;
}

export function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H");
}

/**
 * Split an editor command into argv without invoking a shell.
 *
 * Supports what editors need (`code -w`, `"my editor" --wait`,
 * `editor 'quoted arg'`): POSIX-like single/double quotes and backslash
 * escapes. Shell metacharacters (`;`, `|`, `$()`, redirections, ...) are
 * NOT interpreted — they stay literal argv text, so a malicious editor
 * value fails to spawn instead of executing extra commands.
 */
export function parseEditorCommand(command: string): string[] {
  const args: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let hasToken = false;

  const push = () => {
    if (hasToken) {
      args.push(current);
      current = "";
      hasToken = false;
    }
  };

  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!;

    if (inSingle) {
      if (ch === "'") inSingle = false;
      else {
        current += ch;
        hasToken = true;
      }
      continue;
    }

    if (inDouble) {
      if (ch === '"') inDouble = false;
      else if (ch === "\\" && i + 1 < command.length) {
        const next = command[i + 1]!;
        if (next === '"' || next === "\\" || next === "$" || next === "`") {
          current += next;
          i++;
        } else {
          current += ch;
        }
        hasToken = true;
      } else {
        current += ch;
        hasToken = true;
      }
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      hasToken = true;
    } else if (ch === '"') {
      inDouble = true;
      hasToken = true;
    } else if (ch === "\\" && i + 1 < command.length) {
      current += command[i + 1]!;
      i++;
      hasToken = true;
    } else if (ch === " " || ch === "\t" || ch === "\n") {
      push();
    } else {
      current += ch;
      hasToken = true;
    }
  }
  push();

  return args;
}

/**
 * Run the external editor on the given file path.
 * Handles TUI suspension, terminal setup, and result parsing.
 *
 * The editor is spawned directly with no shell: the command is split with
 * {@link parseEditorCommand} and the file path is passed as an argv
 * element, so editor values containing shell metacharacters cannot inject
 * extra commands.
 */
export function runEditor(filePath: string, configuredEditor = ""): EditorResult {
  clearScreen();

  const editorCmd = getEditorCommand(configuredEditor);
  const [executable, ...editorArgs] = parseEditorCommand(editorCmd);
  if (!executable) {
    return {
      content: null,
      error:
        "No editor configured. Set the `editor` key in ~/.config/pi-parrot/config.json or the $VISUAL/$EDITOR environment variable.",
      exitCode: null,
    };
  }

  let exitCode: number | null = null;
  let errorMessage: string | null = null;

  try {
    const result = spawnSync(executable, [...editorArgs, filePath], {
      stdio: "inherit",
      env: process.env,
      shell: false,
    });
    exitCode = result.status;

    if (result.error) {
      errorMessage = result.error.message;
    }

    if (result.signal) {
      errorMessage = `Killed by signal: ${result.signal}`;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  if (errorMessage) {
    return { content: null, error: errorMessage, exitCode };
  }

  // Read the edited content
  try {
    const content = readFileSync(filePath, "utf-8").replace(/\n$/, "");
    return { content, error: null, exitCode };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      content: null,
      error: `Could not read edited file: ${error}`,
      exitCode,
    };
  }
}

/**
 * Handle the result from running the editor and decide what to notify/send
 */
export function handleEditorResult(
  result: EditorResult,
  ui: ExtensionUIContext,
  sendMessage: ExtensionAPI["sendMessage"],
  configuredEditor = "",
): void {
  const { content, error, exitCode } = result;

  if (error) {
    ui.notify(`Editor error: ${error}`, "error");
    return;
  }

  if (exitCode !== null && exitCode !== 0) {
    const editorCmd = getEditorCommand(configuredEditor);

    ui.notify(`'${editorCmd}' exited with code ${exitCode}. Not sending message`, "warning");
    return;
  }

  if (!content) {
    ui.notify("No message to send", "info");
    return;
  }

  sendMessage(
    {
      customType: PARROT_CUSTOM_MESSAGE_TYPE,
      content,
      display: true,
    },
    { triggerTurn: true, deliverAs: "steer" },
  );
}

export async function parrotHandler(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  configuredEditor = "",
) {
  if (!ctx.hasUI) {
    ctx.ui.notify("parrot requires interactive mode", "error");
    return;
  }

  const branch = ctx.sessionManager.getBranch();
  const lastAssistantText = findLastAssistantMessage(branch);

  if (!lastAssistantText) {
    ctx.ui.notify("No assistant messages found", "error");
    return;
  }

  const tmpFile = join(tmpdir(), `pi-parrot-${Date.now()}.md`);
  try {
    writeFileSync(tmpFile, lastAssistantText, "utf-8");
  } catch (err) {
    ctx.ui.notify(`Failed to create temp file: ${err}`, "error");
    return;
  }

  const result = await ctx.ui.custom<EditorResult>((tui, _theme, _kb, done) => {
    // Suspend the TUI while the external editor owns the terminal, and
    // always resume it — mirrors pi's own handleOpenExternalEditor.
    tui.stop();
    try {
      const editorResult = runEditor(tmpFile, configuredEditor);

      try {
        unlinkSync(tmpFile);
      } catch (err) {
        ctx.ui.notify(`Failed to delete ${tmpFile}: ${err}`, "error");
      }

      done(editorResult);
    } finally {
      tui.start();
      tui.requestRender(true);
    }

    return { render: () => [], invalidate: () => {} };
  });

  handleEditorResult(result, ctx.ui, pi.sendMessage.bind(pi), configuredEditor);
}

export default function (pi: ExtensionAPI) {
  const cfg = loadConfig();

  const shortcut = cfg.shortcut.trim();
  if (shortcut !== "") {
    if (isValidShortcutKey(shortcut)) {
      pi.registerShortcut(shortcut, {
        description: PARROT_DESCRIPTION,
        handler: async (ctx: ExtensionContext) => {
          await parrotHandler(pi, ctx, cfg.editor);
        },
      });
    } else {
      // No ctx.ui at factory time; stdout is the only channel. The /parrot
      // command still registers below.
      console.warn(
        `[pi-parrot] ignoring invalid shortcut ${JSON.stringify(cfg.shortcut)} in ${USER_CONFIG_PATH}; no shortcut registered`,
      );
    }
  }

  pi.registerCommand("parrot", {
    description: PARROT_DESCRIPTION,
    handler: async (_args: string, _ctx: ExtensionCommandContext) => {
      await parrotHandler(pi, _ctx, cfg.editor);
    },
  });
}
