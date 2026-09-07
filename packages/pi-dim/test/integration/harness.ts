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
import piDimFactory from "../../src/index.js";

/**
 * Adapted from packages/pi-auto-name/test/integration/harness.ts.
 * Stripped down for pi-dim: no config schema (pi-dim reads no config),
 * no multiplexer exec-guarding, no surface-env isolation. Still needs the
 * faux LLM core + in-memory model registry + nested pi-ai compat
 * registration to drive a real `session.prompt` through AgentSession.
 */

function createTempDir(): string {
  const d = join(tmpdir(), `pi-dim-int-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(d, { recursive: true });
  return d;
}

// --- model runtime helpers (copied from pi-auto-name's
// model-runtime-helpers.ts so this workspace stays self-contained) ---

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

function loadModelRuntime(): { ModelRuntime: { create: (opts: unknown) => Promise<unknown> } } {
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

/**
 * Load the `pi-ai/compat` api registry that `ModelRuntime` actually
 * dispatches through (its nested copy under pi-coding-agent).
 */
function loadRuntimeCompatRegistry(): NestedCompatRegistry {
  const compatPath = new URL(
    "../../../../node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/compat.js",
    import.meta.url,
  ).pathname;
  const runtimeRequire = createRequire(import.meta.url);
  return runtimeRequire(compatPath) as NestedCompatRegistry;
}

// --- harness ---

export interface WidgetCall {
  key: string;
  content: unknown;
}

export interface Harness {
  session: AgentSession;
  faux: ReturnType<typeof createFauxCore>;
  tempDir: string;
  theme: Theme;
  /** Every ctx.ui.setWidget call the extension made (key + factory/undefined). */
  widgetCalls: WidgetCall[];
  cleanup: () => void;
}

export interface HarnessOptions {
  /** Extension mode presented to bindExtensions. Defaults to "tui". */
  mode?: "tui" | "print";
  /** Real Theme instance used for ctx.ui.theme. Defaults to the built-in default theme. */
  theme?: Theme;
}

interface ThemeModule {
  getThemeByName: (name: string) => Theme | undefined;
  getDefaultTheme: () => string;
  setThemeInstance: (theme: Theme) => void;
}

/**
 * The package exports map hides the theme module, so reach it by absolute
 * file path (same trick as loadRuntimeCompatRegistry above).
 */
export function loadThemeModule(): ThemeModule {
  const themePath = new URL(
    "../../../../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js",
    import.meta.url,
  ).pathname;
  const runtimeRequire = createRequire(import.meta.url);
  return runtimeRequire(themePath) as ThemeModule;
}

/** GlobalThis key holding the real Theme instance (see theme-patch.ts). */
export const THEME_KEY = Symbol.for("@earendil-works/pi-coding-agent:theme");

function defaultTheme(): Theme {
  const mod = loadThemeModule();
  const theme = mod.getThemeByName(mod.getDefaultTheme());
  if (!theme) throw new Error("could not load the default built-in theme for tests");
  return theme;
}

export async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  const tempDir = createTempDir();
  const mode = options.mode ?? "tui";
  const theme = options.theme ?? defaultTheme();
  const widgetCalls: WidgetCall[] = [];

  const faux = createFauxCore({ provider: "faux", models: [{ id: "faux-1" }] });

  const apiSourceId = `pi-dim-int-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    models: (faux as unknown as { models: unknown[] }).models.map((mm: unknown) => mm) as any,
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
    extensionFactories: [piDimFactory as never],
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

  // Minimal uiContext: pi-dim only touches setWidget + (as fallback) theme.
  // resolveTheme() prefers the globalThis symbol, so tests that want the
  // global path use setThemeInstance(); otherwise the stub theme is used.
  const uiContext = {
    setWidget: (key: string, content: unknown) => {
      widgetCalls.push({ key, content });
    },
    get theme() {
      return theme;
    },
  };

  await session.bindExtensions({ mode, uiContext: uiContext as never });

  return {
    session,
    faux,
    tempDir,
    theme,
    widgetCalls,
    cleanup() {
      session.dispose();
      compatRegistry.unregisterApiProviders(apiSourceId);
      if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    },
  };
}
