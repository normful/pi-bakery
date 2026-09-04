// config.ts — schema, defaults, load/merge.
import { join } from "node:path";
import { Type, type Static, type TObject } from "typebox";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import {
  configPath,
  loadJsonConfig,
  validateConfig as rpivValidateConfig,
} from "@juicesharp/rpiv-config";
import { debug } from "./debug.js";

export const ConfigSchema = Type.Object({
  enabled: Type.Boolean({ default: true }),
  surfaces: Type.Object({
    renamePiSession: Type.Boolean({ default: true }),
    renameHerdrPane: Type.Boolean({ default: true }),
    renameHerdrTab: Type.Boolean({ default: true }),
    renameTmuxWindow: Type.Boolean({ default: true }),
    renameZellijPane: Type.Boolean({ default: true }),
    renameZellijTab: Type.Boolean({ default: true }),
  }),
  initialRenameTrigger: Type.Union(
    [Type.Literal("first-input"), Type.Literal("first-agent-settled")],
    {
      default: "first-input",
    },
  ),
  reRenameEveryNTurns: Type.Integer({ minimum: 0, default: 0 }),
  replaceExistingName: Type.Union([Type.Literal("always"), Type.Literal("never")], {
    default: "always",
  }),
  respectExternalRenames: Type.Boolean({ default: true }),
  namingStyle: Type.Union(
    [Type.Literal("natural"), Type.Literal("slug"), Type.Literal("topic-project")],
    { default: "natural" },
  ),
  namingContextDepth: Type.Union(
    [
      Type.Literal("first-user-message"),
      Type.Literal("recent-user-messages"),
      Type.Literal("full-conversation"),
    ],
    { default: "recent-user-messages" },
  ),
  skipSessionNameDedup: Type.Boolean({ default: false }),
  namingModel: Type.String({ default: "" }),
  // BCP-47 language tag only ("en", "zh-CN", "pt-BR")
  language: Type.String({ default: "en" }),
  // Per-name limits, override semantics: when set, windowNameMaxLength applies
  // to every window surface (herdr pane/tab, tmux window, zellij pane/tab) and
  // sessionNameMaxLength to the Pi session name and session list. Each replaces
  // a single fixed default (DEFAULT_MAX_WINDOW_NAME_CHARS / DEFAULT_MAX_SESSION_NAME_CHARS
  // in naming.ts) — tightening OR relaxing it, identically for every style.
  // These are the only two length knobs.
  windowNameMaxLength: Type.Optional(Type.Integer({ minimum: 1 })),
  sessionNameMaxLength: Type.Optional(Type.Integer({ minimum: 1 })),
});

export type Config = Static<typeof ConfigSchema>;

/**
 * rpiv-config's `validateConfig` (verbatim behavior: non-object guard,
 * Value.Clean strips unknown keys, Value.Create applies defaults, defaults
 * merged under the cleaned value). The cast papers over an upstream generic
 * bug: typebox 1.x's bare `TObject` defaults `required` to `[string]`, so
 * rpiv-config's `T extends TObject` constraint rejects any object schema with
 * more than one required key. Runtime behavior is unchanged.
 */
export function validateConfig<T extends TObject>(schema: T, value: unknown): Static<T> {
  return rpivValidateConfig(schema as TObject, value) as Static<T>;
}

const LEGACY_USER_CONFIG_PATH = configPath("pi-auto-name");

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

/**
 * Load: legacy user base ← Pi user config ← project override (per-field, right wins).
 * Configuration comes only from the three JSON files read via rpiv-config;
 * there are no env-var overrides.
 */
export function loadConfig(cwd: string): Config {
  const legacyUserPath = LEGACY_USER_CONFIG_PATH;
  const userPath = join(getAgentDir(), "pi-auto-name.json");
  const projectPath = join(cwd, CONFIG_DIR_NAME, "pi-auto-name.json");
  const legacyUser = loadJsonConfig<Record<string, unknown>>(legacyUserPath);
  const user = loadJsonConfig<Record<string, unknown>>(userPath);
  const project = loadJsonConfig<Record<string, unknown>>(projectPath);
  const merged = deepMerge(deepMerge(legacyUser, user), project);
  const validated = validateConfig(ConfigSchema, merged);
  // rpiv-config's merge is shallow (`{...defaults, ...cleaned}`) and TypeBox
  // Value.Create honors an object's own default over nested property defaults.
  // Deep-merge the full schema defaults so a partial `surfaces`
  // override keeps every untouched field (spec §3.2 intent).
  const fullDefaults = validateConfig(ConfigSchema, {});
  const cfg = deepMerge(fullDefaults, validated) as Config;
  debug("loadConfig", {
    legacyUserPath,
    userPath,
    projectPath,
    enabled: cfg.enabled,
    namingStyle: cfg.namingStyle,
    initialRenameTrigger: cfg.initialRenameTrigger,
    reRenameEveryNTurns: cfg.reRenameEveryNTurns,
    replaceExistingName: cfg.replaceExistingName,
    respectExternalRenames: cfg.respectExternalRenames,
    language: cfg.language,
    surfaces: cfg.surfaces,
  });
  return cfg;
}
