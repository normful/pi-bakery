import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Config } from "../src/config.js";
import type { NamingContext } from "../src/context.js";
import {
  RETRIES,
  UI_RENAME_TIMEOUT_MS,
  ENVIRONMENTAL_FAILURES,
  DEFAULT_MAX_WINDOW_NAME_CHARS,
  DEFAULT_MAX_SESSION_NAME_CHARS,
  buildAnchorBlock,
  resolveNamingAnchor,
  parseGeneratedNames,
  sanitizeWindowName,
  sanitizeSessionName,
  windowNameBudget,
  sessionNameBudget,
  generateNames,
  type GeneratedNames,
} from "../src/naming.js";

const { createModels, ModelsError } = vi.hoisted(() => ({
  createModels: vi.fn(),
  ModelsError: class extends Error {
    code = "auth";
    constructor(code = "auth", message = "auth failed") {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@earendil-works/pi-ai", () => ({ createModels, ModelsError }));

const EN = await import("../src/locales.js").then((m) => m.LOCALE_STRINGS.en);

function mkConfig(overrides: Partial<Config> = {}): Config {
  return {
    namingStyle: "natural",
    namingContextDepth: "recent-user-messages",
    namingModel: "",
    language: "en",
    windowNameMaxLength: undefined,
    sessionNameMaxLength: undefined,
    ...overrides,
  } as Config;
}

function mkContext(ctx: Partial<NamingContext> = {}): NamingContext {
  return {
    firstUserMessage: "Please fix the OAuth callback",
    recentUserMessages: [],
    ...ctx,
  };
}

function mkResponse(
  text: string,
  stopReason: AssistantMessage["stopReason"] = "stop",
): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    stopReason,
    timestamp: Date.now(),
  } as AssistantMessage;
}

function mkComplete(impl?: (text: string) => AssistantMessage) {
  const complete = vi.fn(async (model: unknown, ctx: unknown, options: unknown) => {
    const userText = (ctx as { messages: { content: { text: string }[] }[] }).messages[0].content[0]
      .text;
    return impl
      ? impl(userText)
      : mkResponse("WINDOW: OAuth refresh\nSESSION: Fix the OAuth callback retry");
  });
  return complete;
}

function mkCtx(
  overrides: Partial<ExtensionContext> = {},
  complete: ReturnType<typeof mkComplete> = mkComplete(),
): ExtensionContext {
  return {
    modelRegistry: { find: vi.fn(() => undefined), complete },
    model: { provider: "anthropic", id: "claude-test" },
    signal: undefined,
    ...overrides,
  } as unknown as ExtensionContext;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("constants", () => {
  it("exposes the documented values", () => {
    expect(RETRIES).toBe(3);
    expect(UI_RENAME_TIMEOUT_MS).toBe(10_000);
    expect([...ENVIRONMENTAL_FAILURES].sort()).toEqual([
      "missing_auth",
      "missing_model",
      "missing_prompt",
    ]);
  });
});

describe("buildAnchorBlock", () => {
  it("renders cwd and branch", () => {
    expect(buildAnchorBlock({ cwd: "pi-extensions", branch: "feat/oauth" })).toBe(
      "cwd: pi-extensions\ngit branch: feat/oauth\n",
    );
  });

  it("omits missing fields", () => {
    expect(buildAnchorBlock({ cwd: "pi-extensions" })).toBe("cwd: pi-extensions\n");
    expect(buildAnchorBlock({})).toBe("");
    expect(buildAnchorBlock(undefined)).toBe("");
  });
});

describe("resolveNamingAnchor", () => {
  it("captures cwd basename and the git branch", async () => {
    const exec = vi.fn(async () => ({
      stdout: "feat/oauth\n",
      stderr: "",
      code: 0,
      killed: false,
    }));
    expect(await resolveNamingAnchor(exec as any, "/home/user/projects/pi-extensions")).toEqual({
      cwd: "pi-extensions",
      branch: "feat/oauth",
    });
    expect(exec).toHaveBeenCalledWith("git", ["branch", "--show-current"], {
      cwd: "/home/user/projects/pi-extensions",
    });
  });

  it("drops the branch when not a git repo", async () => {
    const exec = vi.fn(async () => {
      throw new Error("not a repo");
    });
    expect(await resolveNamingAnchor(exec as any, "/tmp/x")).toEqual({ cwd: "x" });
  });
});

describe("parseGeneratedNames", () => {
  it("parses both labeled lines in either order", () => {
    expect(parseGeneratedNames("WINDOW: Fix auth\nSESSION: Fix the auth callback")).toEqual({
      window: "Fix auth",
      session: "Fix the auth callback",
    });
    expect(parseGeneratedNames("SESSION: Fix the auth callback\nWINDOW: Fix auth")).toEqual({
      window: "Fix auth",
      session: "Fix the auth callback",
    });
  });

  it("strips surrounding quotes and whitespace", () => {
    expect(parseGeneratedNames("WINDOW: \"Fix auth\"\nSESSION: 'Fix it'")).toEqual({
      window: "Fix auth",
      session: "Fix it",
    });
  });

  it("never misreads a label inside a value", () => {
    expect(parseGeneratedNames("WINDOW: session: is confusing\nSESSION: real session")).toEqual({
      window: "session: is confusing",
      session: "real session",
    });
  });

  it("returns undefined fields for missing labels", () => {
    expect(parseGeneratedNames("WINDOW: only window")).toEqual({
      window: "only window",
      session: undefined,
    });
    expect(parseGeneratedNames("")).toEqual({ window: undefined, session: undefined });
  });
});

describe("sessionNameBudget", () => {
  it("defaults to DEFAULT_MAX_SESSION_NAME_CHARS", () => {
    expect(sessionNameBudget(mkConfig())).toBe(DEFAULT_MAX_SESSION_NAME_CHARS);
  });

  it("a configured value overrides (tighten or relax)", () => {
    expect(sessionNameBudget(mkConfig({ sessionNameMaxLength: 42 }))).toBe(42);
    expect(sessionNameBudget(mkConfig({ sessionNameMaxLength: 300 }))).toBe(300);
  });
});

describe("windowNameBudget", () => {
  it("defaults to DEFAULT_MAX_WINDOW_NAME_CHARS", () => {
    expect(windowNameBudget(mkConfig())).toBe(DEFAULT_MAX_WINDOW_NAME_CHARS);
  });

  it("a configured value overrides (tighten or relax)", () => {
    expect(windowNameBudget(mkConfig({ windowNameMaxLength: 24 }))).toBe(24);
    expect(windowNameBudget(mkConfig({ windowNameMaxLength: 100 }))).toBe(100);
  });
});

describe("sanitizeWindowName", () => {
  it("natural: compacts to at most 4 whole words, undefined below the floor", () => {
    expect(sanitizeWindowName("natural", "Fix the OAuth callback", 40, "/p")).toBe(
      "Fix the OAuth callback",
    );
    expect(sanitizeWindowName("natural", "Fix the OAuth callback now please", 40, "/p")).toBe(
      "Fix the OAuth callback",
    );
    expect(sanitizeWindowName("natural", "Single", 40, "/p")).toBeUndefined();
  });

  it("slug: lowercases, hyphenates, truncates to 30", () => {
    expect(sanitizeWindowName("slug", "Fix OAuth issue", 30, "/p")).toBe("fix-oauth-issue");
    const long = sanitizeWindowName("slug", "word ".repeat(20), 30, "/p");
    expect(long!.length).toBeLessThanOrEqual(30);
  });

  it("topic-project: composes topic｜project within 24 chars", () => {
    expect(sanitizeWindowName("topic-project", "Fix auth", 24, "/p/pi-bakery")).toBe(
      "Fix auth｜pi-bakery",
    );
  });
});

describe("sanitizeSessionName", () => {
  it("slug: slugifies to at most 60 chars", () => {
    expect(sanitizeSessionName("slug", "Fix OAuth issue", 60)).toBe("fix-oauth-issue");
  });

  it("natural: returns a plain valid line", () => {
    expect(sanitizeSessionName("natural", "Correct the auth retry loop", 96)).toBe(
      "Correct the auth retry loop",
    );
  });

  it("natural: rejects bare ISO timestamps (temporary-title flow owns them)", () => {
    expect(sanitizeSessionName("natural", "2026-01-05T09:30:00.000Z", 96)).toBeUndefined();
  });

  it("topic-project: cleans to 96 chars", () => {
    expect(sanitizeSessionName("topic-project", "A descriptive session name", 96)).toBe(
      "A descriptive session name",
    );
  });
});

describe("generateNames", () => {
  it("returns missing_prompt without a seed", async () => {
    const result = await generateNames(
      mkCtx(),
      mkConfig(),
      mkContext({ firstUserMessage: "", recentUserMessages: [] }),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    expect(result).toEqual({ ok: false, reason: "missing_prompt" });
  });

  it("returns missing_model when no model resolves", async () => {
    const ctx = mkCtx({ model: undefined, modelRegistry: { find: vi.fn(() => undefined) } as any });
    const result = await generateNames(
      ctx,
      mkConfig({ namingModel: "anthropic/claude-test" }),
      mkContext(),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    expect(result).toEqual({ ok: false, reason: "missing_model" });
  });

  it("resolves the namingModel override via modelRegistry.find", async () => {
    const found = { provider: "openai", id: "gpt-test" };
    const complete = mkComplete();
    const ctx = mkCtx({ modelRegistry: { find: vi.fn(() => found), complete } as any });
    const result = await generateNames(
      ctx,
      mkConfig({ namingModel: "openai/gpt-test", namingStyle: "slug" }),
      mkContext(),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    expect(ctx.modelRegistry.find).toHaveBeenCalledWith("openai", "gpt-test");
    expect(result.ok).toBe(true);
  });

  it("returns ok with parsed names on a valid response", async () => {
    const result = await generateNames(
      mkCtx(),
      mkConfig({ namingStyle: "slug" }),
      mkContext(),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.names.windowName).toBe("oauth-refresh");
      expect(result.names.sessionName).toBe("fix-the-oauth-callback-retry");
    }
  });

  it("uses the locale system prompt and the naming context template", async () => {
    const complete = mkComplete();
    await generateNames(
      mkCtx({}, complete),
      mkConfig({ namingStyle: "slug" }),
      mkContext({ firstUserMessage: "Fix OAuth" }),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    const [model, callCtx, options] = complete.mock.calls[0];
    // The slug system prompt is filled with the effective budgets (defaults here)
    // and prefixed with the localized language directive.
    expect((callCtx as any).systemPrompt).toBe(
      `${EN.languageDirective.replaceAll("{language}", "en")}\n\n` +
        EN.slugSystemPrompt
          .replaceAll("{windowMaxChars}", "30")
          .replaceAll("{sessionMaxChars}", "200"),
    );
    const text = (callCtx as any).messages[0].content[0].text;
    expect(text).toContain("cwd: p");
    expect(text).toContain("First user message:\nFix OAuth");
    expect(text).toContain("Recent user messages:");
    expect(text).toContain(EN.responseFormat);
    expect((options as any).maxTokens).toBe(120);
    expect((options as any).cacheRetention).toBe("none");
    expect((options as any).timeoutMs).toBe(30_000);
  });

  it("prepends the dedup wrapper when existing titles exist", async () => {
    const complete = mkComplete();
    await generateNames(mkCtx({}, complete), mkConfig(), mkContext(), ["Old title"], "/p", {
      exec: vi.fn(),
    } as any);
    const text = (complete.mock.calls[0][1] as any).messages[0].content[0].text;
    expect(text).toContain(EN.dedupIntro);
    expect(text).toContain("- Old title");
  });

  it("retries invalid output up to RETRIES, then falls back to the last message", async () => {
    const complete = vi.fn(async () => mkResponse("WINDOW: Only one line"));
    const result = await generateNames(
      mkCtx({}, complete),
      mkConfig({ namingStyle: "slug" }),
      mkContext({ recentUserMessages: ["Fix the OAuth callback"] }),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    expect(complete).toHaveBeenCalledTimes(RETRIES);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.names.sessionName).toBe("fix-the-oauth-callback");
    }
  });

  it("falls back to the last message when stopReason is not stop", async () => {
    const complete = vi.fn(async () => mkResponse("", "length"));
    const result = await generateNames(
      mkCtx({}, complete),
      mkConfig({ namingStyle: "slug" }),
      mkContext({ recentUserMessages: ["Fix the auth retry loop now"] }),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.names.windowName).toBe("fix-the-auth-retry-loop-now");
    }
  });

  it("classifies ModelsError as missing_auth", async () => {
    const complete = vi.fn(async () => {
      throw new ModelsError("auth", "no api key");
    });
    const result = await generateNames(mkCtx({}, complete), mkConfig(), mkContext(), [], "/p", {
      exec: vi.fn(),
    } as any);
    expect(result).toEqual({ ok: false, reason: "missing_auth" });
  });

  it("classifies other errors as request_failed", async () => {
    const complete = vi.fn(async () => {
      throw new Error("network down");
    });
    const result = await generateNames(mkCtx({}, complete), mkConfig(), mkContext(), [], "/p", {
      exec: vi.fn(),
    } as any);
    expect(result).toEqual({ ok: false, reason: "request_failed" });
  });

  it("falls back to provider.stream + runtime auth when ModelRegistry.complete is missing", async () => {
    const resultMock = vi.fn(async () =>
      mkResponse("WINDOW: OAuth refresh\nSESSION: Fix the OAuth callback retry"),
    );
    const stream = vi.fn(() => ({ result: resultMock }));
    const ctx = mkCtx({
      modelRegistry: {
        find: vi.fn(() => undefined),
        getProvider: vi.fn(() => ({ stream })),
        getApiKeyAndHeaders: vi.fn(async () => ({
          ok: true,
          apiKey: "runtime-key",
          headers: { "X-Runtime": "v" },
        })),
      } as any,
    });
    const result = await generateNames(
      ctx,
      mkConfig({ namingStyle: "slug" }),
      mkContext(),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    expect(result.ok).toBe(true);
    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "anthropic" }),
      expect.objectContaining({ messages: expect.any(Array) }),
      expect.objectContaining({ apiKey: "runtime-key", headers: { "X-Runtime": "v" } }),
    );
    expect(resultMock).toHaveBeenCalledTimes(1);
  });

  it("missing_auth when runtime auth resolution fails in the fallback", async () => {
    const ctx = mkCtx({
      modelRegistry: {
        find: vi.fn(() => undefined),
        getProvider: vi.fn(() => ({ stream: vi.fn() })),
        getApiKeyAndHeaders: vi.fn(async () => ({ ok: false, error: "no key" })),
      } as any,
    });
    const result = await generateNames(ctx, mkConfig(), mkContext(), [], "/p", {
      exec: vi.fn(),
    } as any);
    expect(result).toEqual({ ok: false, reason: "missing_auth" });
  });

  it("missing_auth when the provider cannot be resolved in the fallback", async () => {
    const ctx = mkCtx({
      modelRegistry: { find: vi.fn(() => undefined), getProvider: vi.fn(() => undefined) } as any,
    });
    const result = await generateNames(ctx, mkConfig(), mkContext(), [], "/p", {
      exec: vi.fn(),
    } as any);
    expect(result).toEqual({ ok: false, reason: "missing_auth" });
  });

  it("returns invalid_output when the fallback produces nothing usable", async () => {
    const complete = vi.fn(async () => mkResponse("WINDOW: single\nSESSION: word"));
    const result = await generateNames(
      mkCtx({}, complete),
      mkConfig(),
      mkContext({ firstUserMessage: "one", recentUserMessages: [] }),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    expect(result).toEqual({ ok: false, reason: "invalid_output" });
  });

  it("passes the session abort signal and per-call timeout through", async () => {
    const signal = new AbortController().signal;
    const complete = mkComplete();
    await generateNames(
      mkCtx({ signal }, complete),
      mkConfig(),
      mkContext(),
      [],
      "/p",
      { exec: vi.fn() } as any,
      { timeoutMs: 5000 },
    );
    const options = complete.mock.calls[0][2] as any;
    expect(options.signal).toBe(signal);
    expect(options.timeoutMs).toBe(5000);
  });
});

describe("budget pass-through ({windowMaxChars}/{sessionMaxChars})", () => {
  it("fills the slug system prompt with the actual window/session budgets", async () => {
    const complete = mkComplete();
    await generateNames(
      mkCtx({}, complete),
      mkConfig({ namingStyle: "slug", windowNameMaxLength: 24, sessionNameMaxLength: 40 }),
      mkContext(),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    const systemPrompt = (complete.mock.calls[0][1] as any).systemPrompt;
    expect(systemPrompt).toContain("under 24 characters");
    expect(systemPrompt).toContain("under 40 characters");
    expect(systemPrompt).not.toContain("{windowMaxChars}");
    expect(systemPrompt).not.toContain("{sessionMaxChars}");
  });

  it("fills naturalRules with the actual budgets in the user prompt (natural style)", async () => {
    const complete = mkComplete();
    await generateNames(
      mkCtx({}, complete),
      mkConfig({ namingStyle: "natural", windowNameMaxLength: 20, sessionNameMaxLength: 80 }),
      mkContext(),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    const text = (complete.mock.calls[0][1] as any).messages[0].content[0].text;
    expect(text).toContain("up to 20 characters");
    expect(text).toContain("up to 80 characters");
    expect(text).not.toContain("{windowMaxChars}");
    expect(text).not.toContain("{sessionMaxChars}");
  });

  it("fills the topic-project system prompt and template with the session budget", async () => {
    const complete = mkComplete();
    await generateNames(
      mkCtx({}, complete),
      mkConfig({ namingStyle: "topic-project", sessionNameMaxLength: 96 }),
      mkContext(),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    const { systemPrompt, messages } = complete.mock.calls[0][1] as any;
    expect(systemPrompt).toContain("under 96 characters");
    const text = messages[0].content[0].text;
    expect(text).toContain("SESSION maximum characters: 96");
    expect(text).not.toContain("under 96");
  });

  it("includes the full conversation in the topic-project prompt at full-conversation depth", async () => {
    const complete = mkComplete();
    await generateNames(
      mkCtx({}, complete),
      mkConfig({ namingStyle: "topic-project" }),
      mkContext({
        firstUserMessage: "Fix auth",
        fullText: "User: Fix auth\nAssistant: investigating the retry loop",
      }),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    const text = (complete.mock.calls[0][1] as any).messages[0].content[0].text;
    expect(text).toContain("Conversation:");
    expect(text).toContain("User: Fix auth");
    expect(text).toContain("Assistant: investigating the retry loop");
  });

  it("omits the redundant first/recent blocks at full-conversation depth", async () => {
    const complete = mkComplete();
    await generateNames(
      mkCtx({}, complete),
      mkConfig({ namingStyle: "natural" }),
      mkContext({
        firstUserMessage: "Fix auth",
        recentUserMessages: ["bonus follow-up"],
        fullText: "User: Fix auth\nAssistant: ok",
      }),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    const text = (complete.mock.calls[0][1] as any).messages[0].content[0].text;
    expect(text).toContain("Conversation:");
    // the full transcript already carries the first/recent content — no duplication
    expect(text).not.toContain("Recent user messages:");
    expect(text).not.toContain("First user message:");
    expect(text).not.toContain("1. bonus follow-up");
  });
});

describe("language directive ({language} → natural/slug system prompt)", () => {
  it("injects the localized directive into the natural system prompt and user turn", async () => {
    const complete = mkComplete();
    await generateNames(
      mkCtx({}, complete),
      mkConfig({ namingStyle: "natural", language: "vi" }),
      mkContext(),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    const { systemPrompt, messages } = complete.mock.calls[0][1] as any;
    expect(systemPrompt).toContain("tiếng Việt (vi)");
    expect(systemPrompt).not.toContain("{language}");
    // also reinforced at the top of the user turn (weak models attend here)
    expect(messages[0].content[0].text.startsWith("Quan trọng: hãy tạo tên bằng tiếng Việt")).toBe(
      true,
    );
  });

  it("injects the localized directive into the slug system prompt", async () => {
    const complete = mkComplete();
    await generateNames(
      mkCtx({}, complete),
      mkConfig({ namingStyle: "slug", language: "de" }),
      mkContext(),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    const systemPrompt = (complete.mock.calls[0][1] as any).systemPrompt;
    expect(systemPrompt).toContain("Erstellen Sie die Namen auf Deutsch (de).");
  });

  it("does not double-inject for topic-project (template already carries Language:)", async () => {
    const complete = mkComplete();
    await generateNames(
      mkCtx({}, complete),
      mkConfig({ namingStyle: "topic-project", language: "vi" }),
      mkContext(),
      [],
      "/p",
      { exec: vi.fn() } as any,
    );
    const { systemPrompt, messages } = complete.mock.calls[0][1] as any;
    expect(systemPrompt).not.toContain("Tạo tên bằng tiếng Việt");
    expect(messages[0].content[0].text).toContain("Ngôn ngữ: vi");
  });
});
