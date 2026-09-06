import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "@earendil-works/pi-agent-core";
import { createFauxCore } from "@earendil-works/pi-ai";
import { InMemoryCredentialStore } from "@earendil-works/pi-ai";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  SessionManager,
  SettingsManager,
  convertToLlm,
  AgentSession,
  DefaultResourceLoader,
} from "@earendil-works/pi-coding-agent";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { createInMemoryModelRegistry, getModelRuntime } from "./model-runtime-helpers.js";
import piAutoNameFactory from "../../src/index.js";

function createTempDir(): string {
  const d = join(tmpdir(), `pi-auto-name-int-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(d, { recursive: true });
  return d;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep merge; `over` wins per field. Arrays and scalars are replaced, not merged. */
function deepMerge(
  base: Record<string, unknown>,
  over: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key] as Record<string, unknown>, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

interface NestedCompatRegistry {
  registerApiProvider: (provider: unknown, sourceId?: string) => void;
  unregisterApiProviders: (sourceId: string) => void;
}

/**
 * Load the `pi-ai/compat` api registry that `ModelRuntime` actually
 * dispatches through. The runtime resolves `@earendil-works/pi-ai` to its
 * nested copy under pi-coding-agent, so registering in the top-level copy
 * is invisible to it ("No API provider registered"). Reach the nested copy
 * by absolute file path (subpath resolution through its exports map fails
 * on this toolchain), mirroring model-runtime-helpers.
 */
function loadRuntimeCompatRegistry(): NestedCompatRegistry {
  const compatPath = fileURLToPath(
    new URL(
      "../../../../node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/compat.js",
      import.meta.url,
    ),
  );
  const runtimeRequire = createRequire(import.meta.url);
  return runtimeRequire(compatPath) as NestedCompatRegistry;
}

export interface Harness {
  session: AgentSession;
  sessionManager: SessionManager;
  settingsManager: SettingsManager;
  faux: ReturnType<typeof createFauxCore>;
  namingFaux: ReturnType<typeof createFauxCore>;
  events: AgentSessionEvent[];
  eventsOfType<T extends AgentSessionEvent["type"]>(
    type: T,
  ): Extract<AgentSessionEvent, { type: T }>[];
  tempDir: string;
  cleanup: () => void;
  writeConfig: (patch: Record<string, unknown>) => void;
}

export interface HarnessOptions {
  config?: Record<string, unknown>;
  withAuth?: boolean;
}

export async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  const tempDir = createTempDir();

  // Hermetic user-global config: loadConfig merges ~/.config UNDER the
  // project file, so keys the test does not set (notably the no-default
  // optionals window/sessionNameMaxLength) would leak in from a real
  // user-global file and change behavior (e.g. flipping isExplicit).
  // Point XDG at an empty per-harness dir BEFORE src/config.ts first loads
  // (it caches the resolved user path at module top level, and it loads
  // lazily — hence the dynamic import below).
  const xdgDir = join(tempDir, "xdg-config");
  mkdirSync(xdgDir, { recursive: true });
  process.env.XDG_CONFIG_HOME = xdgDir;
  const { ConfigSchema, validateConfig } = await import("../../src/config.js");

  const faux = createFauxCore({ provider: "faux", models: [{ id: "faux-1" }] });
  const withAuth = options.withAuth ?? true;

  // The main agent turn consumes faux responses through `streamFn` directly,
  // but the extension's naming call goes through `ModelRuntime.complete`,
  // which dispatches on `model.api`. Register this core's api streams in the
  // runtime's own pi-ai copy so it resolves them instead of erroring with
  // "No API provider registered". Scoped per harness; released in cleanup().
  const apiSourceId = `pi-auto-name-int-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  if (withAuth) {
    await (
      credentials as unknown as {
        modify: (p: string, fn: (c: unknown) => Promise<unknown>) => Promise<void>;
      }
    ).modify(fauxProviderId, async () => ({ type: "api_key", key: "faux-key" }));
  }

  const modelRegistry = await createInMemoryModelRegistry(credentials as never);
  if (withAuth) {
    modelRegistry.registerProvider(fauxProviderId, {
      baseUrl: (fauxModel as unknown as { baseUrl: string }).baseUrl,
      apiKey: "faux-key",
      api: (faux as unknown as { api: string }).api,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      models: (faux as unknown as { models: unknown[] }).models.map((mm: unknown) => mm) as any,
    });
  }
  const namingFaux = faux;

  const sessionManager = SessionManager.inMemory(tempDir);
  const settingsManager = SettingsManager.inMemory();
  const extensionRunnerRef: { current?: unknown } = {};

  const agent = new Agent({
    getApiKey: () => (withAuth ? "faux-key" : undefined),
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

  // Always write a complete project config (schema defaults under the test's
  // overrides) so a user-global ~/.config file can never leak keys the test
  // did not set (namingModel, reRenameEveryNTurns, ...) into the run.
  {
    const piDir = join(tempDir, ".pi");
    mkdirSync(piDir, { recursive: true });
    const fullDefaults = validateConfig(ConfigSchema, {}) as unknown as Record<string, unknown>;
    writeFileSync(
      join(piDir, "pi-auto-name.json"),
      JSON.stringify(deepMerge(fullDefaults, options.config ?? {})),
    );
  }

  const resourceLoader = new DefaultResourceLoader({
    cwd: tempDir,
    agentDir: tempDir,
    settingsManager,
    extensionFactories: [piAutoNameFactory as never],
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

  const events: AgentSessionEvent[] = [];
  session.subscribe((event: AgentSessionEvent) => {
    events.push(event);
  });

  await session.bindExtensions({});

  function writeConfig(patch: Record<string, unknown>) {
    const piDir = join(tempDir, ".pi");
    mkdirSync(piDir, { recursive: true });
    writeFileSync(join(piDir, "pi-auto-name.json"), JSON.stringify(patch));
  }

  return {
    session,
    sessionManager,
    settingsManager,
    faux,
    namingFaux,
    events,
    eventsOfType<T extends AgentSessionEvent["type"]>(type: T) {
      return events.filter((e): e is Extract<AgentSessionEvent, { type: T }> => e.type === type);
    },
    tempDir,
    cleanup() {
      session.dispose();
      compatRegistry.unregisterApiProviders(apiSourceId);
      if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    },
    writeConfig,
  };
}
