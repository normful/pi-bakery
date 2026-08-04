# Locales — source of truth for pi-auto-name prompt strings

All user-facing / LLM-facing prompt scaffolding for pi-auto-name lives in
[`src/locales.ts`](./src/locales.ts) as per-locale `LocaleStrings` tables,
registered in the `LOCALE_STRINGS` map. This file documents the conventions.

## Locale table keys

| Key | Language | BCP-47 examples |
| `en` | English (scaffolding) | `en` |
| `zh` | Simplified Chinese | `zh`, `zh-CN`, `zh-Hans`, `zh-SG` |
| `zh-hant` | Traditional Chinese | `zh-Hant`, `zh-TW`, `zh-HK`, `zh-MO` |
| `ja` | Japanese | `ja`, `ja-JP` |
| `ko` | Korean | `ko`, `ko-KR` |
| `pt-br` | Brazilian Portuguese | `pt-BR`, `pt`, `pt-PT` (falls back) |
| `es` | Spanish | `es`, `es-ES`, `es-MX` |
| `de` | German | `de`, `de-DE`, `de-AT` |
| `fr` | French | `fr`, `fr-FR`, `fr-CA` |
| `id` | Indonesian | `id`, `id-ID` |
| `vi` | Vietnamese | `vi`, `vi-VN` |
| `tr` | Turkish | `tr`, `tr-TR` |
| `pl` | Polish | `pl`, `pl-PL` |
| `uk` | Ukrainian | `uk`, `uk-UA` |
| `fa` | Persian (Farsi) | `fa`, `fa-IR` |
| `ar` | Arabic | `ar`, `ar-SA` |
| `hi` | Hindi | `hi`, `hi-IN` |
| `it` | Italian | `it`, `it-IT` |
| `nl` | Dutch | `nl`, `nl-NL` |
| `th` | Thai | `th`, `th-TH` |

`en` must always be present — it is the fallback for valid BCP-47 tags without
a built-in table. Resolution lives in `src/i18n.ts` (`resolveLocaleKey`) and
runs in this order:

1. **Exact tag match** (`zh-hant`, `pt-br`).
2. **`zh` script/region disambiguation** — `zh-Hant` / `zh-TW` / `zh-HK` /
   `zh-MO` map to `zh-hant`; `zh-Hans` / `zh-CN` / `zh-SG` / bare `zh` map to
   `zh`.
3. **`pt` region** — any Portuguese tag maps to the `pt-br` table (the closest
   available), so `pt-PT` / `pt-MO` / `pt-AO` all resolve to `pt-br`.
4. **Primary-subtag lookup** for every other tag; tags without a built-in table
   fall through to `en`.

## Adding a language

1. Append a `const XX: LocaleStrings = { … }` table above the registry.
2. Register it in `LOCALE_STRINGS` (lowercase key).
3. If it needs region/script disambiguation (like `zh`), add a row in
   `resolveLocaleKey` in `src/i18n.ts`. Keep each branch pointed at a key that
   actually exists in `LOCALE_STRINGS`: a branch that returns an unregistered
   key is dead and silently falls through to `en`. `pt` is the model case — a
   single row returns `pt-br`, and every Portuguese variant (`pt-PT`, …) shares
   that table.
4. Extend `test/i18n.test.ts` (resolution) and `test/locales.test.ts`
   (per-table content) as appropriate.

## Invariants (enforced by tests)

- Every table implements **all 15 `LocaleStrings` fields** as non-empty
  strings.
- Every `{placeholder}` used by the naming templates is preserved verbatim:
  `{language} {maxChars} {projectLines} {projectLine} {cwd} {firstUserBlock}
{firstAssistantBlock}` in `topicProjectPromptTemplate`,
  `{firstUserMessageLabel} {first} {recent}` in `namingContextTemplate`,
  `{conversation}` in `conversationSection`,
  `{separator} {projectName}` in `projectSuffixLines`, and
  `{language}` in `languageDirective`.
- **The model output contract stays ASCII in every locale**: `responseFormat`
  and any instructions that name the output lines keep the `WINDOW:` /
  `SESSION:` labels, because `naming.ts` parses the model reply with the
  ASCII-anchored `WINDOW_LABEL_RE` / `SESSION_LABEL_RE`. Only the surrounding
  instruction scaffolding is translated.
- **Lengths are parametric, not hardcoded.** Every string that states a WINDOW /
  SESSION size (`naturalSystemPrompt`, `slugSystemPrompt`,
  `topicProjectSystemPrompt`, `naturalRules`) uses the `{windowMaxChars}` and
  `{sessionMaxChars}` placeholders instead of literal numbers. `naming.ts`
  fills them with the effective `windowNameBudget(cfg)` /
  `sessionNameBudget(cfg)` (from `windowNameMaxLength` / `sessionNameMaxLength`
  config, falling back to the `DEFAULT_MAX_*_NAME_CHARS` constants), so the
  model always sees the real enforced budget. Do not substitute literal numbers
  for these placeholders.
- `naturalRules` is newline-joined to exactly 10 lines.
- **Output language is stated explicitly, not just implied by scaffold
  language.** `languageDirective` is a localized "output in {language}"
  sentence; `naming.ts` injects it at the top of the `natural` and `slug`
  system prompts so English-biased models still honor the configured `language`.
  The `topic-project` style does not inject it — its user template already
  carries its own `Language: {language}` line.

## Language-specific guidance

- **Word vs character sizing.** English, Brazilian Portuguese, Spanish, German,
  French, Indonesian, Vietnamese, Turkish, Polish, Ukrainian, Persian, Arabic,
  Hindi, Italian and Dutch size names in words (`WINDOW` 2-4, `SESSION` 8-12).
  CJK and Thai have no whitespace word boundaries, so those tables size by
  character count (`WINDOW` ≈ 4-12, `SESSION` ≈ 15-40). Scripts without
  upper/lower case (all CJK, Thai, Persian, Arabic, Hindi) drop case ("Title
  Case" / lowercase) phrasing; scripts with case keep it.
- **Sanitizers are script-aware.** `sanitize.ts` word tokenizers are
  Unicode-aware (`\p{L}\p{M}\p{N}`), so letters and combining marks in every
  script — Arabic, Devanagari, Cyrillic, accented Latin, CJK, Thai — are kept
  as word content instead of being stripped (which used to drop the `natural`
  WINDOW name to `undefined` → `invalid_output` for non-Latin languages).
  `CJK_CHARS_SRC` still drives the no-boundary word floor: the `natural`
  window-name floor drops to 1 when a value contains Han / kana / Hangul /
  Thai (see `compactWindowName`).
