import type { CredentialStore } from "@earendil-works/pi-ai";
import { ModelRegistry } from "@earendil-works/pi-coding-agent";
import { createRequire } from "node:module";

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
  const require = createRequire(import.meta.url);
  const pkgJson = new URL(
    "../../../../node_modules/@earendil-works/pi-coding-agent/package.json",
    import.meta.url,
  );
  const abs = new URL(
    "../../../../node_modules/@earendil-works/pi-coding-agent/dist/core/model-runtime.js",
    import.meta.url,
  ).pathname;
  void pkgJson;
  const mod = require(abs) as {
    ModelRuntime: { create: (opts: unknown) => Promise<unknown> };
  };
  return mod;
}

const runtimes = new WeakMap<ModelRegistry, unknown>();

function wrap(runtime: unknown): ModelRegistry {
  const registry = new ModelRegistry(runtime as never);
  runtimes.set(registry, runtime);
  return registry;
}

export async function createModelRegistry(
  credentials: CredentialStore,
  modelsPath?: string,
): Promise<ModelRegistry> {
  const { ModelRuntime } = loadModelRuntime();
  return wrap(
    await ModelRuntime.create({
      credentials,
      modelsPath,
      modelsStore: new InMemoryCodingAgentModelsStore() as never,
      allowModelNetwork: false,
    }),
  );
}

export async function createInMemoryModelRegistry(
  credentials: CredentialStore,
): Promise<ModelRegistry> {
  const { ModelRuntime } = loadModelRuntime();
  return wrap(
    await ModelRuntime.create({ credentials, modelsPath: null, allowModelNetwork: false }),
  );
}

export function getModelRuntime(modelRegistry: ModelRegistry): unknown {
  const runtime = runtimes.get(modelRegistry);
  if (!runtime) throw new Error("ModelRegistry was not created by the test helper");
  return runtime;
}
