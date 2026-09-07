import { state } from "./state.js";
import { EDITOR_TAG, RESET_ALL } from "./ansi.js";

type EditorLike = {
  render: (width: number) => string[];
  getText: () => string;
  borderColor: unknown;
};

export function findEditor(root: unknown): EditorLike | undefined {
  const visited = new Set<unknown>();
  const stack: Array<{ node: unknown; depth: number }> = [{ node: root, depth: 0 }];
  const MAX_DEPTH = 25;
  const MAX_NODES = 5000;
  let seen = 0;
  const push = (node: unknown, depth: number) => {
    if (node !== null && node !== undefined && typeof node === "object") {
      stack.push({ node, depth });
    }
  };
  while (stack.length > 0) {
    const top = stack.pop();
    if (!top) continue;
    const { node, depth } = top;
    if (node === null || node === undefined || typeof node !== "object") continue;
    if (visited.has(node)) continue;
    seen += 1;
    if (seen > MAX_NODES || depth > MAX_DEPTH) continue;
    visited.add(node);
    const rec = node as Partial<EditorLike> & {
      children?: unknown;
      getMountedRoots?: unknown;
      layoutRoot?: unknown;
      implicitScrollView?: unknown;
      implicitDocument?: unknown;
      editorContainer?: unknown;
      editor?: unknown;
      defaultEditor?: unknown;
    };
    if (
      typeof rec.render === "function" &&
      typeof rec.getText === "function" &&
      "borderColor" in node
    ) {
      return node as EditorLike;
    }
    if (depth >= MAX_DEPTH) continue;
    if (Array.isArray(rec.children)) {
      for (const child of rec.children) push(child, depth + 1);
    }
    if (typeof rec.getMountedRoots === "function") {
      try {
        const roots = (rec.getMountedRoots as (this: unknown) => unknown).call(node);
        if (Array.isArray(roots)) {
          for (const child of roots) push(child, depth + 1);
        }
      } catch {}
    }
    push(rec.layoutRoot, depth + 1);
    push(rec.implicitScrollView, depth + 1);
    push(rec.implicitDocument, depth + 1);
    push(rec.editorContainer, depth + 1);
    push(rec.editor, depth + 1);
    push(rec.defaultEditor, depth + 1);
  }
  return undefined;
}

export function wrapEditorRender(): void {
  if (!state.tuiRef) return;
  const editor = findEditor(state.tuiRef);
  if (!editor) return;
  if (state.patchedEditor === editor) return;
  if (state.patchedEditor && state.savedEditorRender) {
    state.patchedEditor.render = state.savedEditorRender;
    state.patchedEditor = undefined;
    state.savedEditorRender = undefined;
  }
  const orig = editor.render.bind(editor);
  state.savedEditorRender = orig;
  state.patchedEditor = editor;
  editor.render = (width: number): string[] =>
    orig(width).map((line) => `${RESET_ALL}${EDITOR_TAG}${line}`);
}

export function restoreEditorRender(): void {
  if (state.patchedEditor && state.savedEditorRender) {
    state.patchedEditor.render = state.savedEditorRender;
  }
  state.patchedEditor = undefined;
  state.savedEditorRender = undefined;
}

export function rerenderTui() {
  state.tuiRef?.invalidate();
  state.tuiRef?.requestRender();
}
