// config.ts — schema, defaults, load, shortcut validation.
import { Type, type Static, type TObject } from "typebox";
import {
  configPath,
  loadJsonConfig,
  validateConfig as rpivValidateConfig,
} from "@juicesharp/rpiv-config";
import type { KeyId } from "@earendil-works/pi-tui";

export const ConfigSchema = Type.Object({
  // Keyboard shortcut that triggers /parrot. Any KeyId ("alt+r",
  // "ctrl+shift+p", "f6", ...). Empty means no shortcut (the /parrot
  // command always works). Applies on (re)load.
  shortcut: Type.String({ default: "" }),
  // External editor command (may include args, e.g. "code -w").
  // Takes precedence over $VISUAL and $EDITOR when non-empty.
  editor: Type.String({ default: "" }),
});

export type Config = Static<typeof ConfigSchema>;

/**
 * Same wrapper as pi-auto-name: papers over typebox 1.x's bare `TObject`
 * defaulting `required` to `[string]`, which rpiv-config's
 * `T extends TObject` constraint otherwise rejects. Runtime unchanged.
 */
export function validateConfig<T extends TObject>(schema: T, value: unknown): Static<T> {
  return rpivValidateConfig(schema as TObject, value) as Static<T>;
}

export const USER_CONFIG_PATH = configPath("pi-parrot"); // ~/.config/pi-parrot/config.json

/**
 * Load user-global config only. Unlike pi-auto-name there is no project
 * override: the shortcut is consumed by registerShortcut in the extension
 * factory, which runs without a cwd, so a per-project key is not reachable
 * where it is needed.
 */
export function loadConfig(): Config {
  return validateConfig(ConfigSchema, loadJsonConfig<Record<string, unknown>>(USER_CONFIG_PATH));
}

// --- shortcut KeyId validation (runtime mirror of the KeyId union) ---

const BASE_KEYS = new Set([
  ..."abcdefghijklmnopqrstuvwxyz0123456789",
  "`",
  "-",
  "=",
  "[",
  "]",
  "\\",
  ";",
  "'",
  ",",
  ".",
  "/",
  "!",
  "@",
  "#",
  "$",
  "%",
  "^",
  "&",
  "*",
  "(",
  ")",
  "_",
  "+",
  "|",
  "~",
  "{",
  "}",
  ":",
  "<",
  ">",
  "?",
  "escape",
  "esc",
  "enter",
  "return",
  "tab",
  "space",
  "backspace",
  "delete",
  "insert",
  "clear",
  "home",
  "end",
  "pageUp",
  "pageDown",
  "up",
  "down",
  "left",
  "right",
  "f1",
  "f2",
  "f3",
  "f4",
  "f5",
  "f6",
  "f7",
  "f8",
  "f9",
  "f10",
  "f11",
  "f12",
]);

/**
 * Runtime check that a config string is a bindable KeyId:
 * zero or more distinct modifiers followed by exactly one base key.
 */
export function isValidShortcutKey(value: unknown): value is KeyId {
  if (typeof value !== "string" || value === "") return false;
  const match = /^(?:ctrl\+|shift\+|alt\+|super\+)*/.exec(value);
  const base = value.slice((match as RegExpExecArray)[0].length);
  if (!BASE_KEYS.has(base)) return false;
  const mods = (match as RegExpExecArray)[0].split("+").filter(Boolean);
  return new Set(mods).size === mods.length;
}
