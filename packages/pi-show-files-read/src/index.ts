import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { isReadToolResult } from "@earendil-works/pi-coding-agent";
import { show_text_modal } from "@spences10/pi-tui-modal";

type ReadFileEntry = {
  path: string;
  size: number;
};

let filesRead: ReadFileEntry[] = [];

export default function (pi: ExtensionAPI) {
  pi.on("session_start", () => {
    filesRead = [];
  });

  pi.on("tool_result", (event) => {
    if (!isReadToolResult(event)) return;
    const path = event.input.path as string;
    if (!path) return;

    let size = 0;
    for (const part of event.content) {
      if (part.type === "text") {
        size += new TextEncoder().encode(part.text).length;
      }
    }

    // Deduplicate by path: update size if already present
    const existing = filesRead.find((f) => f.path === path);
    if (existing) {
      existing.size = size;
    } else {
      filesRead.push({ path, size });
    }
  });

  pi.registerCommand("show-files-read", {
    description: "List files read in the current conversation so far",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      if (filesRead.length === 0) {
        await show_text_modal(ctx, {
          title: "Files Read",
          text: "No files have been read yet in this conversation.",
        });
        return;
      }

      const cwd = ctx.cwd;
      const cwdSlash = `${cwd}/`;

      const lines: string[] = [];
      for (const f of filesRead) {
        const kb = (f.size / 1024).toFixed(1);
        const display = f.path.startsWith(cwdSlash)
          ? `./${f.path.slice(cwdSlash.length)}`
          : f.path;
        lines.push(`${display} (${kb}kB)`);
      }

      await show_text_modal(ctx, {
        title: `Files Read (${filesRead.length})`,
        text: lines.join("\n"),
      });
    },
  });
}
