import { describe, expect, it } from "vitest";
import type {
  ExtensionAPI,
  ExtensionUIContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { OTHER_OPTION } from "../src/ask-logic.js";
import askExtension from "../src/index.js";

type AskTool = ToolDefinition<any, any>;

function createAskTool(events?: { emit: (channel: string, data: unknown) => void }): AskTool {
  let registered: AskTool | undefined;
  const pi = {
    registerTool(tool: AskTool) {
      registered = tool;
    },
    events: events ?? { emit: () => {}, on: () => () => {} },
  } as unknown as ExtensionAPI;

  askExtension(pi);

  if (!registered) throw new Error("ask tool was not registered");
  return registered;
}

function uiWithCustomQueue(queue: any[]): ExtensionUIContext {
  return {
    custom: async () => {
      if (queue.length === 0) throw new Error("custom() called more times than expected");
      return queue.shift();
    },
  } as unknown as ExtensionUIContext;
}

function getTextContent(result: any): string {
  return result.content[0]?.type === "text" ? result.content[0].text : "";
}

describe("ask extension tool", () => {
  it("registers socrates tool", () => {
    const tool = createAskTool();
    expect(tool.name).toBe("socrates");
    expect(tool.label).toBe("socrates");
  });

  it("returns error when UI is unavailable", async () => {
    const tool = createAskTool();
    const result = await tool.execute(
      "call-1",
      { questions: [{ id: "auth", question: "Which auth?", options: [{ label: "JWT" }] }] },
      undefined,
      undefined,
      { hasUI: false } as any,
    );

    expect(result.content[0].type).toBe("text");
    expect(getTextContent(result)).toContain("requires interactive mode");
  });

  it("returns error when questions is empty", async () => {
    const tool = createAskTool();
    const result = await tool.execute("call-2", { questions: [] }, undefined, undefined, {
      hasUI: true,
      ui: uiWithCustomQueue([]),
    } as any);

    expect(getTextContent(result)).toContain("questions must not be empty");
  });

  it("handles single non-multi question via inline note UI", async () => {
    const tool = createAskTool();
    const result = await tool.execute(
      "call-3",
      {
        questions: [
          {
            id: "auth",
            question: "Which auth?",
            markdownCtx: "",
            options: [{ label: "JWT" }, { label: "Session" }],
            multi: false,
            recommended: 0,
          },
        ],
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: uiWithCustomQueue([{ cancelled: false, selectedOption: "Session", note: "split" }]),
      } as any,
    );

    const text = getTextContent(result);
    expect(text).toBe("User answers:\nauth: Session - split");
    expect(result.details).toEqual({
      results: [
        {
          id: "auth",
          question: "Which auth?",
          options: ["JWT", "Session"],
          multi: false,
          selectedOptions: ["Session - split"],
          customInput: undefined,
        },
      ],
    });
  });

  it("includes markdownCtx in the tool params flow", async () => {
    const tool = createAskTool();
    const markdownCtx =
      "# Background\n- Current bottleneck: network I/O\n```text\nClient -> API -> DB\n```";
    const result = await tool.execute(
      "call-3b",
      {
        questions: [
          {
            id: "architecture",
            question: "Which path should we prioritize?",
            markdownCtx,
            options: [{ label: "Cache-first" }, { label: "DB-first" }],
            multi: false,
            recommended: 0,
          },
        ],
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: uiWithCustomQueue([{ cancelled: false, selectedOption: "Cache-first", note: "" }]),
      } as any,
    );

    const text = getTextContent(result);
    expect(text).toBe("User answers:\narchitecture: Cache-first");
    expect(result.details).toEqual({
      results: [
        {
          id: "architecture",
          question: "Which path should we prioritize?",
          options: ["Cache-first", "DB-first"],
          multi: false,
          selectedOptions: ["Cache-first"],
          customInput: undefined,
        },
      ],
    });
  });

  it("handles single multi question via tab submit flow", async () => {
    const tool = createAskTool();
    const result = await tool.execute(
      "call-4",
      {
        questions: [
          {
            id: "auth",
            question: "Which auth methods?",
            markdownCtx: "",
            options: [{ label: "JWT" }, { label: "Session" }],
            multi: true,
            recommended: 0,
          },
        ],
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: uiWithCustomQueue([
          {
            cancelled: false,
            selectedOptionIndexesByQuestion: [[0, 2]],
            noteByQuestionByOption: [["", "", "org-sso"]],
          },
        ]),
      } as any,
    );

    const text = getTextContent(result);
    expect(text).toBe('User answers:\nauth: [JWT] + Other: "org-sso"');
    expect(result.details).toEqual({
      results: [
        {
          id: "auth",
          question: "Which auth methods?",
          options: ["JWT", "Session"],
          multi: true,
          selectedOptions: ["JWT"],
          customInput: "org-sso",
        },
      ],
    });
  });

  it("returns cancelled for single multi question when tab flow is cancelled", async () => {
    const tool = createAskTool();
    const result = await tool.execute(
      "call-4b",
      {
        questions: [
          {
            id: "auth",
            question: "Which auth methods?",
            markdownCtx: "",
            options: [{ label: "JWT" }, { label: "Session" }],
            multi: true,
            recommended: 0,
          },
        ],
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: uiWithCustomQueue([
          {
            cancelled: true,
            selectedOptionIndexesByQuestion: [[0, 2]],
            noteByQuestionByOption: [["", "", "org-sso"]],
          },
        ]),
      } as any,
    );

    const text = getTextContent(result);
    expect(text).toBe("User answers:\nauth: (cancelled)");
    expect(result.details).toEqual({
      results: [
        {
          id: "auth",
          question: "Which auth methods?",
          options: ["JWT", "Session"],
          multi: true,
          selectedOptions: [],
          customInput: undefined,
        },
      ],
    });
  });

  it("uses tabbed flow for multiple single-select questions", async () => {
    const tool = createAskTool();
    const result = await tool.execute(
      "call-5",
      {
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
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: uiWithCustomQueue([
          {
            cancelled: false,
            selectedOptionIndexesByQuestion: [[0], [1]],
            noteByQuestionByOption: [
              ["", ""],
              ["", ""],
            ],
          },
        ]),
      } as any,
    );

    const text = getTextContent(result);
    expect(text).toBe("User answers:\nauth: JWT\ncache: None");
    expect(result.details?.results).toEqual([
      {
        id: "auth",
        question: "Which auth?",
        options: ["JWT", "Session"],
        multi: false,
        selectedOptions: ["JWT"],
        customInput: undefined,
      },
      {
        id: "cache",
        question: "Which cache?",
        options: ["Redis", "None"],
        multi: false,
        selectedOptions: ["None"],
        customInput: undefined,
      },
    ]);
  });

  it("uses tab flow when any question is multi-select", async () => {
    const tool = createAskTool();
    const result = await tool.execute(
      "call-6",
      {
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
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: uiWithCustomQueue([
          {
            cancelled: false,
            selectedOptionIndexesByQuestion: [[1], [0]],
            noteByQuestionByOption: [
              ["", ""],
              ["local", ""],
            ],
          },
        ]),
      } as any,
    );

    const text = getTextContent(result);
    expect(text).toBe("User answers:\nauth: [Session]\ncache: Redis - local");
    expect(result.details?.results).toEqual([
      {
        id: "auth",
        question: "Which auth methods?",
        options: ["JWT", "Session"],
        multi: true,
        selectedOptions: ["Session"],
        customInput: undefined,
      },
      {
        id: "cache",
        question: "Which cache?",
        options: ["Redis", "None"],
        multi: false,
        selectedOptions: ["Redis - local"],
        customInput: undefined,
      },
    ]);
  });

  it("returns cancelled markers for all questions when tab flow is cancelled", async () => {
    const tool = createAskTool();
    const result = await tool.execute(
      "call-6b",
      {
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
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: uiWithCustomQueue([
          {
            cancelled: true,
            selectedOptionIndexesByQuestion: [[1], [0]],
            noteByQuestionByOption: [
              ["", ""],
              ["local", ""],
            ],
          },
        ]),
      } as any,
    );

    const text = getTextContent(result);
    expect(text).toBe("User answers:\nauth: (cancelled)\ncache: (cancelled)");
    expect(result.details?.results).toEqual([
      {
        id: "auth",
        question: "Which auth methods?",
        options: ["JWT", "Session"],
        multi: true,
        selectedOptions: [],
        customInput: undefined,
      },
      {
        id: "cache",
        question: "Which cache?",
        options: ["Redis", "None"],
        multi: false,
        selectedOptions: [],
        customInput: undefined,
      },
    ]);
  });

  it("records custom-only answers with explicit Other context", async () => {
    const tool = createAskTool();
    const result = await tool.execute(
      "call-7",
      {
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
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: uiWithCustomQueue([
          { cancelled: false, selectedOption: OTHER_OPTION, note: "enterprise\nsso" },
        ]),
      } as any,
    );

    const text = getTextContent(result);
    expect(text).toBe('User answers:\nauth: "enterprise sso"');
    expect(result.details?.results?.[0]?.customInput).toBe("enterprise\nsso");
  });

  it("sanitizes prompt/options/answer text in session output while preserving raw details", async () => {
    const tool = createAskTool();
    const result = await tool.execute(
      "call-8",
      {
        questions: [
          {
            id: "auth\nmode",
            question: "Which\tauth?\nNow",
            markdownCtx: "",
            options: [{ label: "JWT\tFast" }, { label: "Sess\nion\u0007" }],
            multi: false,
            recommended: 0,
          },
        ],
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: uiWithCustomQueue([
          {
            cancelled: false,
            selectedOption: "Sess\nion\u0007",
            note: "line1\nline2\t\u0007",
          },
        ]),
      } as any,
    );

    const text = getTextContent(result);
    expect(text).toBe("User answers:\nauth mode: Sess ion - line1 line2");

    expect(result.details?.results?.[0]?.id).toBe("auth\nmode");
    expect(result.details?.results?.[0]?.question).toBe("Which\tauth?\nNow");
    expect(result.details?.results?.[0]?.options).toEqual(["JWT\tFast", "Sess\nion\u0007"]);
    expect(result.details?.results?.[0]?.selectedOptions).toEqual([
      "Sess\nion\u0007 - line1\nline2\t\u0007",
    ]);
  });

  it("orders results deterministically by question order", async () => {
    const tool = createAskTool();
    const result = await tool.execute(
      "call-9",
      {
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
          {
            id: "priority",
            question: "What should we optimize first?",
            markdownCtx: "",
            options: [{ label: "Latency" }, { label: "Cost" }],
            multi: false,
            recommended: 0,
          },
        ],
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: uiWithCustomQueue([
          {
            cancelled: false,
            selectedOptionIndexesByQuestion: [[1], [0], [0]],
            noteByQuestionByOption: [
              ["", ""],
              ["", ""],
              ["", ""],
            ],
          },
        ]),
      } as any,
    );

    const text = getTextContent(result);
    expect(text).toBe("User answers:\nauth: Session\ncache: Redis\npriority: Latency");
  });

  it("emits herdr blocked true then false around the UI", async () => {
    const emits: Array<[string, unknown]> = [];
    const tool = createAskTool({
      emit: (channel: string, data: unknown) => {
        emits.push([channel, data]);
      },
    });
    await tool.execute(
      "call-herdr",
      {
        questions: [
          {
            id: "auth",
            question: "Which auth?",
            markdownCtx: "",
            options: [{ label: "JWT" }],
            multi: false,
            recommended: 0,
          },
        ],
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: uiWithCustomQueue([{ cancelled: true }]),
      } as any,
    );

    expect(emits).toEqual([
      ["herdr:blocked", { active: true, label: "socrates" }],
      ["herdr:blocked", { active: false, label: "socrates" }],
    ]);
  });

  it("still emits herdr unblocked when the UI throws", async () => {
    const emits: Array<[string, unknown]> = [];
    const tool = createAskTool({
      emit: (channel: string, data: unknown) => {
        emits.push([channel, data]);
      },
    });
    await expect(
      tool.execute(
        "call-herdr-throw",
        {
          questions: [
            {
              id: "auth",
              question: "Which auth?",
              markdownCtx: "",
              options: [{ label: "JWT" }],
              multi: false,
              recommended: 0,
            },
          ],
        },
        undefined,
        undefined,
        {
          hasUI: true,
          ui: {
            custom: async () => {
              throw new Error("boom");
            },
          } as any,
        } as any,
      ),
    ).rejects.toThrow("boom");
    expect(emits).toEqual([
      ["herdr:blocked", { active: true, label: "socrates" }],
      ["herdr:blocked", { active: false, label: "socrates" }],
    ]);
  });
});
