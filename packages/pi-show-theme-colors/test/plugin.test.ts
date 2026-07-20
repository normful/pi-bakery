import { describe, it, expect, vi } from "vitest";

vi.mock("@spences10/pi-tui-modal", () => ({
  show_text_modal: vi.fn(),
}));

import extension, { ALL_COLORS, buildColorDisplayLines } from "../src/index.js";

describe("theme-colors command registration", () => {
  it("registers a command named 'theme-colors'", () => {
    const registerCommand = vi.fn();
    extension({ registerCommand } as any);
    expect(registerCommand).toHaveBeenCalledWith("theme-colors", expect.any(Object));
  });
});

describe("theme-colors handler", () => {
  function makeHandler() {
    const registerCommand = vi.fn();
    extension({ registerCommand } as any);
    const [, { handler }] = registerCommand.mock.calls[0];
    return handler;
  }

  it("passes the theme name into the modal title", async () => {
    const { show_text_modal } = await import("@spences10/pi-tui-modal");
    const handler = makeHandler();

    const ctx = {
      ui: {
        theme: {
          name: "Catppuccin Mocha",
          getFgAnsi: vi.fn(() => "\x1b[38;5;2m"),
        },
      },
    };
    await handler("", ctx as any);

    expect(show_text_modal).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        title: "Colors of current theme: Catppuccin Mocha",
      }),
    );
  });

  it("falls back to '(unknown)' when the theme has no name", async () => {
    const { show_text_modal } = await import("@spences10/pi-tui-modal");
    const handler = makeHandler();

    const ctx = {
      ui: {
        theme: {
          name: undefined,
          getFgAnsi: vi.fn(() => "\x1b[38;5;7m"),
        },
      },
    };
    await handler("", ctx as any);

    expect(show_text_modal).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        title: "Colors of current theme: (unknown)",
      }),
    );
  });

  it("sends buildColorDisplayLines output as modal text", async () => {
    const { show_text_modal } = await import("@spences10/pi-tui-modal");
    const handler = makeHandler();

    const ctx = {
      ui: {
        theme: {
          name: "Test",
          getFgAnsi: vi.fn(() => "\x1b[38;5;2m"),
        },
      },
    };
    await handler("", ctx as any);

    const [, options] = show_text_modal.mock.calls[0];
    const expectedText = buildColorDisplayLines(ctx.ui.theme, ALL_COLORS).join("\n");
    expect(options.text).toBe(expectedText);
  });

  it("calls getFgAnsi for every color in ALL_COLORS", async () => {
    await import("@spences10/pi-tui-modal");
    const getFgAnsi = vi.fn(() => "\x1b[38;5;2m");
    const handler = makeHandler();

    const ctx = {
      ui: {
        theme: {
          name: "Test",
          getFgAnsi,
        },
      },
    };
    await handler("", ctx as any);

    expect(getFgAnsi).toHaveBeenCalledTimes(ALL_COLORS.length);
    for (const color of ALL_COLORS) {
      expect(getFgAnsi).toHaveBeenCalledWith(color);
    }
  });
});
