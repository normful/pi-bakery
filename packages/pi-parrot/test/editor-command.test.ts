import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseEditorCommand, runEditor } from "../src/index.js";

afterEach(() => {
  vi.mocked(spawnSync).mockReset();
});

describe("parseEditorCommand", () => {
  it("returns [] for empty or blank input", () => {
    expect(parseEditorCommand("")).toEqual([]);
    expect(parseEditorCommand("   ")).toEqual([]);
  });

  it("splits executable and flags", () => {
    expect(parseEditorCommand("hx")).toEqual(["hx"]);
    expect(parseEditorCommand("code -w")).toEqual(["code", "-w"]);
  });

  it("respects single and double quotes", () => {
    expect(parseEditorCommand('"my editor" --wait')).toEqual(["my editor", "--wait"]);
    expect(parseEditorCommand("editor 'quoted arg'")).toEqual(["editor", "quoted arg"]);
  });

  it("keeps shell metacharacters literal (no shell to interpret them)", () => {
    expect(parseEditorCommand("vim; rm -rf /")).toEqual(["vim;", "rm", "-rf", "/"]);
    expect(parseEditorCommand("a|b")).toEqual(["a|b"]);
  });
});

describe("runEditor (no shell)", () => {
  function makeFile(content = "hello"): string {
    const dir = mkdtempSync(join(tmpdir(), "pi-parrot-editor-cmd-"));
    const file = join(dir, "msg.md");
    writeFileSync(file, content, "utf-8");
    return file;
  }

  it("spawns the executable directly with shell:false and appends the file", () => {
    const file = makeFile();
    try {
      vi.mocked(spawnSync).mockReturnValue({ status: 0 } as never);
      const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      try {
        const result = runEditor(file, "my-editor --wait");
        expect(result).toEqual({ content: "hello", error: null, exitCode: 0 });
      } finally {
        write.mockRestore();
      }
      expect(spawnSync).toHaveBeenCalledOnce();
      const [exe, args, opts] = vi.mocked(spawnSync).mock.calls[0]!;
      expect(exe).toBe("my-editor");
      expect(args).toEqual(["--wait", file]);
      expect(opts).toMatchObject({ shell: false, stdio: "inherit" });
    } finally {
      rmSync(join(file, ".."), { recursive: true, force: true });
    }
  });

  it("passes a file path with spaces as a single argv element", () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-parrot-editor-cmd-"));
    const file = join(dir, "my msg.md");
    writeFileSync(file, "hi", "utf-8");
    try {
      vi.mocked(spawnSync).mockReturnValue({ status: 0 } as never);
      const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      try {
        runEditor(file, "hx");
      } finally {
        write.mockRestore();
      }
      const [, args] = vi.mocked(spawnSync).mock.calls[0]!;
      expect(args).toEqual([file]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not execute injected shell commands", () => {
    const marker = join(tmpdir(), `pi-parrot-pwned-${Date.now()}.marker`);
    const file = makeFile();
    try {
      vi.mocked(spawnSync).mockImplementation((() => ({
        status: null,
        error: new Error("spawn vim; ENOENT"),
      })) as never);
      const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      try {
        runEditor(file, `vim; touch ${marker}`);
      } finally {
        write.mockRestore();
      }
      const [exe] = vi.mocked(spawnSync).mock.calls[0]!;
      expect(exe).toBe("vim;");
      expect(existsSync(marker)).toBe(false);
    } finally {
      rmSync(join(file, ".."), { recursive: true, force: true });
      rmSync(marker, { force: true });
    }
  });

  it("returns the no-editor error for blank commands", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      const result = runEditor("/tmp/whatever.md", "   ");
      expect(result.error).toMatch(/No editor configured/);
      expect(spawnSync).not.toHaveBeenCalled();
    } finally {
      write.mockRestore();
    }
  });
});
