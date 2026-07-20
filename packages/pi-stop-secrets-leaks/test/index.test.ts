import { describe, expect, it } from "vitest";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
import { createStopSecretsLeaks, type StopSecretsDeps } from "../src/index.js";
import type { BetterleaksFinding } from "../src/types.js";

// =====================================================================
// Local mock for ExtensionAPI.
// =====================================================================

interface MockPi {
  pi: ExtensionAPI;
  events: Map<string, Array<(e: unknown, ctx: unknown) => unknown>>;
  commands: Map<
    string,
    {
      description: string;
      handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
    }
  >;
  trigger: <R = unknown>(
    event: "session_start",
    e: unknown,
    ctx?: unknown,
  ) => Promise<R | undefined>;
  triggerToolResult: (e: ToolResultEvent, ctx?: unknown) => Promise<unknown>;
  triggerBeforeAgentStart: (
    e: BeforeAgentStartEvent,
    ctx?: unknown,
  ) => Promise<BeforeAgentStartEventResult | undefined>;
  triggerCmd: (name: string, args: string, ctx?: ExtensionCommandContext) => Promise<void>;
}

type AnyHandler = (e: unknown, ctx: unknown) => Promise<unknown>;

function createMockPi(): MockPi {
  const events = new Map<string, AnyHandler[]>();
  const commands = new Map<
    string,
    {
      description: string;
      handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
    }
  >();

  function getHandlers(event: string): AnyHandler[] {
    const list = events.get(event) ?? [];
    events.set(event, list);
    return list;
  }

  const pi = {
    on(event: string, handler: AnyHandler) {
      getHandlers(event).push(handler);
    },
    registerCommand(
      name: string,
      def: {
        description: string;
        handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
      },
    ) {
      commands.set(name, def);
    },
  } as unknown as ExtensionAPI;

  async function trigger<R = unknown>(
    event: string,
    e: unknown,
    ctx: unknown = mkContext(),
  ): Promise<R | undefined> {
    const handlers = getHandlers(event);
    let result: R | undefined | undefined;
    for (const h of handlers) {
      const r = await h(e, ctx);
      if (r !== undefined) result = r as R;
    }
    return result;
  }

  async function triggerCmd(
    name: string,
    args: string,
    ctx: ExtensionCommandContext = mkCommandCtx(),
  ) {
    const def = commands.get(name);
    if (!def) throw new Error(`No command: ${name}`);
    await def.handler(args, ctx);
  }

  function mkContext(): ExtensionContext {
    return {
      ui: mkUi(),
      mode: "print",
      hasUI: true,
      cwd: "/tmp/work",
      sessionManager: {} as ExtensionContext["sessionManager"],
      modelRegistry: {} as ExtensionContext["modelRegistry"],
      model: undefined,
      isIdle: () => true,
      isProjectTrusted: () => true,
      signal: undefined,
      abort: () => {},
      hasPendingMessages: () => false,
      shutdown: () => {},
      getContextUsage: () => undefined,
      compact: () => {},
      getSystemPrompt: () => "base-prompt",
    };
  }

  function mkCommandCtx(): ExtensionCommandContext {
    return {
      ...mkContext(),
      getSystemPromptOptions: () => ({ cwd: "/tmp/work" }),
      waitForIdle: async () => {},
      newSession: async () => ({ cancelled: false }),
      fork: async () => ({ cancelled: false }),
      navigateTree: async () => ({ cancelled: false }),
      switchSession: async () => ({ cancelled: false }),
      reload: async () => {},
    };
  }

  function mkUi(): ExtensionContext["ui"] {
    const notifications: Array<{ message: string; type: string }> = [];
    return {
      notify: (message: string, type: "info" | "warning" | "error" = "info") => {
        notifications.push({ message, type });
      },
      select: async () => undefined,
      confirm: async () => false,
      input: async () => undefined,
      setStatus: () => {},
      setWorkingMessage: () => {},
      setWorkingVisible: () => {},
      setWorkingIndicator: () => {},
      setHiddenThinkingLabel: () => {},
      setWidget: () => {},
      setFooter: () => {},
      setHeader: () => {},
      setTitle: () => {},
      custom: async () => undefined as never,
      pasteToEditor: () => {},
      setEditorText: () => {},
      getEditorText: () => "",
      editor: async () => undefined,
      addAutocompleteProvider: () => {},
      setEditorComponent: () => {},
      getEditorComponent: () => undefined,
      theme: {} as never,
      getAllThemes: () => [],
      getTheme: () => undefined,
      setTheme: () => ({ success: true }),
      getToolsExpanded: () => false,
      setToolsExpanded: () => {},
      onTerminalInput: () => () => {},
    } as unknown as ExtensionContext["ui"];
  }

  const mock: MockPi = {
    pi,
    events,
    commands,
    trigger: trigger,
    triggerToolResult: async (e: ToolResultEvent, ctx?: unknown) =>
      trigger<unknown>("tool_result", e, ctx),
    triggerBeforeAgentStart: async (e: BeforeAgentStartEvent, ctx?: unknown) =>
      trigger<BeforeAgentStartEventResult | undefined>("before_agent_start", e, ctx),
    triggerCmd,
  };
  return mock;
}

// =====================================================================
// Helpers for setting up dependency mocks.
// =====================================================================

const FIXTURE_KEY = "cccc1234abcdABCD5678efghEFGH";

function makeFinding(over: Partial<BetterleaksFinding>): BetterleaksFinding {
  return {
    source: "text",
    ruleID: "generic-api-key",
    description: "",
    file: "",
    entropy: 4.5,
    fingerprint: `fp-${Math.random().toString(36).slice(2)}`,
    startLine: 1,
    endLine: 1,
    startColumn: 1,
    endColumn: FIXTURE_KEY.length,
    ...over,
  };
}

function makeDeps(over: Partial<StopSecretsDeps> = {}): StopSecretsDeps {
  return {
    isBetterleaksAvailable: async () => true,
    scanFiles: async () => [],
    scanEnv: async () => [],
    scanText: async () => [],
    configureScanTimeout: (sec: number) => ({
      cliTimeoutSec: sec,
      subprocessTimeoutMs: (sec + 2) * 1000,
    }),
    ...over,
  };
}

function mkToolResult(over: Partial<ToolResultEvent>): ToolResultEvent {
  const textBlock: TextContent = {
    type: "text",
    text: "Some output line\nSecond line output",
  };
  return {
    type: "tool_result",
    toolCallId: "tc-1",
    toolName: "bash",
    input: { command: "echo hi" },
    content: [textBlock],
    isError: false,
    details: undefined,
    ...over,
  } as ToolResultEvent;
}

function mkImageBlock(): ImageContent {
  return {
    type: "image",
    data: "AAAA",
    mimeType: "image/png",
  } as unknown as ImageContent;
}

// =====================================================================
// Tests
// =====================================================================

describe("createStopSecretsLeaks — registration", () => {
  it("default export is a function", () => {
    // Just confirm default export exists & is callable.
    // We import the module side-effect-free via createStopSecretsLeaks.
    expect(typeof createStopSecretsLeaks).toBe("function");
  });

  it("registers session_start, before_agent_start, tool_result handlers", () => {
    const mock = createMockPi();
    createStopSecretsLeaks(makeDeps())(mock.pi);
    expect(mock.events.has("session_start")).toBe(true);
    expect(mock.events.has("before_agent_start")).toBe(true);
    expect(mock.events.has("tool_result")).toBe(true);
  });

  it("registers the four commands", () => {
    const mock = createMockPi();
    createStopSecretsLeaks(makeDeps())(mock.pi);
    expect(mock.commands.has("stop-secrets-leaks-status")).toBe(true);
    expect(mock.commands.has("stop-secrets-leaks-toggle")).toBe(true);
    expect(mock.commands.has("stop-secrets-leaks-rescan")).toBe(true);
    expect(mock.commands.has("stop-secrets-leaks-config")).toBe(true);
  });
});

describe("createStopSecretsLeaks — session_start", () => {
  it("calls scanFiles and scanEnv when betterleaks is available", async () => {
    let scanFilesCalls = 0;
    let scanEnvCalls = 0;
    const deps = makeDeps({
      scanFiles: async (_cwd: string) => {
        scanFilesCalls += 1;
        return [
          makeFinding({
            source: "file",
            file: "/tmp/work/.env",
            fingerprint: "fp1",
          }),
        ];
      },
      scanEnv: async () => {
        scanEnvCalls += 1;
        return [
          makeFinding({
            source: "env",
            fingerprint: "fp2",
            envName: "FOO_KEY",
          }),
        ];
      },
    });
    const mock = createMockPi();
    createStopSecretsLeaks(deps)(mock.pi);
    await mock.trigger("session_start", {
      type: "session_start",
      reason: "startup",
    });
    // fullScan is fire-and-forget; yield to let its microtasks drain
    await new Promise((r) => setTimeout(r, 0));
    expect(scanFilesCalls).toBe(1);
    expect(scanEnvCalls).toBe(1);
  });

  it("disables redaction when betterleaks is not available", async () => {
    const deps = makeDeps({
      isBetterleaksAvailable: async () => false,
    });
    const mock = createMockPi();
    createStopSecretsLeaks(deps)(mock.pi);
    await mock.trigger("session_start", {
      type: "session_start",
      reason: "startup",
    });
    // Let fire-and-forget fullScan drain
    await new Promise((r) => setTimeout(r, 0));
    // tool_result should now be a no-op even with secret-bearing text
    const e = mkToolResult({
      toolName: "bash",
      content: [{ type: "text", text: `OPENAI_KEY=${FIXTURE_KEY}` } as TextContent],
    });
    const result = await mock.triggerToolResult(e);
    expect(result).toBeUndefined();
  });

  it("disables redaction when scanFiles throws", async () => {
    const deps = makeDeps({
      isBetterleaksAvailable: async () => true,
      scanFiles: async () => {
        throw new Error("scan failed");
      },
    });
    const mock = createMockPi();
    createStopSecretsLeaks(deps)(mock.pi);
    await mock.trigger("session_start", {
      type: "session_start",
      reason: "startup",
    });
    // Let fire-and-forget fullScan drain
    await new Promise((r) => setTimeout(r, 0));

    // After the error, binaryOk should be false and enabled should be false
    const e = mkToolResult({
      toolName: "bash",
      content: [{ type: "text", text: `OPENAI_KEY=${FIXTURE_KEY}` } as TextContent],
    });
    const result = await mock.triggerToolResult(e);
    expect(result).toBeUndefined();
  });

  it("disables redaction when scanEnv throws", async () => {
    const deps = makeDeps({
      isBetterleaksAvailable: async () => true,
      scanEnv: async () => {
        throw new Error("env scan failed");
      },
    });
    const mock = createMockPi();
    createStopSecretsLeaks(deps)(mock.pi);
    await mock.trigger("session_start", {
      type: "session_start",
      reason: "startup",
    });
    // Let fire-and-forget fullScan drain
    await new Promise((r) => setTimeout(r, 0));

    const e = mkToolResult({
      toolName: "bash",
      content: [{ type: "text", text: `OPENAI_KEY=${FIXTURE_KEY}` } as TextContent],
    });
    const result = await mock.triggerToolResult(e);
    expect(result).toBeUndefined();
  });
});

describe("createStopSecretsLeaks — before_agent_start", () => {
  it("returns undefined when disabled (binary missing)", async () => {
    const deps = makeDeps({
      isBetterleaksAvailable: async () => false,
    });
    const mock = createMockPi();
    createStopSecretsLeaks(deps)(mock.pi);
    const result = await mock.triggerBeforeAgentStart({
      type: "before_agent_start",
      prompt: "hi",
      systemPrompt: "BASE",
      systemPromptOptions: { cwd: "/tmp/work" },
    });
    expect(result).toBeUndefined();
  });

  it("returns systemPrompt when registry has env findings", async () => {
    const deps = makeDeps({
      scanFiles: async () => [
        makeFinding({
          source: "file",
          file: "/tmp/work/.env",
          fingerprint: "f1",
        }),
      ],
      scanEnv: async () => [
        makeFinding({
          source: "env",
          fingerprint: "f2",
          envName: "OPENAI_TOKEN",
        }),
      ],
    });
    const mock = createMockPi();
    createStopSecretsLeaks(deps)(mock.pi);
    await mock.trigger("session_start", {
      type: "session_start",
      reason: "startup",
    });
    // Let fire-and-forget fullScan drain
    await new Promise((r) => setTimeout(r, 0));
    const result = await mock.triggerBeforeAgentStart({
      type: "before_agent_start",
      prompt: "hi",
      systemPrompt: "BASE",
      systemPromptOptions: { cwd: "/tmp/work" },
    });
    expect(result).toBeDefined();
    expect(result?.systemPrompt).toContain("BASE");
    expect(result?.systemPrompt).toContain("Secrets Redaction");
  });
});

describe("createStopSecretsLeaks — tool_result", () => {
  it("rewrites text content when scanText returns a finding", async () => {
    const before = `OPENAI_KEY=${FIXTURE_KEY}\n`;
    // Place finding at exact location of the fixture key.
    const startCol = before.indexOf(FIXTURE_KEY) + 1; // 1-indexed
    const endCol = startCol + FIXTURE_KEY.length - 1; // inclusive
    const deps = makeDeps({
      scanText: async (text: string) => {
        if (text.includes(FIXTURE_KEY)) {
          return [
            makeFinding({
              source: "text",
              startLine: 1,
              endLine: 1,
              startColumn: startCol,
              endColumn: endCol,
              fingerprint: "t-1",
            }),
          ];
        }
        return [];
      },
    });
    const mock = createMockPi();
    createStopSecretsLeaks(deps)(mock.pi);
    await mock.trigger("session_start", {
      type: "session_start",
      reason: "startup",
    });

    // Let fire-and-forget fullScan drain
    await new Promise((r) => setTimeout(r, 0));

    const event = mkToolResult({
      toolName: "bash",
      content: [{ type: "text", text: before } as TextContent],
    });
    const result = (await mock.triggerToolResult(event)) as { content: TextContent[] } | undefined;
    expect(result).toBeDefined();
    if (!result) throw new Error("expected result");
    const txt = result.content[0]?.text;
    expect(txt).toContain("OPENAI_KEY=«🔒");
    expect(txt).not.toContain(FIXTURE_KEY);
    expect(txt).toContain("«🔒...» = Redacted secret");
  });

  it("leaves image-only content unchanged", async () => {
    const deps = makeDeps({
      scanText: async () => [makeFinding({ fingerprint: "t-2" })],
    });
    const mock = createMockPi();
    createStopSecretsLeaks(deps)(mock.pi);
    await mock.trigger("session_start", {
      type: "session_start",
      reason: "startup",
    });

    // Let fire-and-forget fullScan drain
    await new Promise((r) => setTimeout(r, 0));

    const event = mkToolResult({
      toolName: "bash",
      content: [mkImageBlock()],
    });
    const result = await mock.triggerToolResult(event);
    expect(result).toBeUndefined();
  });

  it("does not rewrite tools that shouldRedactTool rejects", async () => {
    let scanTextCalls = 0;
    const deps = makeDeps({
      scanText: async () => {
        scanTextCalls += 1;
        return [makeFinding({ fingerprint: "t-3" })];
      },
    });
    const mock = createMockPi();
    createStopSecretsLeaks(deps)(mock.pi);
    await mock.trigger("session_start", {
      type: "session_start",
      reason: "startup",
    });

    // Let fire-and-forget fullScan drain
    await new Promise((r) => setTimeout(r, 0));

    const event = mkToolResult({
      toolName: "todo",
      content: [{ type: "text", text: "some output" } as TextContent],
    });
    const result = await mock.triggerToolResult(event);
    expect(result).toBeUndefined();
    expect(scanTextCalls).toBe(0);
  });

  it("invalidates the cache for write-like tools", async () => {
    let scanFilesCount = 0;
    const deps = makeDeps({
      scanFiles: async (_cwd: string, targets?: string[]) => {
        scanFilesCount += 1;
        if (targets?.length) {
          const targetPath = targets[0];
          if (targetPath) {
            return [
              makeFinding({
                source: "file",
                file: targetPath,
                fingerprint: "sf-1",
              }),
            ];
          }
        }
        return [
          makeFinding({
            source: "file",
            file: "/tmp/work/data.txt",
            fingerprint: "sf-2",
          }),
        ];
      },
    });
    const mock = createMockPi();
    createStopSecretsLeaks(deps)(mock.pi);
    await mock.trigger("session_start", {
      type: "session_start",
      reason: "startup",
    });

    // Let fire-and-forget fullScan drain
    await new Promise((r) => setTimeout(r, 0));

    // Write tool: invalidates /tmp/work/data.txt
    const write = mkToolResult({
      toolName: "write",
      input: { path: "data.txt" },
      content: [{ type: "text", text: "saved" } as TextContent],
    });
    await mock.triggerToolResult(write);

    // Read the same path → should re-scan (scanFiles count goes up)
    const before = scanFilesCount;
    const read = mkToolResult({
      toolName: "read",
      input: { path: "data.txt" },
      content: [{ type: "text", text: "file contents" } as TextContent],
    });
    await mock.triggerToolResult(read);
    expect(scanFilesCount).toBeGreaterThan(before);
  });
});

describe("createStopSecretsLeaks — toggle command", () => {
  it("disables redaction; tool_result becomes no-op", async () => {
    let scanTextCalls = 0;
    const deps = makeDeps({
      scanText: async () => {
        scanTextCalls += 1;
        return [makeFinding({ fingerprint: "t-on-1" })];
      },
    });
    const mock = createMockPi();
    createStopSecretsLeaks(deps)(mock.pi);
    await mock.trigger("session_start", {
      type: "session_start",
      reason: "startup",
    });

    // Let fire-and-forget fullScan drain
    await new Promise((r) => setTimeout(r, 0));

    // ON → tool_result rewrites
    const e1 = mkToolResult({
      toolName: "bash",
      content: [{ type: "text", text: `OPENAI_KEY=${FIXTURE_KEY}` } as TextContent],
    });
    const r1 = await mock.triggerToolResult(e1);
    expect(r1).toBeDefined();

    // Toggle OFF
    await mock.triggerCmd("stop-secrets-leaks-toggle", "");

    // OFF → tool_result is no-op
    const e2 = mkToolResult({
      toolName: "bash",
      content: [{ type: "text", text: `OPENAI_KEY=${FIXTURE_KEY}` } as TextContent],
    });
    const callsBefore = scanTextCalls;
    const r2 = await mock.triggerToolResult(e2);
    expect(r2).toBeUndefined();
    expect(scanTextCalls).toBe(callsBefore);

    // Toggle ON again
    await mock.triggerCmd("stop-secrets-leaks-toggle", "");
    const e3 = mkToolResult({
      toolName: "bash",
      content: [{ type: "text", text: `OPENAI_KEY=${FIXTURE_KEY}` } as TextContent],
    });
    const r3 = await mock.triggerToolResult(e3);
    expect(r3).toBeDefined();
  });
});

describe("createStopSecretsLeaks — invariant: never store secret values", () => {
  it("scanText finding returned to consumers does not leak the secret value", async () => {
    const deps = makeDeps({
      scanText: async () => [
        // Cover only the fixture key, not the prefix
        makeFinding({
          fingerprint: "t-no-leak",
          startColumn: 12, // after "OPENAI_KEY="
          endColumn: 12 + FIXTURE_KEY.length - 1,
        }),
      ],
    });
    const mock = createMockPi();
    createStopSecretsLeaks(deps)(mock.pi);
    await mock.trigger("session_start", {
      type: "session_start",
      reason: "startup",
    });

    // Let fire-and-forget fullScan drain
    await new Promise((r) => setTimeout(r, 0));

    const event = mkToolResult({
      toolName: "bash",
      content: [{ type: "text", text: `OPENAI_KEY=${FIXTURE_KEY}` } as TextContent],
    });
    const result = (await mock.triggerToolResult(event)) as { content: TextContent[] } | undefined;
    expect(result).toBeDefined();
    if (!result) throw new Error("expected result");
    const txt = result.content[0]?.text;
    expect(txt).not.toContain(FIXTURE_KEY);
    expect(txt).toContain("OPENAI_KEY=");
    expect(txt).toContain("= Redacted secret");
  });
});
