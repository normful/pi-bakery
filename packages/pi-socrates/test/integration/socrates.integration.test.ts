import { describe, expect, it, afterEach, vi } from "vitest";
vi.setConfig({ testTimeout: 15000 });
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { visibleWidth } from "@earendil-works/pi-tui";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { createHarness, loadBuiltInTheme } from "./harness.js";
import type { Harness } from "./harness.js";
import { askSingleQuestionWithInlineNote } from "../../src/ask-inline-ui.js";
import { askQuestionsWithTabs } from "../../src/ask-tabs-ui.js";

const DOWN = "[B";
const RIGHT = "[C";
const ENTER = "\r";
const CTRL_C = "";
const F6 = "[17~";

const harnesses: Harness[] = [];
afterEach(() => {
  while (harnesses.length) harnesses.pop()!.cleanup();
  vi.restoreAllMocks();
});

function toolCallMessage(params: unknown) {
  return fauxAssistantMessage([fauxToolCall("socrates", params as never)]);
}

function toolResultText(branch: SessionEntry[]): string[] {
  return branch
    .filter((e) => e.type === "message")
    .flatMap((e) => {
      const content = (e as unknown as { message?: { content?: unknown } }).message?.content;
      // `content` is `string | ContentBlock[]`. pi 0.99.1 records prompt changes
      // as transcript system messages, so the branch now holds a message whose
      // content is a bare string.
      if (typeof content === "string") return [content];
      if (!Array.isArray(content)) return [];
      return content
        .filter(
          (block): block is { type: string; text?: string } =>
            typeof block === "object" &&
            block !== null &&
            (block as { type?: unknown }).type === "text",
        )
        .map((block) => block.text ?? "");
    });
}

function singleQuestionParams() {
  return {
    questions: [
      {
        id: "auth",
        question: "Which auth?",
        markdownCtx: "",
        options: [{ label: "JWT" }, { label: "Session" }],
        multi: false,
        recommended: 1,
      },
    ],
  };
}

describe("integration: tool registration (INT-1)", () => {
  it("registers the socrates tool with its schema", async () => {
    const h = await createHarness({ mode: "tui" });
    harnesses.push(h);

    const def = h.session.getToolDefinition("socrates");
    expect(def).toBeDefined();
    expect(def?.name).toBe("socrates");
    expect(def?.description).toBe("ALWAYS use this tool to ask user questions");
    const questions = (
      def?.parameters as unknown as { properties?: { questions?: { minItems?: number } } }
    )?.properties?.questions;
    expect(questions?.minItems).toBe(1);
    expect(h.session.getAllTools().some((t) => t.name === "socrates")).toBe(true);
  });
});

describe("integration: single-select end-to-end (INT-2)", () => {
  it("runs the picker through the LLM tool loop and formats the answer", async () => {
    const h = await createHarness({
      mode: "tui",
      // recommended: 1 puts the cursor on "Session"; Enter submits it.
      keystrokeScripts: [[ENTER]],
    });
    harnesses.push(h);

    h.faux.setResponses([toolCallMessage(singleQuestionParams()), fauxAssistantMessage("ok")]);
    await h.session.prompt("decide auth");

    expect(h.customCallCount()).toBe(1);
    const texts = toolResultText(h.session.sessionManager.getBranch());
    expect(texts.some((t) => t === "User answers:\nauth: Session")).toBe(true);
  });
});

describe("integration: multi-question tab flow (INT-3a)", () => {
  it("toggles a multi option and submits from the review tab", async () => {
    const params = {
      questions: [
        {
          id: "auth",
          question: "Which auth methods?",
          markdownCtx: "",
          options: [{ label: "JWT" }, { label: "Session" }],
          multi: true,
          recommended: 0,
        },
        {
          id: "cache",
          question: "Which cache?",
          markdownCtx: "",
          options: [{ label: "Redis" }, { label: "None" }],
          multi: false,
          recommended: 0,
        },
      ],
    };
    const h = await createHarness({
      mode: "tui",
      keystrokeScripts: [
        [
          ENTER,
          RIGHT,
          DOWN,
          ENTER,
          // single-select "None" advances to Submit automatically; Enter submits.
          ENTER,
        ],
      ],
    });
    harnesses.push(h);

    h.faux.setResponses([toolCallMessage(params), fauxAssistantMessage("ok")]);
    await h.session.prompt("decide stack");

    expect(h.customCallCount()).toBe(1);
    const texts = toolResultText(h.session.sessionManager.getBranch());
    expect(texts.some((t) => t.includes("auth: [JWT]"))).toBe(true);
    expect(texts.some((t) => t.includes("cache: None"))).toBe(true);
  });
});

describe("integration: tab flow with Other note (INT-3b)", () => {
  it("requires a note for Other and reviews before submit", async () => {
    const params = {
      questions: [
        {
          id: "auth",
          question: "Which auth approach?",
          markdownCtx: "",
          options: [{ label: "JWT" }, { label: "Session" }],
          multi: false,
          recommended: 0,
        },
      ],
    };
    const h = await createHarness({
      mode: "tui",
      keystrokeScripts: [
        [
          DOWN,
          DOWN,
          // Cursor is on Other: Enter opens the note editor (not a submit).
          ENTER,
          // Empty note + Enter: still editing, not submitted.
          ENTER,
          ..."org-sso".split(""),
          ENTER,
          // Single-select Other advances to Submit automatically; Enter submits.
          ENTER,
        ],
      ],
    });
    harnesses.push(h);

    h.faux.setResponses([toolCallMessage(params), fauxAssistantMessage("ok")]);
    await h.session.prompt("decide stack");

    expect(h.customCallCount()).toBe(1);
    const texts = toolResultText(h.session.sessionManager.getBranch());
    expect(texts.some((t) => t.includes('auth: "org-sso"'))).toBe(true);
  });
});

describe("integration: cancel, validation, non-TUI guard (INT-4)", () => {
  it("cancels on Ctrl-C and completes the turn", async () => {
    const h = await createHarness({ mode: "tui", keystrokeScripts: [[CTRL_C]] });
    harnesses.push(h);

    h.faux.setResponses([toolCallMessage(singleQuestionParams()), fauxAssistantMessage("ok")]);
    await h.session.prompt("decide auth");

    const texts = toolResultText(h.session.sessionManager.getBranch());
    expect(texts.some((t) => t === "User answers:\nauth: (cancelled)")).toBe(true);
  });

  it("rejects empty questions at the schema layer without invoking the UI", async () => {
    const h = await createHarness({ mode: "tui" });
    harnesses.push(h);

    h.faux.setResponses([toolCallMessage({ questions: [] }), fauxAssistantMessage("ok")]);
    await h.session.prompt("decide nothing");

    expect(h.customCallCount()).toBe(0);
    const texts = toolResultText(h.session.sessionManager.getBranch());
    expect(texts.some((t) => t.includes("must not have fewer than 1 items"))).toBe(true);
  });

  it("rejects out-of-range recommended without invoking the UI", async () => {
    const h = await createHarness({ mode: "tui" });
    harnesses.push(h);

    h.faux.setResponses([
      toolCallMessage({
        questions: [
          {
            id: "auth",
            question: "Which auth?",
            markdownCtx: "",
            options: [{ label: "JWT" }],
            multi: false,
            recommended: 5,
          },
        ],
      }),
      fauxAssistantMessage("ok"),
    ]);
    await h.session.prompt("decide auth");

    expect(h.customCallCount()).toBe(0);
    const texts = toolResultText(h.session.sessionManager.getBranch());
    expect(texts.some((t) => t.includes("Validation errors"))).toBe(true);
  });

  it("refuses in print mode without invoking the UI", async () => {
    const h = await createHarness({ mode: "print" });
    harnesses.push(h);

    h.faux.setResponses([toolCallMessage(singleQuestionParams()), fauxAssistantMessage("ok")]);
    await h.session.prompt("decide auth");

    expect(h.customCallCount()).toBe(0);
    const texts = toolResultText(h.session.sessionManager.getBranch());
    expect(texts.some((t) => t.includes("requires interactive mode"))).toBe(true);
  });

  it("cancels the tab flow via F6", async () => {
    const h = await createHarness({ mode: "tui", keystrokeScripts: [[F6]] });
    harnesses.push(h);

    h.faux.setResponses([
      toolCallMessage({
        questions: [
          {
            id: "auth",
            question: "Which auth?",
            markdownCtx: "",
            options: [{ label: "JWT" }, { label: "Session" }],
            multi: false,
            recommended: 0,
          },
          {
            id: "cache",
            question: "Which cache?",
            markdownCtx: "",
            options: [{ label: "Redis" }, { label: "None" }],
            multi: false,
            recommended: 0,
          },
        ],
      }),
      fauxAssistantMessage("ok"),
    ]);
    await h.session.prompt("decide stack");

    const texts = toolResultText(h.session.sessionManager.getBranch());
    expect(texts.some((t) => t.includes("auth: (cancelled)"))).toBe(true);
    expect(texts.some((t) => t.includes("cache: (cancelled)"))).toBe(true);
  });
});

describe("integration: render width safety (INT-5)", () => {
  it("keeps lines within width on the real theme", async () => {
    const theme = loadBuiltInTheme();

    let wideSingle: string[] = [];
    let narrowSingle: string[] = [];
    await askSingleQuestionWithInlineNote(
      {
        custom: async (factory: never) => {
          const tui = { requestRender() {} };
          let result: unknown;
          const component = await (
            factory as (
              tui: unknown,
              theme: unknown,
              kb: unknown,
              done: (v: unknown) => void,
            ) => Promise<{ render: (w: number) => string[] }>
          )(tui, theme, {}, (v: unknown) => {
            result = v;
          });
          wideSingle = component.render(93);
          narrowSingle = component.render(79);
          void result;
          return { cancelled: true } as never;
        },
      } as never,
      {
        question:
          "Which execution path should we prioritize first when response latency and network I/O are both rising?",
        markdownCtx: "# Context\n- This is a long explanation block to trigger markdown rendering.",
        options: [{ label: "Cache-first" }, { label: "DB-first" }],
      } as never,
    );

    expect(wideSingle.some((line) => visibleWidth(line) > 79)).toBe(true);
    for (const line of narrowSingle) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(79);
    }

    let wideTabs: string[] = [];
    let narrowTabs: string[] = [];
    await askQuestionsWithTabs(
      {
        custom: async (factory: never) => {
          const tui = { requestRender() {} };
          const component = await (
            factory as (
              tui: unknown,
              theme: unknown,
              kb: unknown,
              done: (v: unknown) => void,
            ) => Promise<{ render: (w: number) => string[] }>
          )(tui, theme, {}, () => {});
          wideTabs = component.render(93);
          narrowTabs = component.render(79);
          return {
            cancelled: true,
            selectedOptionIndexesByQuestion: [[], []],
            noteByQuestionByOption: [
              ["", "", ""],
              ["", "", ""],
            ],
          } as never;
        },
      } as never,
      [
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
      ] as never,
    );

    expect(wideTabs.some((line) => visibleWidth(line) > 79)).toBe(true);
    for (const line of narrowTabs) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(79);
    }
  });
});
