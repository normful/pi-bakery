import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { formatSelection, type AskQuestion } from "./ask-logic.js";
import { sanitizeForInlineDisplay } from "./ask-inline-note.js";
import { askSingleQuestionWithInlineNote } from "./ask-inline-ui.js";
import { askQuestionsWithTabs } from "./ask-tabs-ui.js";

const OptionItemSchema = Type.Object({
  label: Type.String({
    description: "Only thing user sees when choosing. Supports Markdown",
  }),
});

const QuestionItemSchema = Type.Object({
  id: Type.String({ description: "unique key" }),
  question: Type.String({
    description: "Question for user. Supports Markdown",
  }),
  markdownCtx: Type.String({
    description: "Context alongside question. Supports Markdown",
  }),
  options: Type.Array(OptionItemSchema, {
    description: "Choices for user (DO NOT include Other)",
    minItems: 1,
  }),
  multi: Type.Boolean({
    description: "User should choose multiple answers",
  }),
  recommended: Type.Number({
    description: "Your recommended option (0-indexed)",
  }),
});

const AskParamsSchema = Type.Object({
  questions: Type.Array(QuestionItemSchema, {
    minItems: 1,
  }),
});

type AskParams = Static<typeof AskParamsSchema>;

interface QuestionResult {
  id: string;
  question: string;
  options: string[];
  multi: boolean;
  selectedOptions: string[];
  customInput?: string;
}

function validateQuestions(questions: AskParams["questions"]): string[] {
  const errors: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const prefix = `questions[${i}]`;

    // id: required non-empty string
    if (typeof q.id !== "string" || q.id.trim().length === 0) {
      errors.push(`${prefix}.id: must be a non-empty string`);
    }

    // question: required non-empty string
    if (typeof q.question !== "string" || q.question.trim().length === 0) {
      errors.push(`${prefix}.question: must be a non-empty string`);
    }

    // markdownCtx: required string (now non-optional)
    if (typeof q.markdownCtx !== "string") {
      errors.push(`${prefix}.markdownCtx: must be a string`);
    }

    // options: required non-empty array
    if (!Array.isArray(q.options) || q.options.length === 0) {
      errors.push(`${prefix}.options: must be a non-empty array`);
    } else {
      // validate each option label
      for (let j = 0; j < q.options.length; j++) {
        const opt = q.options[j];
        if (!opt || typeof opt.label !== "string" || opt.label.trim().length === 0) {
          errors.push(`${prefix}.options[${j}].label: must be a non-empty string`);
        }
      }

      // recommended: required finite number within option bounds
      if (typeof q.recommended !== "number" || !Number.isFinite(q.recommended)) {
        errors.push(`${prefix}.recommended: must be a finite number`);
      } else if (q.recommended < 0 || q.recommended >= q.options.length) {
        errors.push(`${prefix}.recommended: must be between 0 and ${q.options.length - 1}`);
      }
    }

    // multi: required boolean
    if (typeof q.multi !== "boolean") {
      errors.push(`${prefix}.multi: must be a boolean`);
    }
  }
  return errors;
}

function sanitizeForSessionText(value: string): string {
  return sanitizeForInlineDisplay(value)
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitizeOptionForSessionText(option: string): string {
  const sanitizedOption = sanitizeForSessionText(option);
  return sanitizedOption.length > 0 ? sanitizedOption : "(empty option)";
}

function toSessionSafeQuestionResult(result: QuestionResult) {
  const selectedOptions = result.selectedOptions
    .map((selectedOption) => sanitizeForSessionText(selectedOption))
    .filter((selectedOption) => selectedOption.length > 0);

  const rawCustomInput = result.customInput;
  const customInput = rawCustomInput == null ? undefined : sanitizeForSessionText(rawCustomInput);

  return {
    id: sanitizeForSessionText(result.id) || "(unknown)",
    question: sanitizeForSessionText(result.question) || "(empty question)",
    options: result.options.map(sanitizeOptionForSessionText),
    multi: result.multi,
    selectedOptions,
    customInput: customInput && customInput.length > 0 ? customInput : undefined,
  };
}

function formatQuestionResult(
  result: Pick<QuestionResult, "id" | "selectedOptions" | "customInput" | "multi">,
): string {
  return `${result.id}: ${formatSelection(result, "session")}`;
}

function buildAskSessionContent(results: QuestionResult[]): string {
  const safeResults = results.map(toSessionSafeQuestionResult);
  const summaryLines = safeResults.map(formatQuestionResult).join("\n");
  return `User answers:\n${summaryLines}`;
}

const ASK_TOOL_NAME = "socrates";
const ASK_TOOL_DESCRIPTION = "ALWAYS use this tool to ask user questions";

function tellHerdrWeHaveAQuestion(pi: ExtensionAPI) {
  pi.events.emit("herdr:blocked", { active: true, label: ASK_TOOL_NAME });
}

function tellHerdrWeAreDone(pi: ExtensionAPI) {
  pi.events.emit("herdr:blocked", { active: false, label: ASK_TOOL_NAME });
}

function toQuestionResult(
  q: AskParams["questions"][number],
  selection: { selectedOptions: string[]; customInput?: string },
): QuestionResult {
  return {
    id: q.id,
    question: q.question,
    options: q.options.map((option) => option.label),
    multi: q.multi,
    selectedOptions: selection.selectedOptions,
    customInput: selection.customInput,
  };
}

export default function askExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: ASK_TOOL_NAME,
    label: ASK_TOOL_NAME,
    description: ASK_TOOL_DESCRIPTION,
    parameters: AskParamsSchema,

    async execute(_toolCallId, params: AskParams, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) {
        return {
          content: [
            {
              type: "text",
              text: "Error: tool requires interactive mode",
            },
          ],
          details: {},
        };
      }

      if (params.questions.length === 0) {
        return {
          content: [{ type: "text", text: "Error: questions must not be empty" }],
          details: {},
        };
      }

      const validationErrors = validateQuestions(params.questions);
      if (validationErrors.length > 0) {
        return {
          content: [
            {
              type: "text",
              text: `Validation errors:\n${validationErrors.map((e) => `  - ${e}`).join("\n")}`,
            },
          ],
          details: {},
        };
      }

      const questions: AskQuestion[] = params.questions;

      if (questions.length === 1) {
        const q = questions[0] as AskQuestion;
        tellHerdrWeHaveAQuestion(pi);
        try {
          const selection = q.multi
            ? ((await askQuestionsWithTabs(ctx.ui, [q])).selections[0] ?? {
                selectedOptions: [],
              })
            : await askSingleQuestionWithInlineNote(ctx.ui, q);
          const result = toQuestionResult(q, selection);
          return {
            content: [{ type: "text", text: buildAskSessionContent([result]) }],
            details: {
              results: [result],
            },
          };
        } finally {
          tellHerdrWeAreDone(pi);
        }
      }

      tellHerdrWeHaveAQuestion(pi);
      try {
        const tabResult = await askQuestionsWithTabs(ctx.ui, questions);
        const results = questions.map((q, i) =>
          toQuestionResult(q, tabResult.selections[i] ?? { selectedOptions: [] }),
        );
        return {
          content: [{ type: "text", text: buildAskSessionContent(results) }],
          details: { results },
        };
      } finally {
        tellHerdrWeAreDone(pi);
      }
    },
  });
}
