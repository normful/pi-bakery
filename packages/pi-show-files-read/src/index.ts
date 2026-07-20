import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
import { isReadToolResult } from "@earendil-works/pi-coding-agent";
import { show_text_modal } from "@spences10/pi-tui-modal";

let filesRead: string[] = [];

function didCallAReadTool(event: ToolResultEvent) {
  return (
    isReadToolResult(event) ||
    /* For any other custom read-like tools with 'read' in their name */
    event.toolName.includes("read")
  );
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", () => {
    filesRead = [];
  });

  pi.on("tool_result", (event: ToolResultEvent) => {
    if (!didCallAReadTool(event)) {
      return;
    }

    const filepath = event.input.path as string;
    if (!filepath) return;

    // Deduplicate by path
    if (!filesRead.includes(filepath)) {
      filesRead.push(filepath);
    }
  });

  pi.registerCommand("files-read", {
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

      const lines = filesRead.map((p) =>
        p.startsWith(cwdSlash) ? `./${p.slice(cwdSlash.length)}` : p,
      );

      await show_text_modal(ctx, {
        title: `Files Read (${filesRead.length})`,
        text: lines.join("\n"),
      });
    },
  });
}
