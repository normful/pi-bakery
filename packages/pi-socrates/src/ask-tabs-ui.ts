import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import {
  OTHER_OPTION,
  appendRecommendedTagToOptionLabels,
  buildMultiSelectionResult,
  buildSingleSelectionResult,
  formatSelection,
  type AskQuestion,
  type AskSelection,
} from "./ask-logic.js";
import {
  alertUser,
  appendOptionRow,
  appendQuestionBlock,
  clampOptionIndex,
  createMarkdownTheme,
  createOptionNoteEditor,
  createRenderCache,
  handleNoteEditorInput,
  linearCursorIndexOf,
  requestRerender,
} from "./ask-ui-shared.js";

interface PreparedQuestion {
  question: string;
  markdownCtx?: string;
  options: string[];
  tabLabel: string;
  multi: boolean;
  otherOptionIndex: number;
}

interface TabsUIState {
  cancelled: boolean;
  selectedOptionIndexesByQuestion: number[][];
  noteByQuestionByOption: string[][];
}

export function formatSelectionForSubmitReview(selection: AskSelection, isMulti: boolean): string {
  return formatSelection({ ...selection, multi: isMulti }, "review");
}

function normalizeTabLabel(id: string, fallback: string): string {
  const normalized = id.trim().replace(/[_-]+/g, " ");
  return normalized.length > 0 ? normalized : fallback;
}

function buildSelectionForQuestion(
  question: PreparedQuestion,
  selectedOptionIndexes: number[],
  noteByOptionIndex: string[],
): AskSelection {
  if (selectedOptionIndexes.length === 0) {
    return { selectedOptions: [] };
  }

  if (question.multi) {
    return buildMultiSelectionResult(
      question.options,
      selectedOptionIndexes,
      noteByOptionIndex,
      question.otherOptionIndex,
    );
  }

  const selectedOptionIndex = selectedOptionIndexes[0];
  const selectedOptionLabel = question.options[selectedOptionIndex] ?? OTHER_OPTION;
  const note = noteByOptionIndex[selectedOptionIndex] ?? "";
  return buildSingleSelectionResult(selectedOptionLabel, note);
}

function isQuestionSelectionValid(
  question: PreparedQuestion,
  selectedOptionIndexes: number[],
  noteByOptionIndex: string[],
): boolean {
  if (selectedOptionIndexes.length === 0) return false;
  if (!selectedOptionIndexes.includes(question.otherOptionIndex)) return true;
  const otherNote = noteByOptionIndex[question.otherOptionIndex]?.trim() ?? "";
  return otherNote.length > 0;
}

function createTabsUiStateSnapshot(
  cancelled: boolean,
  selectedOptionIndexesByQuestion: number[][],
  noteByQuestionByOption: string[][],
): TabsUIState {
  return {
    cancelled,
    selectedOptionIndexesByQuestion: selectedOptionIndexesByQuestion.map((indexes) => [...indexes]),
    noteByQuestionByOption: noteByQuestionByOption.map((notes) => [...notes]),
  };
}

function addIndexToSelection(selectedOptionIndexes: number[], optionIndex: number): number[] {
  if (selectedOptionIndexes.includes(optionIndex)) return selectedOptionIndexes;
  return [...selectedOptionIndexes, optionIndex].sort((a, b) => a - b);
}

function removeIndexFromSelection(selectedOptionIndexes: number[], optionIndex: number): number[] {
  return selectedOptionIndexes.filter((index) => index !== optionIndex);
}

export async function askQuestionsWithTabs(
  ui: ExtensionUIContext,
  questions: AskQuestion[],
): Promise<{ cancelled: boolean; selections: AskSelection[] }> {
  const preparedQuestions: PreparedQuestion[] = questions.map((question, questionIndex) => {
    const baseOptionLabels = question.options.map((option) => option.label);
    const optionLabels = [
      ...appendRecommendedTagToOptionLabels(baseOptionLabels, question.recommended),
      OTHER_OPTION,
    ];
    return {
      question: question.question,
      markdownCtx: question.markdownCtx,
      options: optionLabels,
      tabLabel: normalizeTabLabel(question.id, `Q${questionIndex + 1}`),
      multi: question.multi === true,
      otherOptionIndex: optionLabels.length - 1,
    };
  });

  const initialCursorOptionIndexByQuestion = preparedQuestions.map(
    (preparedQuestion, questionIndex) =>
      clampOptionIndex(questions[questionIndex].recommended, preparedQuestion.options.length),
  );

  alertUser();
  const result = await ui.custom<TabsUIState>((tui, theme, _keybindings, done) => {
    let activeTabIndex = 0;
    let isNoteEditorOpen = false;
    const cache = createRenderCache();
    const cursorOptionIndexByQuestion = [...initialCursorOptionIndexByQuestion];
    const selectedOptionIndexesByQuestion = preparedQuestions.map(() => [] as number[]);
    const noteByQuestionByOption = preparedQuestions.map(
      (preparedQuestion) => Array(preparedQuestion.options.length).fill("") as string[],
    );

    const noteEditor = createOptionNoteEditor(tui, theme);
    const markdownTheme = createMarkdownTheme(theme);

    const submitTabIndex = preparedQuestions.length;

    const rerender = () => requestRerender(tui, cache);

    const getActiveQuestionIndex = (): number | null => {
      if (activeTabIndex >= preparedQuestions.length) return null;
      return activeTabIndex;
    };

    const getQuestionNote = (questionIndex: number, optionIndex: number): string =>
      noteByQuestionByOption[questionIndex]?.[optionIndex] ?? "";

    const isAllQuestionSelectionsValid = (): boolean =>
      preparedQuestions.every((preparedQuestion, questionIndex) =>
        isQuestionSelectionValid(
          preparedQuestion,
          selectedOptionIndexesByQuestion[questionIndex],
          noteByQuestionByOption[questionIndex],
        ),
      );

    const openNoteEditorForActiveOption = () => {
      const questionIndex = getActiveQuestionIndex();
      if (questionIndex == null) return;

      isNoteEditorOpen = true;
      const optionIndex = cursorOptionIndexByQuestion[questionIndex];
      noteEditor.setText(getQuestionNote(questionIndex, optionIndex));
      rerender();
    };

    const advanceToNextTabOrSubmit = () => {
      activeTabIndex = Math.min(submitTabIndex, activeTabIndex + 1);
    };

    noteEditor.onChange = (value) => {
      const questionIndex = getActiveQuestionIndex();
      if (questionIndex == null) return;
      const optionIndex = cursorOptionIndexByQuestion[questionIndex];
      noteByQuestionByOption[questionIndex][optionIndex] = value;
    };

    noteEditor.onSubmit = (value) => {
      const questionIndex = getActiveQuestionIndex();
      if (questionIndex == null) return;

      const preparedQuestion = preparedQuestions[questionIndex];
      const optionIndex = cursorOptionIndexByQuestion[questionIndex];
      noteByQuestionByOption[questionIndex][optionIndex] = value;
      const trimmedNote = value.trim();

      if (preparedQuestion.multi) {
        if (trimmedNote.length > 0) {
          selectedOptionIndexesByQuestion[questionIndex] = addIndexToSelection(
            selectedOptionIndexesByQuestion[questionIndex],
            optionIndex,
          );
        }
        if (optionIndex === preparedQuestion.otherOptionIndex && trimmedNote.length === 0) {
          rerender();
          return;
        }
        isNoteEditorOpen = false;
        rerender();
        return;
      }

      selectedOptionIndexesByQuestion[questionIndex] = [optionIndex];
      if (optionIndex === preparedQuestion.otherOptionIndex && trimmedNote.length === 0) {
        rerender();
        return;
      }

      isNoteEditorOpen = false;
      advanceToNextTabOrSubmit();
      rerender();
    };

    const renderTabs = (): string => {
      const tabParts: string[] = ["← "];
      for (let questionIndex = 0; questionIndex < preparedQuestions.length; questionIndex++) {
        const preparedQuestion = preparedQuestions[questionIndex];
        const isActiveTab = questionIndex === activeTabIndex;
        const isQuestionValid = isQuestionSelectionValid(
          preparedQuestion,
          selectedOptionIndexesByQuestion[questionIndex],
          noteByQuestionByOption[questionIndex],
        );
        const statusIcon = isQuestionValid ? "■" : "□";
        const tabLabel = ` ${statusIcon} ${preparedQuestion.tabLabel} `;
        const styledTabLabel = isActiveTab
          ? theme.bg("selectedBg", theme.fg("text", tabLabel))
          : theme.fg(isQuestionValid ? "success" : "syntaxFunction", tabLabel);
        tabParts.push(`${styledTabLabel} `);
      }

      const isSubmitTabActive = activeTabIndex === submitTabIndex;
      const canSubmit = isAllQuestionSelectionsValid();
      const submitLabel = " ✓ Submit ";
      const styledSubmitLabel = isSubmitTabActive
        ? theme.bg("selectedBg", theme.fg("text", submitLabel))
        : theme.fg(canSubmit ? "success" : "customMessageLabel", submitLabel);
      tabParts.push(`${styledSubmitLabel} →`);
      return tabParts.join("");
    };

    const renderSubmitTab = (width: number, renderedLines: string[]): void => {
      const addLine = (line: string) => renderedLines.push(truncateToWidth(line, width));

      addLine(theme.fg("accent", theme.bold(" Review answers")));
      renderedLines.push("");

      for (let questionIndex = 0; questionIndex < preparedQuestions.length; questionIndex++) {
        const preparedQuestion = preparedQuestions[questionIndex];
        const selection = buildSelectionForQuestion(
          preparedQuestion,
          selectedOptionIndexesByQuestion[questionIndex],
          noteByQuestionByOption[questionIndex],
        );
        const value = formatSelectionForSubmitReview(selection, preparedQuestion.multi);
        const isValid = isQuestionSelectionValid(
          preparedQuestion,
          selectedOptionIndexesByQuestion[questionIndex],
          noteByQuestionByOption[questionIndex],
        );
        const statusIcon = isValid ? theme.fg("success", "●") : theme.fg("error", "○");
        addLine(
          ` ${statusIcon} ${theme.fg("syntaxFunction", `${preparedQuestion.tabLabel}:`)} ${theme.fg("text", value)}`,
        );
      }

      renderedLines.push("");
      if (isAllQuestionSelectionsValid()) {
        addLine(theme.fg("success", " Press Enter to submit"));
      } else {
        const missingQuestions = preparedQuestions
          .filter(
            (preparedQuestion, questionIndex) =>
              !isQuestionSelectionValid(
                preparedQuestion,
                selectedOptionIndexesByQuestion[questionIndex],
                noteByQuestionByOption[questionIndex],
              ),
          )
          .map((preparedQuestion) => preparedQuestion.tabLabel)
          .join(", ");
        addLine(theme.fg("error", ` Complete required answers: ${missingQuestions}`));
      }
      addLine(theme.fg("customMessageLabel", " ←/→ switch tabs • F6 exit entirely"));
    };

    const renderQuestionTab = (
      width: number,
      renderedLines: string[],
      questionIndex: number,
    ): void => {
      const preparedQuestion = preparedQuestions[questionIndex] as PreparedQuestion;
      const cursorOptionIndex = cursorOptionIndexByQuestion[questionIndex] as number;
      const selectedOptionIndexes = selectedOptionIndexesByQuestion[questionIndex] as number[];
      const addLine = (line: string) => renderedLines.push(truncateToWidth(line, width));
      appendQuestionBlock(
        renderedLines,
        preparedQuestion.question,
        preparedQuestion.markdownCtx,
        width,
        markdownTheme,
        (text) => theme.fg("syntaxString", text),
      );

      const activeEditingCursorIndex = isNoteEditorOpen
        ? linearCursorIndexOf(noteEditor)
        : undefined;
      for (let optionIndex = 0; optionIndex < preparedQuestion.options.length; optionIndex++) {
        const isCursorOption = optionIndex === cursorOptionIndex;
        const isOptionSelected = selectedOptionIndexes.includes(optionIndex);
        appendOptionRow(renderedLines, {
          optionLabel: preparedQuestion.options[optionIndex] as string,
          rawNote: getQuestionNote(questionIndex, optionIndex),
          isCursorOption,
          isSelected: isOptionSelected,
          isEditingThisOption: isNoteEditorOpen && isCursorOption,
          width,
          markdownTheme,
          theme,
          editingCursorIndex: activeEditingCursorIndex,
          styleFor: (isCursor, isSelected) => ({
            marker: preparedQuestion.multi
              ? `${isSelected ? "[x]" : "[ ]"} `
              : `${isSelected ? "●" : "○"} `,
            color: isCursor ? "accent" : isSelected ? "success" : "text",
          }),
        });
      }

      renderedLines.push("");
      if (isNoteEditorOpen) {
        addLine(
          theme.fg(
            "customMessageLabel",
            " Typing note inline • Enter save note • Tab/Esc stop editing • F7 clear text",
          ),
        );
      } else {
        if (preparedQuestion.multi) {
          addLine(
            theme.fg(
              "customMessageLabel",
              " ↑↓ move • Enter toggle/select • Tab add note • ←/→ switch tabs • F6 exit entirely",
            ),
          );
        } else {
          addLine(
            theme.fg(
              "customMessageLabel",
              " ↑↓ move • Enter select • Tab add note • ←/→ switch tabs • F6 exit entirely",
            ),
          );
        }
      }
    };

    const render = (width: number): string[] => {
      if (cache.cachedRenderedLines && cache.cachedRenderedWidth === width)
        return cache.cachedRenderedLines;

      const renderedLines: string[] = [];
      const addLine = (line: string) => renderedLines.push(truncateToWidth(line, width));

      addLine(theme.fg("accent", "─".repeat(width)));
      addLine(` ${renderTabs()}`);
      renderedLines.push("");

      if (activeTabIndex === submitTabIndex) {
        renderSubmitTab(width, renderedLines);
      } else {
        renderQuestionTab(width, renderedLines, activeTabIndex);
      }

      addLine(theme.fg("accent", "─".repeat(width)));
      cache.cachedRenderedLines = renderedLines;
      cache.cachedRenderedWidth = width;
      return renderedLines;
    };

    const handleInput = (data: string) => {
      if (matchesKey(data, Key.ctrl("c"))) {
        done(
          createTabsUiStateSnapshot(true, selectedOptionIndexesByQuestion, noteByQuestionByOption),
        );
        return;
      }

      if (isNoteEditorOpen) {
        handleNoteEditorInput(data, noteEditor, {
          onCloseEditor: () => {
            isNoteEditorOpen = false;
          },
          requestRerender: rerender,
        });
        return;
      }

      if (matchesKey(data, Key.left)) {
        activeTabIndex =
          (activeTabIndex - 1 + preparedQuestions.length + 1) % (preparedQuestions.length + 1);
        rerender();
        return;
      }

      if (matchesKey(data, Key.right)) {
        activeTabIndex = (activeTabIndex + 1) % (preparedQuestions.length + 1);
        rerender();
        return;
      }

      if (activeTabIndex === submitTabIndex) {
        if (matchesKey(data, Key.enter) && isAllQuestionSelectionsValid()) {
          done(
            createTabsUiStateSnapshot(
              false,
              selectedOptionIndexesByQuestion,
              noteByQuestionByOption,
            ),
          );
          return;
        }
        if (matchesKey(data, Key.f6)) {
          done(
            createTabsUiStateSnapshot(
              true,
              selectedOptionIndexesByQuestion,
              noteByQuestionByOption,
            ),
          );
        }
        return;
      }

      const questionIndex = activeTabIndex;
      const preparedQuestion = preparedQuestions[questionIndex];

      if (matchesKey(data, Key.up)) {
        cursorOptionIndexByQuestion[questionIndex] = Math.max(
          0,
          cursorOptionIndexByQuestion[questionIndex] - 1,
        );
        rerender();
        return;
      }

      if (matchesKey(data, Key.down)) {
        cursorOptionIndexByQuestion[questionIndex] = Math.min(
          preparedQuestion.options.length - 1,
          cursorOptionIndexByQuestion[questionIndex] + 1,
        );
        rerender();
        return;
      }

      if (matchesKey(data, Key.tab)) {
        openNoteEditorForActiveOption();
        return;
      }

      if (matchesKey(data, Key.enter)) {
        const cursorOptionIndex = cursorOptionIndexByQuestion[questionIndex];

        if (preparedQuestion.multi) {
          const currentlySelected = selectedOptionIndexesByQuestion[questionIndex];
          if (currentlySelected.includes(cursorOptionIndex)) {
            selectedOptionIndexesByQuestion[questionIndex] = removeIndexFromSelection(
              currentlySelected,
              cursorOptionIndex,
            );
          } else {
            selectedOptionIndexesByQuestion[questionIndex] = addIndexToSelection(
              currentlySelected,
              cursorOptionIndex,
            );
          }

          if (
            cursorOptionIndex === preparedQuestion.otherOptionIndex &&
            selectedOptionIndexesByQuestion[questionIndex].includes(cursorOptionIndex) &&
            getQuestionNote(questionIndex, cursorOptionIndex).trim().length === 0
          ) {
            openNoteEditorForActiveOption();
            return;
          }

          rerender();
          return;
        }

        selectedOptionIndexesByQuestion[questionIndex] = [cursorOptionIndex];
        if (
          cursorOptionIndex === preparedQuestion.otherOptionIndex &&
          getQuestionNote(questionIndex, cursorOptionIndex).trim().length === 0
        ) {
          openNoteEditorForActiveOption();
          return;
        }

        advanceToNextTabOrSubmit();
        rerender();
        return;
      }

      if (matchesKey(data, Key.f6)) {
        done(
          createTabsUiStateSnapshot(true, selectedOptionIndexesByQuestion, noteByQuestionByOption),
        );
      }
    };

    return {
      render,
      invalidate: () => {
        cache.cachedRenderedLines = undefined;
        cache.cachedRenderedWidth = undefined;
      },
      handleInput,
    };
  });

  if (result.cancelled) {
    return {
      cancelled: true,
      selections: preparedQuestions.map(() => ({ selectedOptions: [] }) satisfies AskSelection),
    };
  }

  const selections = preparedQuestions.map((preparedQuestion, questionIndex) =>
    buildSelectionForQuestion(
      preparedQuestion,
      result.selectedOptionIndexesByQuestion[questionIndex] ?? [],
      result.noteByQuestionByOption[questionIndex] ??
        Array(preparedQuestion.options.length).fill(""),
    ),
  );

  return { cancelled: result.cancelled, selections };
}
