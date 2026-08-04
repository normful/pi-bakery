// i18n.ts — BCP-47 → locale resolution only. The LocaleStrings interface and
// all per-locale string tables live in locales.ts (see LOCALES.md); this module
// owns resolution. The type is re-exported so naming.ts keeps a single import
// site.
import { LOCALE_STRINGS, type LocaleStrings } from "./locales.js";
export type { LocaleStrings } from "./locales.js";

/** `{name}` placeholder inside a locale template string. */
const TEMPLATE_PLACEHOLDER_RE = /\{(\w+)\}/g;
/** Pragmatic BCP-47 subset: 2-3 letter primary language + hyphen-separated 2-8 char subtags. */
const BCP47_LANGUAGE_TAG_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;
/** BCP-47 subtag separator (`zh-CN` → subtags `zh`, `cn`). */
const BCP47_SUBTAG_SEPARATOR_RE = /-/;

/**
 * Validate + lowercase a BCP-47 tag. Anything that is not a valid BCP-47 tag
 * (natural-language names, underscores, empty) resolves to `"en"`.
 */
export function normalizeLanguageTag(value: string): string {
  const tag = value.trim().toLowerCase();
  return BCP47_LANGUAGE_TAG_RE.test(tag) ? tag : "en";
}

/** Replace `{name}` placeholders with values (values are inserted verbatim). */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(TEMPLATE_PLACEHOLDER_RE, (m, key) =>
    key in vars ? String(vars[key]) : m,
  );
}

/**
 * Map a normalized BCP-47 tag to a locale-table key. Resolution order:
 * 1. Exact tag match (`pt-br`, `zh-hant`).
 * 2. `zh` script/region disambiguation: `hant` and the regions `tw`/`hk`/`mo`
 *    resolve to the Traditional Chinese table; `hans` and the regions `cn`/`sg`
 *    (and bare `zh`) resolve to the Simplified Chinese table.
 * 3. `pt` region: `pt-br` has its own table; other Portuguese variants
 *    (`pt-pt`, …) fall back to it — the closest available table.
 * 4. Primary-subtag lookup for every other locale.
 * Returns `"en"` when no table exists (English scaffolding fallback). Keys in
 * `LOCALE_STRINGS` are lowercase; `normalizeLanguageTag` lowercases the tag
 * first, so lookups are case-safe.
 */
function resolveLocaleKey(tag: string): string {
  if (LOCALE_STRINGS[tag]) return tag; // exact match: "zh-hant", "pt-br"
  const subtags = tag.split(BCP47_SUBTAG_SEPARATOR_RE);
  const primary = subtags[0];
  if (primary === "zh") {
    if (subtags[1] === "hant") return "zh-hant";
    if (subtags[1] === "hans") return "zh";
    if (subtags[1] === "tw" || subtags[1] === "hk" || subtags[1] === "mo") return "zh-hant";
    return "zh";
  }
  if (primary === "pt") return "pt-br";
  return LOCALE_STRINGS[primary] ? primary : "en";
}

/**
 * Resolve a configured BCP-47 tag to its locale table (see `resolveLocaleKey`).
 * Valid tags without a built-in table fall back to English scaffolding, while
 * the normalized tag is still passed to the model (§9.3/§9.4) so generated
 * names follow the configured language. Invalid tags (non-BCP-47) resolve to
 * English entirely.
 */
export function buildLocale(language: string): LocaleStrings {
  const key = resolveLocaleKey(normalizeLanguageTag(language));
  return LOCALE_STRINGS[key] ?? LOCALE_STRINGS.en;
}
