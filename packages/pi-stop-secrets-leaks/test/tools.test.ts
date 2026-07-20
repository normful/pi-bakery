import { describe, expect, it } from "vitest";
import {
  extractPathFromInput,
  isReadLikeTool,
  isWriteLikeTool,
  shouldBother,
  shouldRedactTool,
} from "../src/tools.js";

describe("shouldRedactTool", () => {
  it("returns true for built-ins: read", () => {
    expect(shouldRedactTool("read")).toBe(true);
  });

  it("returns true for built-ins: bash", () => {
    expect(shouldRedactTool("bash")).toBe(true);
  });

  it("returns true for built-ins: grep", () => {
    expect(shouldRedactTool("grep")).toBe(true);
  });

  it("returns true for built-ins: find", () => {
    expect(shouldRedactTool("find")).toBe(true);
  });

  it("returns true for built-ins: shell", () => {
    expect(shouldRedactTool("shell")).toBe(true);
  });

  it("returns true for custom names containing substrings", () => {
    expect(shouldRedactTool("my_read_file")).toBe(true);
    expect(shouldRedactTool("cat_logs")).toBe(true);
    expect(shouldRedactTool("exec_remote")).toBe(true);
    expect(shouldRedactTool("search_code")).toBe(true);
    expect(shouldRedactTool("run_command")).toBe(true);
  });

  it("returns true for ctx_* prefixed tools (regression)", () => {
    expect(shouldRedactTool("ctx_shell")).toBe(true);
    expect(shouldRedactTool("ctx_read")).toBe(true);
    expect(shouldRedactTool("ctx_grep")).toBe(true);
    expect(shouldRedactTool("ctx_find")).toBe(true);
  });

  it("returns true for *_search suffix tools", () => {
    expect(shouldRedactTool("web_search")).toBe(true);
  });

  it("returns false for unrelated tools", () => {
    expect(shouldRedactTool("todo")).toBe(false);
    expect(shouldRedactTool("image_gen")).toBe(false);
    expect(shouldRedactTool("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(shouldRedactTool("READ")).toBe(true);
    expect(shouldRedactTool("Bash")).toBe(true);
    expect(shouldRedactTool("GREP")).toBe(true);
  });
});

describe("isReadLikeTool", () => {
  it("true for read-like built-ins", () => {
    expect(isReadLikeTool("read")).toBe(true);
    expect(isReadLikeTool("cat")).toBe(true);
    expect(isReadLikeTool("view")).toBe(true);
    expect(isReadLikeTool("show")).toBe(true);
    expect(isReadLikeTool("dump")).toBe(true);
  });

  it("true for custom read-like names containing substrings", () => {
    expect(isReadLikeTool("my_read_file")).toBe(true);
  });

  it("true for ctx_* prefixed read tools (regression)", () => {
    expect(isReadLikeTool("ctx_read")).toBe(true);
  });

  it("false for non-read tools", () => {
    expect(isReadLikeTool("bash")).toBe(false);
    expect(isReadLikeTool("write")).toBe(false);
    expect(isReadLikeTool("grep")).toBe(false);
  });

  it("case-insensitive", () => {
    expect(isReadLikeTool("READ")).toBe(true);
    expect(isReadLikeTool("Cat")).toBe(true);
  });
});

describe("isWriteLikeTool", () => {
  it("true for write-like built-ins", () => {
    expect(isWriteLikeTool("write")).toBe(true);
    expect(isWriteLikeTool("edit")).toBe(true);
    expect(isWriteLikeTool("overwrite")).toBe(true);
    expect(isWriteLikeTool("save")).toBe(true);
    expect(isWriteLikeTool("create_file")).toBe(true);
  });

  it("true for ctx_* prefixed write tools (regression)", () => {
    expect(isWriteLikeTool("ctx_write")).toBe(true);
  });

  it("false for non-write tools", () => {
    expect(isWriteLikeTool("read")).toBe(false);
    expect(isWriteLikeTool("bash")).toBe(false);
  });

  it("case-insensitive", () => {
    expect(isWriteLikeTool("WRITE")).toBe(true);
    expect(isWriteLikeTool("Edit")).toBe(true);
  });
});

describe("extractPathFromInput", () => {
  it("returns input.path when string", () => {
    expect(extractPathFromInput({ path: "/tmp/foo.txt" })).toBe("/tmp/foo.txt");
  });

  it("falls back to input.file", () => {
    expect(extractPathFromInput({ file: "/tmp/bar.txt" })).toBe("/tmp/bar.txt");
  });

  it("falls back to input.filename", () => {
    expect(extractPathFromInput({ filename: "/tmp/baz.txt" })).toBe("/tmp/baz.txt");
  });

  it("prefers path over file over filename", () => {
    expect(
      extractPathFromInput({
        path: "/p.txt",
        file: "/f.txt",
        filename: "/n.txt",
      }),
    ).toBe("/p.txt");
  });

  it("returns undefined for missing", () => {
    expect(extractPathFromInput(undefined)).toBeUndefined();
    expect(extractPathFromInput(null)).toBeUndefined();
  });

  it("returns undefined for non-object", () => {
    expect(extractPathFromInput("not-an-object")).toBeUndefined();
    expect(extractPathFromInput(42)).toBeUndefined();
  });

  it("returns undefined for non-string fields", () => {
    expect(extractPathFromInput({ path: 42 })).toBeUndefined();
    expect(extractPathFromInput({ file: null })).toBeUndefined();
  });

  it("returns undefined for empty string fields", () => {
    expect(extractPathFromInput({ path: "" })).toBeUndefined();
  });

  it("returns undefined when no known keys present", () => {
    expect(extractPathFromInput({ other: "/x.txt" })).toBeUndefined();
  });
});

describe("shouldBother", () => {
  it("false for empty string", () => {
    expect(shouldBother("")).toBe(false);
  });

  it("false for length under 5", () => {
    expect(shouldBother("abc")).toBe(false);
    expect(shouldBother("a".repeat(4))).toBe(false);
  });

  it("true for longer text", () => {
    expect(shouldBother("a".repeat(5))).toBe(true);
    expect(
      shouldBother(
        "This is a longer piece of text that could contain sensitive data like tokens or keys.",
      ),
    ).toBe(true);
  });

  it("false for whitespace-only short text", () => {
    expect(shouldBother("   ")).toBe(false);
  });

  it("true for longer prose with secrets", () => {
    const prose =
      "The connection string is host=localhost user=admin password=somepasswordhere and more";
    expect(shouldBother(prose)).toBe(true);
  });
});
