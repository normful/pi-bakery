import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import {
  OTHER_OPTION,
  appendRecommendedTagToOptionLabels,
  buildSingleSelectionResult,
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

interface InlineSelectionResult {
  cancelled: boolean;
  selectedOption?: string;
  note?: string;
}

export async function askSingleQuestionWithInlineNote(
  ui: ExtensionUIContext,
  questionInput: AskQuestion,
): Promise<AskSelection> {
  const baseOptionLabels = questionInput.options.map((option) => option.label);
  const optionLabelsWithRecommendedTag = appendRecommendedTagToOptionLabels(
    baseOptionLabels,
    questionInput.recommended,
  );
  const selectableOptionLabels = [...optionLabelsWithRecommendedTag, OTHER_OPTION];
  const initialCursorIndex = clampOptionIndex(
    questionInput.recommended,
    optionLabelsWithRecommendedTag.length,
  );

  alertUser();
  const result = await ui.custom<InlineSelectionResult>((tui, theme, _keybindings, done) => {
    let cursorOptionIndex = initialCursorIndex;
    let isNoteEditorOpen = false;
    const cache = createRenderCache();
    const noteByOptionIndex = new Map<number, string>();

    const noteEditor = createOptionNoteEditor(tui, theme);
    const markdownTheme = createMarkdownTheme(theme);

    const rerender = () => requestRerender(tui, cache);

    const getRawNoteForOption = (optionIndex: number): string =>
      noteByOptionIndex.get(optionIndex) ?? "";
    const getTrimmedNoteForOption = (optionIndex: number): string =>
      getRawNoteForOption(optionIndex).trim();

    const loadCurrentNoteIntoEditor = () => {
      noteEditor.setText(getRawNoteForOption(cursorOptionIndex));
    };

    const saveCurrentNoteFromEditor = (value: string) => {
      noteByOptionIndex.set(cursorOptionIndex, value);
    };

    const submitCurrentSelection = (selectedOptionLabel: string, note: string) => {
      done({
        cancelled: false,
        selectedOption: selectedOptionLabel,
        note,
      });
    };

    noteEditor.onChange = (value) => {
      saveCurrentNoteFromEditor(value);
    };

    noteEditor.onSubmit = (value) => {
      saveCurrentNoteFromEditor(value);
      const selectedOptionLabel = selectableOptionLabels[cursorOptionIndex];
      const trimmedNote = value.trim();

      if (selectedOptionLabel === OTHER_OPTION && !trimmedNote) {
        rerender();
        return;
      }

      submitCurrentSelection(selectedOptionLabel, trimmedNote);
    };

    const render = (width: number): string[] => {
      if (cache.cachedRenderedLines && cache.cachedRenderedWidth === width)
        return cache.cachedRenderedLines;

      const renderedLines: string[] = [];
      const addLine = (line: string) => renderedLines.push(truncateToWidth(line, width));

      addLine(theme.fg("accent", "─".repeat(width)));
      appendQuestionBlock(
        renderedLines,
        questionInput.question,
        questionInput.markdownCtx,
        width,
        markdownTheme,
        (text) => theme.fg("syntaxString", text),
      );

      const activeEditingCursorIndex = isNoteEditorOpen
        ? linearCursorIndexOf(noteEditor)
        : undefined;
      for (let optionIndex = 0; optionIndex < selectableOptionLabels.length; optionIndex++) {
        const isCursorOption = optionIndex === cursorOptionIndex;
        appendOptionRow(renderedLines, {
          optionLabel: selectableOptionLabels[optionIndex] as string,
          rawNote: getRawNoteForOption(optionIndex),
          isCursorOption,
          isSelected: false,
          isEditingThisOption: isNoteEditorOpen && isCursorOption,
          width,
          markdownTheme,
          theme,
          editingCursorIndex: activeEditingCursorIndex,
          styleFor: (isCursor) => ({
            marker: `${isCursor ? "●" : "○"} `,
            color: isCursor ? "accent" : "text",
          }),
        });
      }

      renderedLines.push("");

      if (isNoteEditorOpen) {
        addLine(
          theme.fg(
            "customMessageLabel",
            " Typing note inline • Enter submit • Tab/Esc stop editing • F7 clear text",
          ),
        );
      } else if (getTrimmedNoteForOption(cursorOptionIndex).length > 0) {
        addLine(
          theme.fg(
            "customMessageLabel",
            " ↑↓ move • Enter submit • Tab edit note • F6 exit entirely",
          ),
        );
      } else {
        addLine(
          theme.fg(
            "customMessageLabel",
            " ↑↓ move • Enter submit • Tab add note • F6 exit entirely",
          ),
        );
      }

      addLine(theme.fg("accent", "─".repeat(width)));
      cache.cachedRenderedLines = renderedLines;
      cache.cachedRenderedWidth = width;
      return renderedLines;
    };

    const handleInput = (data: string) => {
      if (matchesKey(data, Key.ctrl("c"))) {
        done({ cancelled: true });
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

      if (matchesKey(data, Key.up)) {
        cursorOptionIndex = Math.max(0, cursorOptionIndex - 1);
        rerender();
        return;
      }
      if (matchesKey(data, Key.down)) {
        cursorOptionIndex = Math.min(selectableOptionLabels.length - 1, cursorOptionIndex + 1);
        rerender();
        return;
      }

      if (matchesKey(data, Key.tab)) {
        isNoteEditorOpen = true;
        loadCurrentNoteIntoEditor();
        rerender();
        return;
      }

      if (matchesKey(data, Key.enter)) {
        const selectedOptionLabel = selectableOptionLabels[cursorOptionIndex];
        const trimmedNote = getTrimmedNoteForOption(cursorOptionIndex);

        if (selectedOptionLabel === OTHER_OPTION && !trimmedNote) {
          isNoteEditorOpen = true;
          loadCurrentNoteIntoEditor();
          rerender();
          return;
        }

        submitCurrentSelection(selectedOptionLabel, trimmedNote);
        return;
      }

      if (matchesKey(data, Key.f6)) {
        done({ cancelled: true });
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

  if (result.cancelled || !result.selectedOption) {
    return { selectedOptions: [] };
  }

  return buildSingleSelectionResult(result.selectedOption, result.note);
}
