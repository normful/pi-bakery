import { describe, expect, it } from "vitest";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import type { AskQuestion } from "../src/ask-logic.js";
import { askSingleQuestionWithInlineNote } from "../src/ask-inline-ui.js";
import { askQuestionsWithTabs } from "../src/ask-tabs-ui.js";

function createFakeTheme() {
  return {
    fg: (_color: string, text: string) => text,
    bg: (_color: string, text: string) => text,
    bold: (text: string) => text,
    italic: (text: string) => text,
    underline: (text: string) => text,
    strikethrough: (text: string) => text,
  };
}

function expectAllLinesToFitWidth(lines: string[], width: number): void {
  const overflowLines = lines
    .map((line, index) => ({ index, width: visibleWidth(line) }))
    .filter((entry) => entry.width > width);
  expect(overflowLines).toEqual([]);
}

describe("ask UI render cache width safety", () => {
  it("re-renders single-question UI when terminal width changes", async () => {
    let wideLines: string[] = [];
    let narrowLines: string[] = [];

    const ui = {
      custom: async (factory: any) => {
        const tui = { requestRender() {} };
        const theme = createFakeTheme();
        let result: any;
        const done = (value: any) => {
          result = value;
        };

        const component = await factory(tui, theme, {}, done);
        wideLines = component.render(93);
        narrowLines = component.render(79);

        done({ cancelled: true });
        return result;
      },
    } as unknown as ExtensionUIContext;

    await askSingleQuestionWithInlineNote(ui, {
      id: "path",
      question:
        "Which execution path should we prioritize first when response latency and network I/O are both rising?",
      markdownCtx: "# Context\n- This is a long explanation block to trigger markdown rendering.",
      options: [{ label: "Cache-first" }, { label: "DB-first" }],
      multi: false,
      recommended: 0,
    });

    expect(wideLines.some((line) => visibleWidth(line) > 79)).toBe(true);
    expectAllLinesToFitWidth(narrowLines, 79);
  });

  it("re-renders tabbed UI when terminal width changes", async () => {
    let wideLines: string[] = [];
    let narrowLines: string[] = [];

    const ui = {
      custom: async (factory: any) => {
        const tui = { requestRender() {} };
        const theme = createFakeTheme();
        let result: any;
        const done = (value: any) => {
          result = value;
        };

        const component = await factory(tui, theme, {}, done);
        wideLines = component.render(93);
        narrowLines = component.render(79);

        done({
          cancelled: true,
          selectedOptionIndexesByQuestion: [[], []],
          noteByQuestionByOption: [
            ["", "", ""],
            ["", "", ""],
          ],
        });
        return result;
      },
    } as unknown as ExtensionUIContext;

    const questions: AskQuestion[] = [
      {
        id: "plugin_strategy",
        question:
          "Daily Notes related strategy should be selected after checking current plugin availability and migration risk.",
        markdownCtx: "# Context\n- No community plugin folder exists yet.",
        options: [{ label: "Core-only" }, { label: "Core + periodic prep" }],
        multi: false,
        recommended: 0,
      },
      {
        id: "date_format",
        question: "Which date format should be used as a migration-safe default?",
        markdownCtx: "",
        options: [{ label: "YYYY-MM-DD" }, { label: "gggg/[M]MM/[W]ww/YYYY-MM-DD(ddd)" }],
        multi: false,
        recommended: 0,
      },
    ];

    await askQuestionsWithTabs(ui, questions);

    expect(wideLines.some((line) => visibleWidth(line) > 79)).toBe(true);
    expectAllLinesToFitWidth(narrowLines, 79);
  });
});
