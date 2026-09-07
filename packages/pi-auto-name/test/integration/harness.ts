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

export interface ExecCall {
  command: string;
  args: string[];
}

/**
 * Multiplexer env vars that route surface renames at the real session.
 * src/surfaces.ts reads these live from process.env on every call and falls
 * back to `herdr pane current` when HERDR_PANE_ID is missing — so a harness
 * that inherits the developer's shell env renames the developer's real
 * herdr tab/pane when `npm run test` runs inside a multiplexer. Cleared for
 * the lifetime of any live harness (refcounted: tests may hold several).
 */
const SURFACE_ENV_VARS = [
  "HERDR_ENV",
  "HERDR_PANE_ID",
  "HERDR_TAB_ID",
  "TMUX",
  "TMUX_PANE",
  "ZELLIJ",
  "ZELLIJ_PANE_ID",
] as const;

let surfaceEnvDepth = 0;
let savedSurfaceEnv: Record<string, string | undefined> | undefined;

function clearSurfaceEnv(): void {
  if (surfaceEnvDepth === 0) {
    savedSurfaceEnv = {};
    for (const key of SURFACE_ENV_VARS) {
      savedSurfaceEnv[key] = process.env[key];
      delete process.env[key];
    }
  }
  surfaceEnvDepth += 1;
}

function restoreSurfaceEnv(): void {
  surfaceEnvDepth -= 1;
  if (surfaceEnvDepth === 0 && savedSurfaceEnv) {
    for (const key of SURFACE_ENV_VARS) {
      const value = savedSurfaceEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    savedSurfaceEnv = undefined;
  }
}

/** Multiplexer binaries the extension shells out to via pi.exec. */
function isMultiplexerCommand(command: string): boolean {
  return command === "herdr" || command === "tmux" || command === "zellij";
}

/**
 * Test default: external surfaces stay off. The in-memory session rename
 * (renamePiSession) is hermetic and stays on so naming assertions keep
 * working; herdr/tmux/zellij renames spawn real processes and must be
 * opt-in per test via `config.surfaces` (partial overrides still win).
 */
const TEST_SURFACE_DEFAULTS = {
  renameHerdrPane: false,
  renameHerdrTab: false,
  renameTmuxWindow: false,
  renameZellijPane: false,
  renameZellijTab: false,
};

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
  /** Multiplexer spawns the extension attempted (herdr/tmux/zellij only). */
  execCalls: ExecCall[];
  cleanup: () => void;
  writeConfig: (patch: Record<string, unknown>) => void;
  /** Re-register the faux api streams (session.reload() wipes the registry). */
  reregisterFauxApi: () => void;
}

export interface HarnessOptions {
  config?: Record<string, unknown>;
  withAuth?: boolean;
  /** Bind a stub UI context so ctx.hasUI is true (deferred rename paths). */
  ui?: boolean;
  /** Bind an error listener so session.reload() emits session_start. */
  reloadable?: boolean;
}

export async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  // Never let surface renames escape to the developer's real multiplexer
  // session (see SURFACE_ENV_VARS). Restored in cleanup().
  clearSurfaceEnv();
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
  function registerFauxApi(): void {
    compatRegistry.registerApiProvider(
      {
        api: (faux as unknown as { api: string }).api,
        stream: (faux as unknown as { stream: unknown }).stream,
        streamSimple: (faux as unknown as { streamSimple: unknown }).streamSimple,
      },
      apiSourceId,
    );
  }
  registerFauxApi();

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
  // External multiplexer surfaces default off in tests (TEST_SURFACE_DEFAULTS);
  // the caller's `config.surfaces` partial still wins per field.
  {
    const piDir = join(tempDir, ".pi");
    mkdirSync(piDir, { recursive: true });
    const fullDefaults = validateConfig(ConfigSchema, {}) as unknown as Record<string, unknown>;
    writeFileSync(
      join(piDir, "pi-auto-name.json"),
      JSON.stringify(
        deepMerge(
          deepMerge(fullDefaults, { surfaces: TEST_SURFACE_DEFAULTS }),
          options.config ?? {},
        ),
      ),
    );
  }

  // Block multiplexer spawns at the extension boundary: the extension under
  // test receives a pi object whose exec records herdr/tmux/zellij calls and
  // throws (every surfaces.ts call site treats failure as skip-and-debug-log,
  // so naming still lands). All other commands (notably `git` for the naming
  // anchor) delegate to the real exec. Prototype delegation keeps every other
  // ExtensionAPI member (including getters) intact.
  const execCalls: ExecCall[] = [];
  const guardedFactory = ((pi: Record<string, unknown>) => {
    const realExec = pi["exec"] as (
      command: string,
      args: string[],
      options?: unknown,
    ) => Promise<unknown>;
    const exec = async (command: string, args: string[], options?: unknown): Promise<unknown> => {
      if (isMultiplexerCommand(command)) {
        execCalls.push({ command, args });
        throw new Error(`blocked in tests: ${command} ${args.join(" ")}`);
      }
      return realExec(command, args, options);
    };
    return (piAutoNameFactory as (pi: unknown) => unknown)(
      Object.create(pi, { exec: { value: exec } }),
    );
  }) as never;

  const resourceLoader = new DefaultResourceLoader({
    cwd: tempDir,
    agentDir: tempDir,
    settingsManager,
    extensionFactories: [guardedFactory],
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

  await session.bindExtensions({
    ...(options.ui ? { uiContext: {} as never } : {}),
    ...(options.reloadable ? { onError: () => {} } : {}),
  });

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
    execCalls,
    cleanup() {
      session.dispose();
      compatRegistry.unregisterApiProviders(apiSourceId);
      restoreSurfaceEnv();
      if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    },
    writeConfig,
    reregisterFauxApi: registerFauxApi,
  };
}
