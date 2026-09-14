import { describe, expect, it } from "vitest";
import { initTheme, type Theme } from "@earendil-works/pi-coding-agent";
import { createMarkdownTheme } from "../src/ask-ui-shared.js";

const THEME_KEY = Symbol.for("@earendil-works/pi-coding-agent:theme");

function createFakeTheme(): Theme {
  return {
    fg: (_color: string, text: string) => text,
    bg: (_color: string, text: string) => text,
    bold: (text: string) => text,
    italic: (text: string) => text,
    underline: (text: string) => text,
    strikethrough: (text: string) => text,
  } as unknown as Theme;
}

function withoutGlobalTheme<T>(run: () => T): T {
  const globals = globalThis as unknown as Record<symbol, unknown>;
  const previous = globals[THEME_KEY];
  delete globals[THEME_KEY];
  try {
    return run();
  } finally {
    if (previous !== undefined) globals[THEME_KEY] = previous;
  }
}

describe("createMarkdownTheme", () => {
  it("syntax-highlights fenced code blocks via pi's theme", () => {
    initTheme("dark");
    const markdownTheme = createMarkdownTheme(createFakeTheme());

    expect(markdownTheme.highlightCode).toBeTypeOf("function");

    const highlighted = markdownTheme.highlightCode!("const answer = 42;", "js").join("\n");
    expect(highlighted).toContain("\u001b[");
    expect(highlighted).toContain("answer");
  });

  it("falls back to plain code-block styling when no global theme is available", () => {
    const markdownTheme = createMarkdownTheme(createFakeTheme());

    const plain = withoutGlobalTheme(() =>
      markdownTheme.highlightCode!("const answer = 42;", "js"),
    );

    expect(plain).toEqual(["const answer = 42;"]);
  });
});
