import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { Agent } from "@earendil-works/pi-agent-core";
import { createFauxCore, InMemoryCredentialStore } from "@earendil-works/pi-ai";
import {
  AgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  convertToLlm,
} from "@earendil-works/pi-coding-agent";
import type { CredentialStore } from "@earendil-works/pi-ai";
import type { Theme } from "@earendil-works/pi-coding-agent";
import socratesFactory from "../../src/index.js";

function createTempDir(): string {
  const d = join(tmpdir(), `pi-socrates-int-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(d, { recursive: true });
  return d;
}

class InMemoryCodingAgentModelsStore {
  entries = new Map<string, unknown>();
  async read(providerId: string, options?: { signal?: AbortSignal }) {
    options?.signal?.throwIfAborted();
    const entry = this.entries.get(providerId);
    return entry ? structuredClone(entry) : undefined;
  }
  async write(providerId: string, entry: unknown, options?: { signal?: AbortSignal }) {
    options?.signal?.throwIfAborted();
    this.entries.set(providerId, structuredClone(entry));
  }
  async delete(providerId: string, options?: { signal?: AbortSignal }) {
    options?.signal?.throwIfAborted();
    this.entries.delete(providerId);
  }
}

function loadModelRuntime(): {
  ModelRuntime: { create: (opts: unknown) => Promise<unknown> };
} {
  const runtimeRequire = createRequire(import.meta.url);
  const abs = new URL(
    "../../../../node_modules/@earendil-works/pi-coding-agent/dist/core/model-runtime.js",
    import.meta.url,
  ).pathname;
  return runtimeRequire(abs) as {
    ModelRuntime: { create: (opts: unknown) => Promise<unknown> };
  };
}

const runtimes = new WeakMap<ModelRegistry, unknown>();

async function createInMemoryModelRegistry(credentials: CredentialStore): Promise<ModelRegistry> {
  const { ModelRuntime } = loadModelRuntime();
  const runtime = await ModelRuntime.create({
    credentials,
    modelsPath: null,
    modelsStore: new InMemoryCodingAgentModelsStore() as never,
    allowModelNetwork: false,
  });
  const registry = new ModelRegistry(runtime as never);
  runtimes.set(registry, runtime);
  return registry;
}

function getModelRuntime(modelRegistry: ModelRegistry): unknown {
  const runtime = runtimes.get(modelRegistry);
  if (!runtime) throw new Error("ModelRegistry was not created by the test helper");
  return runtime;
}

interface NestedCompatRegistry {
  registerApiProvider: (provider: unknown, sourceId?: string) => void;
  unregisterApiProviders: (sourceId: string) => void;
}

function loadRuntimeCompatRegistry(): NestedCompatRegistry {
  const runtimeRequire = createRequire(import.meta.url);
  return runtimeRequire(runtimeCompatPath()) as NestedCompatRegistry;
}

/**
 * Path to the `pi-ai/compat` module `ModelRuntime` dispatches through. A
 * hardcoded nested path is required while npm nests pi-ai under
 * pi-coding-agent (the host resolves that copy), and breaks once npm instead
 * dedupes pi-ai to the top level, so take whichever copy exists.
 */
function runtimeCompatPath(): string {
  const candidates = [
    "../../../../node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/compat.js",
    "../../../../node_modules/@earendil-works/pi-ai/dist/compat.js",
  ].map((relative) => new URL(relative, import.meta.url).pathname);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("could not locate pi-ai/compat under node_modules");
  return found;
}

interface ThemeModule {
  getThemeByName: (name: string) => Theme | undefined;
}

export function loadThemeModule(): ThemeModule {
  const themePath = new URL(
    "../../../../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js",
    import.meta.url,
  ).pathname;
  const runtimeRequire = createRequire(import.meta.url);
  return runtimeRequire(themePath) as ThemeModule;
}

/** pi 0.99.1 removed `getDefaultTheme()`. Both built-in themes ship with the CLI
 * in every supported version, so name one explicitly: deriving it from the
 * terminal background (what `getDefaultTheme()` did) made this fixture
 * environment-dependent. */
export function loadBuiltInTheme(): Theme {
  const theme = loadThemeModule().getThemeByName("dark");
  if (!theme) throw new Error("could not load the built-in dark theme for tests");
  return theme;
}

export interface Harness {
  session: AgentSession;
  faux: ReturnType<typeof createFauxCore>;
  tempDir: string;
  theme: Theme;
  customCallCount: () => number;
  cleanup: () => void;
}

export interface HarnessOptions {
  mode?: "tui" | "print";
  theme?: Theme;
  keystrokeScripts?: string[][];
}

export async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  const tempDir = createTempDir();
  const mode = options.mode ?? "tui";
  const theme = options.theme ?? loadBuiltInTheme();
  let customCalls = 0;
  const keystrokeScripts = options.keystrokeScripts ?? [];
  let customIndex = 0;

  const faux = createFauxCore({ provider: "faux", models: [{ id: "faux-1" }] });

  const apiSourceId = `pi-socrates-int-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const compatRegistry = loadRuntimeCompatRegistry();
  compatRegistry.registerApiProvider(
    {
      api: (faux as unknown as { api: string }).api,
      stream: (faux as unknown as { stream: unknown }).stream,
      streamSimple: (faux as unknown as { streamSimple: unknown }).streamSimple,
    },
    apiSourceId,
  );

  const credentials = new InMemoryCredentialStore();
  const fauxModel = faux.getModel();
  const fauxProviderId = (fauxModel as unknown as { provider: string }).provider;
  await (
    credentials as unknown as {
      modify: (p: string, fn: (c: unknown) => Promise<unknown>) => Promise<void>;
    }
  ).modify(fauxProviderId, async () => ({ type: "api_key", key: "faux-key" }));

  const modelRegistry = await createInMemoryModelRegistry(credentials as never);
  modelRegistry.registerProvider(fauxProviderId, {
    baseUrl: (fauxModel as unknown as { baseUrl: string }).baseUrl,
    apiKey: "faux-key",
    api: (faux as unknown as { api: string }).api,
    models: (faux as unknown as { models: unknown[] }).models.map((mm: unknown) => mm) as never,
  });

  const sessionManager = SessionManager.inMemory(tempDir);
  const settingsManager = SettingsManager.inMemory();
  const extensionRunnerRef: { current?: unknown } = {};

  const agent = new Agent({
    getApiKey: () => "faux-key",
    streamFn: (faux as unknown as { streamSimple: unknown }).streamSimple as never,
    initialState: {
      model: fauxModel as never,
      systemPrompt: "You are a test assistant.",
      tools: [],
    },
    convertToLlm: convertToLlm as never,
    onPayload: async (payload: unknown) => {
      const runner = extensionRunnerRef.current as
        | {
            hasHandlers: (t: string) => boolean;
            emitBeforeProviderRequest: (p: unknown) => Promise<unknown>;
          }
        | undefined;
      if (!runner?.hasHandlers("before_provider_request")) return payload as never;
      return runner.emitBeforeProviderRequest(payload as never) as never;
    },
    onResponse: async (response: { status: number; headers: Record<string, string> }) => {
      const runner = extensionRunnerRef.current as
        | { hasHandlers: (t: string) => boolean; emit: (e: unknown) => Promise<void> }
        | undefined;
      if (!runner?.hasHandlers("after_provider_response")) return;
      await runner.emit({
        type: "after_provider_response",
        status: response.status,
        headers: response.headers,
      } as never);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformContext: async (messages: any, _signal?: AbortSignal) => {
      const runner = extensionRunnerRef.current as
        | { emitContext: (m: never, s?: AbortSignal) => Promise<never> }
        | undefined;
      if (!runner) return messages as never;
      return runner.emitContext(messages as never, _signal) as never;
    },
  });

  const resourceLoader = new DefaultResourceLoader({
    cwd: tempDir,
    agentDir: tempDir,
    settingsManager,
    extensionFactories: [socratesFactory as never],
  });
  await resourceLoader.reload();

  const session = new AgentSession({
    agent: agent as never,
    sessionManager,
    settingsManager: settingsManager as never,
    cwd: tempDir,
    modelRuntime: getModelRuntime(modelRegistry) as never,
    resourceLoader,
    extensionRunnerRef,
  } as never);

  const fakeTui = {
    requestRender: () => {},
  };

  type CustomComponent = {
    render: (width: number) => string[];
    invalidate: () => void;
    handleInput: (data: string) => void;
  };

  const uiContext = {
    custom: async <T>(
      factory: (
        tui: unknown,
        theme: unknown,
        keybindings: unknown,
        done: (result: T) => void,
      ) => CustomComponent | Promise<CustomComponent>,
    ): Promise<T> => {
      customCalls += 1;
      let result: T | undefined;
      let settled = false;
      const component = await factory(fakeTui, theme, {}, (v: T) => {
        result = v;
        settled = true;
      });
      const script = keystrokeScripts[customIndex] ?? [];
      customIndex += 1;
      for (const key of script) {
        component.handleInput(key);
        if (settled) break;
      }
      if (!settled) throw new Error("custom() factory never called done()");
      return result as T;
    },
    get theme() {
      return theme;
    },
  };

  await session.bindExtensions(
    options.mode === "print" ? { mode } : { mode, uiContext: uiContext as never },
  );

  return {
    session,
    faux,
    tempDir,
    theme,
    customCallCount: () => customCalls,
    cleanup() {
      session.dispose();
      compatRegistry.unregisterApiProviders(apiSourceId);
      if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    },
  };
}
