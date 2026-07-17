import type { ExtensionAPI, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { show_text_modal } from "@spences10/pi-tui-modal";

export const ALL_COLORS: ThemeColor[] = [
  "accent",
  "border",
  "borderAccent",
  "borderMuted",
  "success",
  "error",
  "warning",
  "muted",
  "dim",
  "text",
  "thinkingText",
  "userMessageText",
  "customMessageText",
  "customMessageLabel",
  "toolTitle",
  "toolOutput",
  "mdHeading",
  "mdLink",
  "mdLinkUrl",
  "mdCode",
  "mdCodeBlock",
  "mdCodeBlockBorder",
  "mdQuote",
  "mdQuoteBorder",
  "mdHr",
  "mdListBullet",
  "toolDiffAdded",
  "toolDiffRemoved",
  "toolDiffContext",
  "syntaxComment",
  "syntaxKeyword",
  "syntaxFunction",
  "syntaxVariable",
  "syntaxString",
  "syntaxNumber",
  "syntaxType",
  "syntaxOperator",
  "syntaxPunctuation",
  "thinkingOff",
  "thinkingMinimal",
  "thinkingLow",
  "thinkingMedium",
  "thinkingHigh",
  "thinkingXhigh",
  "thinkingMax",
  "bashMode",
];

const RESET = "\x1b[0m";
const DEFAULT_SAMPLE = "The quick brown fox";

/**
 * Build display lines for theme colors.
 * Pure function — no side effects, no TUI dependency.
 *
 * @param theme - Theme instance with getFgAnsi method
 * @param colors - ThemeColor values to display
 * @param sample - Sample text to render in each color (default: "The quick brown fox")
 * @returns Lines of the form "<color-name> <ANSI-colored-sample>"
 */
export function buildColorDisplayLines(
  theme: Pick<Theme, "getFgAnsi">,
  colors: ThemeColor[],
  sample = DEFAULT_SAMPLE,
): string[] {
  const lines: string[] = [];
  for (const color of colors) {
    const ansi = theme.getFgAnsi(color);
    const colored = `${ansi}${sample}${RESET}`;
    lines.push(`${color.padEnd(24)} ${colored}`);
  }
  return lines;
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("theme-colors", {
    description: "Show all current theme's colors using sample text",
    handler: async (_args, ctx) => {
      const theme = ctx.ui.theme;
      const themeName = theme.name ?? "(unknown)";
      const lines = buildColorDisplayLines(theme, ALL_COLORS);
      await show_text_modal(ctx, {
        title: `Colors of current theme: ${themeName}`,
        text: lines.join("\n"),
      });
    },
  });
}
