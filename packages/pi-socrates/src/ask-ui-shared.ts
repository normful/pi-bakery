import {
  Editor,
  Key,
  Markdown,
  matchesKey,
  truncateToWidth,
  visibleWidth,
  type EditorTheme,
  type MarkdownTheme,
  type TUI,
} from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import {
  INLINE_NOTE_WRAP_PADDING,
  buildWrappedOptionLabelWithInlineNote,
} from "./ask-inline-note.js";
import { getLinearCursorIndexFromEditor } from "./ask-inline-editor-cursor.js";

// ── Render cache ──────────────────────────────────────────────────────────

export interface RenderCache {
  cachedRenderedLines: string[] | undefined;
  cachedRenderedWidth: number | undefined;
}

export function createRenderCache(): RenderCache {
  return {
    cachedRenderedLines: undefined,
    cachedRenderedWidth: undefined,
  };
}

export function requestRerender(tui: { requestRender(): void }, cache: RenderCache): void {
  cache.cachedRenderedLines = undefined;
  cache.cachedRenderedWidth = undefined;
  tui.requestRender();
}

/**
 * Clamp an option index into [0, maxExclusive). Out-of-range, missing, and
 * NaN inputs fall back to 0 so a stale `recommended` never breaks the UI.
 */
export function clampOptionIndex(index: number | undefined, maxExclusive: number): number {
  if (index == null || Number.isNaN(index) || maxExclusive <= 0) return 0;
  if (index < 0) return 0;
  if (index >= maxExclusive) return maxExclusive - 1;
  return Math.floor(index);
}

// ── Markdown theme ────────────────────────────────────────────────────────

export function createMarkdownTheme(theme: Theme): MarkdownTheme {
  return {
    heading: (text) => theme.fg("mdHeading", text),
    link: (text) => theme.fg("mdLink", text),
    linkUrl: (text) => theme.fg("mdLinkUrl", text),
    code: (text) => theme.fg("mdCode", text),
    codeBlock: (text) => theme.fg("mdCodeBlock", text),
    codeBlockBorder: (text) => theme.fg("mdCodeBlockBorder", text),
    quote: (text) => theme.fg("mdQuote", text),
    quoteBorder: (text) => theme.fg("mdQuoteBorder", text),
    hr: (text) => theme.fg("mdHr", text),
    listBullet: (text) => theme.fg("mdListBullet", text),
    bold: (text) => theme.bold(text),
    italic: (text) => theme.italic(text),
    strikethrough: (text) => theme.strikethrough(text),
    underline: (text) => theme.underline(text),
  };
}

export function createNoteEditorTheme(theme: Theme): EditorTheme {
  return {
    borderColor: (text) => theme.fg("accent", text),
    selectList: {
      selectedPrefix: (text) => theme.fg("accent", text),
      selectedText: (text) => theme.fg("accent", text),
      description: (text) => theme.fg("muted", text),
      scrollInfo: (text) => theme.fg("customMessageLabel", text),
      noMatch: (text) => theme.fg("error", text),
    },
  };
}

function renderMarkdownBlock(
  source: string,
  width: number,
  markdownTheme: MarkdownTheme,
  color: (text: string) => string,
): string[] {
  return new Markdown(source, 0, 0, markdownTheme, { color }).render(Math.max(1, width - 1));
}

/**
 * Render the question prompt plus optional Markdown context above the
 * options. Shared by the single-question and tabbed flows.
 */
export function appendQuestionBlock(
  renderedLines: string[],
  question: string,
  markdownCtx: string | undefined,
  width: number,
  markdownTheme: MarkdownTheme,
  color: (text: string) => string,
): void {
  for (const line of renderMarkdownBlock(question, width, markdownTheme, color)) {
    renderedLines.push(truncateToWidth(` ${line}`, width));
  }
  if (markdownCtx && markdownCtx.trim().length > 0) {
    renderedLines.push("");
    const description = new Markdown(markdownCtx, 0, 0, markdownTheme, { color });
    for (const line of description.render(Math.max(1, width - 1))) {
      renderedLines.push(truncateToWidth(` ${line}`, width));
    }
  }
  renderedLines.push("");
}

export interface OptionRowStyle {
  marker: string;
  color: "accent" | "success" | "text";
}

export interface RenderOptionRowArgs {
  optionLabel: string;
  rawNote: string;
  isCursorOption: boolean;
  isSelected: boolean;
  isEditingThisOption: boolean;
  width: number;
  markdownTheme: MarkdownTheme;
  theme: Theme;
  editingCursorIndex?: number;
  styleFor: (isCursorOption: boolean, isSelected: boolean) => OptionRowStyle;
}

/**
 * Render one option row (with inline note and wrapping) into renderedLines.
 * Shared by the single-question and tabbed flows; only the marker glyph and
 * color rule differ per flow.
 */
export function appendOptionRow(renderedLines: string[], args: RenderOptionRowArgs): void {
  const {
    optionLabel,
    rawNote,
    isCursorOption,
    isEditingThisOption,
    width,
    markdownTheme,
    theme,
    editingCursorIndex,
    styleFor,
  } = args;
  const cursorPrefixText = isCursorOption ? "→ " : "  ";
  const cursorPrefix = isCursorOption ? theme.fg("accent", cursorPrefixText) : cursorPrefixText;
  const { marker: markerText, color: optionColor } = styleFor(isCursorOption, args.isSelected);
  const prefixWidth = visibleWidth(cursorPrefixText) + visibleWidth(markerText);
  const displayLabel =
    !isEditingThisOption && optionLabel.length > 0
      ? new Markdown(optionLabel, 0, 0, markdownTheme).render(Math.max(1, width)).join("\n")
      : optionLabel;
  const wrappedInlineLabelLines = buildWrappedOptionLabelWithInlineNote(
    displayLabel,
    rawNote,
    isEditingThisOption,
    Math.max(1, width - prefixWidth),
    INLINE_NOTE_WRAP_PADDING,
    isEditingThisOption ? editingCursorIndex : undefined,
  );
  const continuationPrefix = " ".repeat(prefixWidth);
  renderedLines.push(
    truncateToWidth(
      `${cursorPrefix}${theme.fg(optionColor, `${markerText}${wrappedInlineLabelLines[0] ?? ""}`)}`,
      width,
    ),
  );
  for (const wrappedLine of wrappedInlineLabelLines.slice(1)) {
    renderedLines.push(
      truncateToWidth(`${continuationPrefix}${theme.fg(optionColor, wrappedLine)}`, width),
    );
  }
}

export function createOptionNoteEditor(tui: TUI, theme: Theme): Editor {
  return new Editor(tui, createNoteEditorTheme(theme));
}

export function linearCursorIndexOf(editor: Pick<Editor, "getLines" | "getCursor">): number {
  return getLinearCursorIndexFromEditor(editor);
}

// ── User alert ──────────────────────────────────────────────────────────

export function alertUser(): void {
  if (!process.stdout.isTTY) return;
  process.stdout.write("");
  process.stdout.write("]777;notify;Pi Ask;Questions awaiting your answer");
}

// ── Note editor key handling ──────────────────────────────────────────────

interface NoteEditorLike {
  setText(text: string): void;
  handleInput(data: string): void;
}

/**
 * Handle key events when the inline note editor is open.
 * Manages Tab/Escape (close editor), F7 (clear text), and normal editing.
 */
export function handleNoteEditorInput(
  data: string,
  noteEditor: NoteEditorLike,
  callbacks: {
    onCloseEditor: () => void;
    requestRerender: () => void;
  },
): void {
  if (matchesKey(data, Key.tab) || matchesKey(data, Key.escape)) {
    callbacks.onCloseEditor();
    callbacks.requestRerender();
    return;
  }
  if (matchesKey(data, Key.f7)) {
    noteEditor.setText("");
    callbacks.requestRerender();
    return;
  }
  noteEditor.handleInput(data);
  callbacks.requestRerender();
}
