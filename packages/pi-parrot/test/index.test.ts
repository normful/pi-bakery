import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";

vi.mock("../src/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/config.js")>();
  return {
    ...actual,
    USER_CONFIG_PATH: "/fake/home/.config/pi-parrot/config.json",
    loadConfig: vi.fn(() => ({ shortcut: "", editor: "" })),
  };
});

import extension, {
  PARROT_CUSTOM_MESSAGE_TYPE,
  PARROT_DESCRIPTION,
  findLastAssistantMessage,
  getEditorCommand,
  handleEditorResult,
} from "../src/index.js";
import { loadConfig } from "../src/config.js";

beforeEach(() => {
  vi.mocked(loadConfig).mockReset();
  vi.mocked(loadConfig).mockReturnValue({ shortcut: "", editor: "" });
});

function messageEntry(role: string, texts: string[]): SessionEntry {
  return {
    type: "message",
    message: {
      role,
      content: texts.map((text) => ({ type: "text", text })),
    },
  } as unknown as SessionEntry;
}

describe("findLastAssistantMessage", () => {
  it("returns undefined for an empty branch", () => {
    expect(findLastAssistantMessage([])).toBeUndefined();
  });

  it("returns undefined when there are no assistant messages", () => {
    expect(findLastAssistantMessage([messageEntry("user", ["hi"])])).toBeUndefined();
  });

  it("returns the last assistant message text", () => {
    const branch = [
      messageEntry("assistant", ["first"]),
      messageEntry("user", ["question"]),
      messageEntry("assistant", ["second"]),
    ];
    expect(findLastAssistantMessage(branch)).toBe("second");
  });

  it("joins multiple text parts with a blank line", () => {
    expect(findLastAssistantMessage([messageEntry("assistant", ["a", "b"])])).toBe("a\n\nb");
  });

  it("skips non-text content parts", () => {
    const entry = {
      type: "message",
      message: {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "hmm" },
          { type: "text", text: "visible" },
        ],
      },
    } as unknown as SessionEntry;
    expect(findLastAssistantMessage([entry])).toBe("visible");
  });

  it("skips assistant messages with no text parts", () => {
    const noText = {
      type: "message",
      message: {
        role: "assistant",
        content: [{ type: "thinking", thinking: "hmm" }],
      },
    } as unknown as SessionEntry;
    const branch = [messageEntry("assistant", ["kept"]), noText];
    expect(findLastAssistantMessage(branch)).toBe("kept");
  });

  it("skips non-message entries", () => {
    const branch = [
      messageEntry("assistant", ["kept"]),
      { type: "custom", customType: "x" } as unknown as SessionEntry,
    ];
    expect(findLastAssistantMessage(branch)).toBe("kept");
  });
});

describe("getEditorCommand", () => {
  const prevVisual = process.env.VISUAL;
  const prevEditor = process.env.EDITOR;

  afterEach(() => {
    if (prevVisual === undefined) delete process.env.VISUAL;
    else process.env.VISUAL = prevVisual;
    if (prevEditor === undefined) delete process.env.EDITOR;
    else process.env.EDITOR = prevEditor;
  });

  it("prefers $VISUAL over $EDITOR", () => {
    process.env.VISUAL = "code -w";
    process.env.EDITOR = "my-editor";
    expect(getEditorCommand()).toBe("code -w");
  });

  it("falls back to $EDITOR", () => {
    delete process.env.VISUAL;
    process.env.EDITOR = "my-editor";
    expect(getEditorCommand()).toBe("my-editor");
  });

  it("returns empty string when neither is set", () => {
    delete process.env.VISUAL;
    delete process.env.EDITOR;
    expect(getEditorCommand()).toBe("");
  });

  it("prefers the configured editor over $VISUAL and $EDITOR", () => {
    process.env.VISUAL = "code -w";
    process.env.EDITOR = "my-editor";
    expect(getEditorCommand("hx")).toBe("hx");
  });
});

describe("handleEditorResult", () => {
  function makeUi() {
    return { notify: vi.fn() };
  }

  it("notifies an error and does not send", () => {
    const ui = makeUi();
    const sendMessage = vi.fn();
    handleEditorResult({ content: "x", error: "boom", exitCode: 1 }, ui as any, sendMessage as any);
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("boom"), "error");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("warns on nonzero exit and does not send", () => {
    const ui = makeUi();
    const sendMessage = vi.fn();
    handleEditorResult({ content: "x", error: null, exitCode: 3 }, ui as any, sendMessage as any);
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("3"), "warning");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("notifies when there is no content to send", () => {
    const ui = makeUi();
    const sendMessage = vi.fn();
    handleEditorResult({ content: null, error: null, exitCode: 0 }, ui as any, sendMessage as any);
    expect(ui.notify).toHaveBeenCalledWith("No message to send", "info");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends the edited content as a steering custom message", () => {
    const ui = makeUi();
    const sendMessage = vi.fn();
    handleEditorResult(
      { content: "edited!", error: null, exitCode: 0 },
      ui as any,
      sendMessage as any,
    );
    expect(sendMessage).toHaveBeenCalledWith(
      {
        customType: PARROT_CUSTOM_MESSAGE_TYPE,
        content: "edited!",
        display: true,
      },
      { triggerTurn: true, deliverAs: "steer" },
    );
  });
});

describe("parrot registration", () => {
  function load() {
    const registerCommand = vi.fn();
    const registerShortcut = vi.fn();
    extension({ registerCommand, registerShortcut } as any);
    return { registerCommand, registerShortcut };
  }

  it("registers the 'parrot' command with the shared description", () => {
    const { registerCommand } = load();
    expect(registerCommand).toHaveBeenCalledWith(
      "parrot",
      expect.objectContaining({ description: PARROT_DESCRIPTION }),
    );
  });

  it("registers the configured shortcut with the shared description", () => {
    vi.mocked(loadConfig).mockReturnValue({ shortcut: "ctrl+g", editor: "" });
    const { registerShortcut } = load();
    expect(registerShortcut).toHaveBeenCalledWith(
      "ctrl+g",
      expect.objectContaining({ description: PARROT_DESCRIPTION }),
    );
  });

  it("registers no shortcut by default, without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { registerCommand, registerShortcut } = load();
      expect(registerShortcut).not.toHaveBeenCalled();
      expect(registerCommand).toHaveBeenCalledWith("parrot", expect.any(Object));
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("registers no shortcut and warns on an invalid key", () => {
    vi.mocked(loadConfig).mockReturnValue({ shortcut: "banana", editor: "" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { registerCommand, registerShortcut } = load();
      expect(registerShortcut).not.toHaveBeenCalled();
      expect(registerCommand).toHaveBeenCalledWith("parrot", expect.any(Object));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("banana"));
    } finally {
      warn.mockRestore();
    }
  });
});
