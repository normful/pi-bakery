import { describe, it, expect, vi } from "vitest";
import { buildContext } from "../src/context.js";
import type { Config } from "../src/config.js";

function msg(role: "user" | "assistant", content: unknown) {
  return { type: "message", message: { role, content } };
}

function mkCtx(entries: unknown[]) {
  const buildContextEntries = vi.fn(() => entries);
  return { sessionManager: { buildContextEntries } } as any;
}

function cfg(depth: Config["namingContextDepth"]): Config {
  return { namingContextDepth: depth } as Config;
}

describe("extractText behavior through buildContext", () => {
  it("reads string user content", async () => {
    const ctx = mkCtx([msg("user", "Hello there")]);
    const out = await buildContext(ctx, cfg("first-user-message"));
    expect(out?.firstUserMessage).toBe("Hello there");
  });

  it("joins text blocks from array content and skips non-text blocks", async () => {
    const ctx = mkCtx([
      msg("user", [
        { type: "text", text: "First part" },
        { type: "image", source: { type: "url" } },
        { type: "text", text: "second part" },
      ]),
    ]);
    const out = await buildContext(ctx, cfg("first-user-message"));
    expect(out?.firstUserMessage).toBe("First part\nsecond part");
  });

  it("skips empty and whitespace-only user messages", async () => {
    const ctx = mkCtx([msg("user", "   "), msg("user", ""), msg("user", "Real")]);
    const out = await buildContext(ctx, cfg("first-user-message"));
    expect(out?.firstUserMessage).toBe("Real");
  });

  it("returns undefined when there is no user message", async () => {
    const ctx = mkCtx([msg("assistant", "Hi, how can I help?")]);
    expect(await buildContext(ctx, cfg("first-user-message"))).toBeUndefined();
  });
});

describe("recent-user-messages depth", () => {
  it("collects the first message and up to 3 recent (excluding first)", async () => {
    const ctx = mkCtx([
      msg("user", "first"),
      msg("assistant", "ok"),
      msg("user", "two"),
      msg("user", "three"),
      msg("user", "four"),
      msg("user", "five"),
    ]);
    const out = await buildContext(ctx, cfg("recent-user-messages"));
    expect(out?.firstUserMessage).toBe("first");
    expect(out?.recentUserMessages).toEqual(["three", "four", "five"]);
  });

  it("excludes the first message from recent even when it is among the last 3", async () => {
    const ctx = mkCtx([msg("user", "first"), msg("user", "second"), msg("user", "third")]);
    const out = await buildContext(ctx, cfg("recent-user-messages"));
    expect(out?.firstUserMessage).toBe("first");
    expect(out?.recentUserMessages).toEqual(["second", "third"]);
  });

  it("returns an empty recent list when only one user message exists", async () => {
    const ctx = mkCtx([msg("user", "only")]);
    const out = await buildContext(ctx, cfg("recent-user-messages"));
    expect(out?.recentUserMessages).toEqual([]);
  });

  it("captures the first assistant message for topic-project context", async () => {
    const ctx = mkCtx([
      msg("user", "hello"),
      msg("assistant", "I will help you"),
      msg("user", "do it"),
    ]);
    const out = await buildContext(ctx, cfg("recent-user-messages"));
    expect(out?.firstAssistantMessage).toBe("I will help you");
  });

  it("uses the compaction-aware buildContextEntries view", async () => {
    const ctx = mkCtx([msg("user", "x")]);
    await buildContext(ctx, cfg("recent-user-messages"));
    expect(ctx.sessionManager.buildContextEntries).toHaveBeenCalledTimes(1);
  });
});

describe("full-conversation depth", () => {
  it("serializes User:/Assistant:/Tool lines", async () => {
    const ctx = mkCtx([
      msg("user", "first"),
      msg("assistant", [
        { type: "text", text: "Let me check" },
        {
          type: "toolCall",
          name: "read",
          arguments: { path: "a.ts" },
        },
      ]),
      msg("user", "thanks"),
    ]);
    const out = await buildContext(ctx, cfg("full-conversation"));
    expect(out?.fullText).toContain("User: first");
    expect(out?.fullText).toContain("Assistant: Let me check");
    expect(out?.fullText).toContain('read tool called; args {"path":"a.ts"}');
    expect(out?.fullText).toContain("User: thanks");
  });

  it("still returns firstUserMessage and firstAssistantMessage", async () => {
    const ctx = mkCtx([msg("user", "hello"), msg("assistant", "hi")]);
    const out = await buildContext(ctx, cfg("full-conversation"));
    expect(out?.firstUserMessage).toBe("hello");
    expect(out?.firstAssistantMessage).toBe("hi");
  });

  it("returns a context with empty first message when only non-user content exists", async () => {
    const ctx = mkCtx([msg("assistant", "hello")]);
    const out = await buildContext(ctx, cfg("full-conversation"));
    expect(out).toBeDefined();
    expect(out?.firstUserMessage).toBe("");
    expect(out?.recentUserMessages).toEqual([]);
    expect(out?.fullText).toContain("Assistant: hello");
  });

  it("truncates oversized conversations keeping the head and the newest tail", async () => {
    const longAssistant = "a".repeat(70_000);
    const ctx = mkCtx([msg("user", "start"), msg("assistant", longAssistant)]);
    const out = await buildContext(ctx, cfg("full-conversation"));
    expect(out?.fullText).toContain("[Earlier conversation omitted]");
    // both the topic-defining head and the most recent tail survive truncation
    expect(out?.fullText?.startsWith("User: start")).toBe(true);
    expect(out?.fullText?.endsWith(longAssistant.slice(-100))).toBe(true);
    // content is capped at the budget plus a bounded omission-marker overhead
    expect(out!.fullText!.length).toBeLessThanOrEqual(60_000 + 64);
  });

  it("preserves the topic-defining opening when the conversation overflows", async () => {
    const longAssistant = "b".repeat(70_000);
    const ctx = mkCtx([msg("user", "FIX THE OAUTH CALLBACK"), msg("assistant", longAssistant)]);
    const out = await buildContext(ctx, cfg("full-conversation"));
    expect(out!.fullText!.startsWith("User: FIX THE OAUTH CALLBACK")).toBe(true);
  });

  it("serializes tool results alongside their calls", async () => {
    const ctx = mkCtx([
      msg("user", "first"),
      msg("assistant", [{ type: "toolCall", name: "read", arguments: { path: "a.ts" } }]),
      {
        type: "message",
        message: {
          role: "toolResult",
          toolCallId: "call_1",
          toolName: "read",
          isError: false,
          content: [{ type: "text", text: "found the bug in a.ts" }],
        },
      },
    ]);
    const out = await buildContext(ctx, cfg("full-conversation"));
    expect(out?.fullText).toContain('read tool called; args {"path":"a.ts"}');
    expect(out?.fullText).toContain("Result from read: found the bug in a.ts");
  });

  it("marks failed tool results as errors", async () => {
    const ctx = mkCtx([
      {
        type: "message",
        message: {
          role: "toolResult",
          toolCallId: "call_2",
          toolName: "grep",
          isError: true,
          content: [{ type: "text", text: "no matches found" }],
        },
      },
    ]);
    const out = await buildContext(ctx, cfg("full-conversation"));
    expect(out?.fullText).toContain("Result from grep");
    expect(out?.fullText).toContain("[error]");
  });
});
