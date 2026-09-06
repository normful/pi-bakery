// naming.ts — style prompts, dual-name (WINDOW/SESSION) LLM call, fallback chain.
import { basename } from "node:path";
import type {
  Api,
  AssistantMessage,
  Context,
  Model,
  ModelsApiStreamOptions,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI, ModelRegistry } from "@earendil-works/pi-coding-agent";
import type { Config } from "./config.js";
import type { NamingContext } from "./context.js";
import { buildLocale, fill, normalizeLanguageTag, type LocaleStrings } from "./i18n.js";
import {
  ISO_FALLBACK_RE,
  WINDOW_WORD_MIN,
  buildProjectSuffixTitle,
  cleanLine,
  cleanTitle,
  codePointLength,
  compactWindowName,
  normalizeTitle,
  sanitizeSlug,
  topicWithoutProject,
  truncateToMax,
} from "./sanitize.js";
import { debug, debugEnabled } from "./debug.js";

/**
 * The session-bound values a naming run needs from `ExtensionContext`, captured
 * up front at the top of an event handler. Passing this snapshot through the
 * (possibly deferred) flow — rather than a live `ctx` — means the flow never
 * touches a stale-guarded ctx getter after an await, so a session replacement
 * or reload cannot invalidate it mid-run.
 */
export interface NamingSession {
  modelRegistry: ModelRegistry;
  model: Model<Api> | undefined;
  signal: AbortSignal | undefined;
}

// Lazy, cached dynamic import: pi-ai is only loaded on the first naming run,
// not at extension load. The promise is cached so repeated runs share one module.
let _piAi: Promise<typeof import("@earendil-works/pi-ai")> | undefined;
function piAi(): Promise<typeof import("@earendil-works/pi-ai")> {
  return (_piAi ??= import("@earendil-works/pi-ai"));
}

// Inline model-key codec: slash at >=1, else invalid.
export function splitIntoProviderAndModelId(
  key: string,
): { provider: string; modelId: string } | undefined {
  const slashIdx = key.indexOf("/");
  if (slashIdx >= 1) return { provider: key.slice(0, slashIdx), modelId: key.slice(slashIdx + 1) };
  return undefined;
}

export const RETRIES = 3;
export const UI_RENAME_TIMEOUT_MS = 10_000; // fire-and-forget UI budget (§11)

/** Fixed default window-name limit for any style, when no override is configured. */
export const DEFAULT_MAX_WINDOW_NAME_CHARS = 30;
/** Fixed default session-name limit for any style, when no override is configured. */
export const DEFAULT_MAX_SESSION_NAME_CHARS = 200;

/**
 * Effective window-name limit: `cfg.windowNameMaxLength` if set, else
 * DEFAULT_MAX_WINDOW_NAME_CHARS. The same limit applies to every style.
 */
export function windowNameBudget(cfg: Config): number {
  return cfg.windowNameMaxLength ?? DEFAULT_MAX_WINDOW_NAME_CHARS;
}

/**
 * Effective session-name limit: `cfg.sessionNameMaxLength` if set, else
 * DEFAULT_MAX_SESSION_NAME_CHARS. The same limit applies to every style.
 */
export function sessionNameBudget(cfg: Config): number {
  return cfg.sessionNameMaxLength ?? DEFAULT_MAX_SESSION_NAME_CHARS;
}

/**
 * Token budget for the naming LLM call.
 *
 * Fixed 2048 tokens — generous for the 2-line `WINDOW`/`SESSION` output
 * (worst ~3 tok/char + labels) and leaves headroom when a provider counts
 * thinking/reasoning against the same ceiling. Grounded:
 * - Anthropic `max_tokens` includes `budget_tokens` (platform.claude.com)
 * - OpenAI `max_completion_tokens`/`max_output_tokens` includes `reasoning_tokens` (platform.openai.com)
 * - Gemini `maxOutputTokens` includes `thoughts` (ai.google.dev) — 2048 avoids
 *   the empty-response truncation seen with 35-435 caps on gemini-2.5/3 flash.
 * `pi-ai` adds `thinkingBudget` on top when `reasoning` is set, so this is
 * answer-only; keep it constant — no need to scale with W/S.
 */
export function resolveMaxTokens(_cfg: Config): number {
  return 2048;
}

function buildTopicProjectPrompt(input: {
  projectName?: string;
  cwd: string;
  firstUserMessage?: string;
  firstAssistantMessage?: string;
  conversation?: string;
  separator: string;
  maxChars: number;
  windowMaxChars: number;
  sessionMaxChars: number;
  topicBudget: number;
  language: string;
  locale: LocaleStrings;
}): string {
  const { locale } = input;
  return fill(locale.topicProjectPromptTemplate, {
    language: input.language,
    maxChars: input.maxChars,
    windowMaxChars: input.windowMaxChars,
    sessionMaxChars: input.sessionMaxChars,
    topicBudget: input.topicBudget,
    projectName: input.projectName ?? "",
    separator: input.separator,
    projectLines: input.projectName
      ? fill(locale.projectSuffixLines, {
          separator: input.separator,
          projectName: input.projectName,
        })
      : "",
    projectLine: input.projectName ? `${locale.projectLabel} ${input.projectName}\n` : "",
    cwd: input.cwd,
    firstUserBlock: input.firstUserMessage
      ? `\n${locale.firstUserMessageLabel}\n${input.firstUserMessage}`
      : "",
    firstAssistantBlock: input.firstAssistantMessage
      ? `\n\n${locale.firstAssistantMessageLabel}\n${input.firstAssistantMessage}`
      : "",
    conversationBlock: input.conversation
      ? fill(locale.conversationSection, { conversation: input.conversation })
      : "",
  });
}

function systemPromptFor(style: Config["namingStyle"], locale: LocaleStrings, cfg: Config): string {
  const lengthVariables = {
    windowMaxChars: windowNameBudget(cfg),
    sessionMaxChars: sessionNameBudget(cfg),
  };
  let base: string;
  switch (style) {
    case "slug":
      base = fill(locale.slugSystemPrompt, lengthVariables);
      break;
    case "topic-project":
      base = fill(locale.topicProjectSystemPrompt, lengthVariables);
      break;
    case "natural":
      base = fill(locale.naturalSystemPrompt, lengthVariables);
      break;
  }
  // topic-project declares the language in its user template (`Language:
  // {language}`); the natural/slug scaffolding is written in the target
  // language but never names it, so inject an explicit directive — otherwise
  // English-biased naming models default to English output regardless of the
  // configured `language`.
  if (style === "natural" || style === "slug") {
    const directive = fill(locale.languageDirective, {
      language: normalizeLanguageTag(cfg.language),
    });
    return `${directive}\n\n${base}`;
  }
  return base;
}

/** Structural subset of pi.exec used by the anchor lookup. */
export type Exec = (
  command: string,
  args: string[],
  options?: { cwd?: string },
) => Promise<{ stdout: string; stderr: string; code: number; killed: boolean }>;

/** Uniqueness hints for the naming prompt (sibling-session distinguishability). */
export interface NamingAnchor {
  /** Working-directory basename, e.g. "pi-extensions". */
  cwd?: string;
  /** Git branch name, e.g. "feat/oauth-retry". */
  branch?: string;
}

/** Uniqueness hints for the prompt; `cwd:` / `git branch:` are structural markers (§9.1). */
export function buildAnchorBlock(anchor: NamingAnchor | undefined): string {
  const lines: string[] = [];
  if (anchor?.cwd) lines.push(`cwd: ${anchor.cwd}`);
  if (anchor?.branch) lines.push(`git branch: ${anchor.branch}`);
  return lines.length ? `${lines.join("\n")}\n` : "";
}

/**
 * Resolve the cwd basename + git branch as uniqueness hints for the naming
 * prompt. The git call runs in the session's cwd — the host exec may default
 * to a different directory (launch dir, /cd inside pi, RPC mode). Failures
 * (no git repo, no branch) silently drop the missing fields.
 */
export async function resolveNamingAnchor(exec: Exec, cwd: string): Promise<NamingAnchor> {
  const anchor: NamingAnchor = {};
  const base = basename(cwd);
  if (base) anchor.cwd = base;
  try {
    const result = await exec("git", ["branch", "--show-current"], { cwd });
    const branch = result.stdout.trim();
    if (branch) anchor.branch = branch;
  } catch {
    // not a git repository — branch hint unavailable
  }
  return anchor;
}

function renderPrompt(
  style: Config["namingStyle"],
  context: NamingContext,
  cfg: Config,
  cwd: string,
  anchor: NamingAnchor,
): string {
  const language = normalizeLanguageTag(cfg.language);
  const locale = buildLocale(language);
  const first = context.firstUserMessage;
  const recent = context.recentUserMessages.length
    ? context.recentUserMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")
    : locale.noneLabel;
  const anchorBlock = buildAnchorBlock(anchor);
  const format = `\n\n${locale.responseFormat}`;

  if (style === "topic-project") {
    const projectName = basename(cwd).trim() || undefined;
    const W = windowNameBudget(cfg);
    const S = sessionNameBudget(cfg);
    const topicBudget = Math.max(0, W - codePointLength(`｜${projectName ?? ""}`));
    return (
      anchorBlock +
      buildTopicProjectPrompt({
        projectName,
        cwd,
        firstUserMessage: first || undefined,
        firstAssistantMessage: context.firstAssistantMessage,
        conversation: context.fullText,
        separator: "｜",
        maxChars: S,
        windowMaxChars: W,
        sessionMaxChars: S,
        topicBudget,
        language,
        locale,
      }) +
      format
    );
  }

  const base = context.fullText
    ? ""
    : fill(locale.namingContextTemplate, {
        firstUserMessageLabel: locale.firstUserMessageLabel,
        first,
        recent,
      });
  const extra = context.fullText
    ? fill(locale.conversationSection, { conversation: context.fullText })
    : "";
  const rules = fill(locale.naturalRules, {
    windowMaxChars: windowNameBudget(cfg),
    sessionMaxChars: sessionNameBudget(cfg),
  });

  // Reinforce the output language in the user turn too — weak models attend to
  // the user message far more than the system prompt, so repeat the directive
  // here (the natural/slug scaffolding never names the language itself).
  const directive = fill(locale.languageDirective, { language });

  // Wrap naming context (anchor + base + extra) in a single <context> block.
  // The template `namingContextTemplate` no longer contains a header
  // (§9.1 removed), so no intermediate string ever includes that header —
  // the block contains only raw hints:
  //   <context>
  //   cwd: ...
  //
  //   First user message:
  //   ...
  //   </context>
  const anchorInner = anchorBlock.trimEnd();
  const baseInner = base.trim();
  const extraInner = extra.trim();
  const innerParts = [anchorInner, baseInner, extraInner].filter(Boolean).join("\n\n");
  const contextBlock = innerParts ? `<context>\n${innerParts}\n</context>\n` : "";
  return `${directive}\n\n${rules}\n${contextBlock}${locale.responseFormat}`;
}

export function resolveModel(
  modelRegistry: ModelRegistry,
  currentModel: Model<Api> | undefined,
  cfg: Config,
): Model<Api> | undefined {
  if (cfg.namingModel) {
    const parsed = splitIntoProviderAndModelId(cfg.namingModel);
    if (parsed) {
      const model = modelRegistry.find(parsed.provider, parsed.modelId);
      if (model) return model;
    }
  }
  return currentModel; // may be undefined → missing_model
}

/**
 * The compact surface label (herdr pane/tab, tmux window, zellij pane/tab),
 * sanitized for the active style. `maxChars` is the enforced budget — callers
 * compute it via `windowNameBudget`. Returns undefined when the value compacts
 * to nothing usable → the caller retries (invalid output).
 */
export function sanitizeWindowName(
  style: Config["namingStyle"],
  raw: string,
  maxChars: number,
  cwd: string,
  opts?: { isExplicit?: boolean },
): string | undefined {
  const isExplicit = opts?.isExplicit ?? false;
  if (isExplicit) {
    switch (style) {
      case "natural": {
        // Hard cut after minimal cleaning — may cut mid-word, no word floor.
        const lines = raw.split(/\r?\n/).map(cleanLine).filter(Boolean);
        const cleaned = lines[0] ?? cleanLine(raw);
        if (!cleaned) return undefined;
        return truncateToMax(cleaned, maxChars) || undefined;
      }
      case "slug": {
        const s = sanitizeSlug(raw);
        if (!s) return undefined;
        const truncated = truncateToMax(s, maxChars);
        // Hard cut may leave trailing hyphen (e.g. "fix-oauth-issue" @10 -> "fix-oauth-"); trim it
        return truncated.replace(/-+$/, "").trim() || undefined;
      }
      case "topic-project": {
        const projectName = basename(cwd).trim();
        // Do not pre-truncate topic to maxChars — let buildProjectSuffixTitle budget it as 1b
        const rawTopic = cleanTitle(raw, Infinity) ?? "";
        const topic = topicWithoutProject(rawTopic, projectName, "｜");
        if (!topic && !projectName) return undefined;
        return buildProjectSuffixTitle(topic, projectName, "｜", maxChars) || undefined;
      }
    }
  }
  switch (style) {
    case "natural": {
      // 2-4 whole words, dropped to fit maxChars; undefined below the word
      // floor → invalid output, retry.
      return compactWindowName(raw, WINDOW_WORD_MIN, maxChars) || undefined;
    }
    case "slug": {
      const s = sanitizeSlug(raw);
      if (!s) return undefined;
      const truncated = truncateToMax(s, maxChars);
      return truncated.replace(/-+$/, "").trim() || undefined;
    }
    case "topic-project": {
      const projectName = basename(cwd).trim();
      const topic = cleanTitle(raw, maxChars) ?? "";
      if (!topic && !projectName) return undefined;
      return buildProjectSuffixTitle(
        topicWithoutProject(topic, projectName, "｜"),
        projectName,
        "｜",
        maxChars,
      );
    }
  }
}

/**
 * The session name (Pi session + session list), sanitized for the active
 * style. `maxChars` is the enforced budget — callers compute it via
 * `sessionNameBudget`.
 */
export function sanitizeSessionName(
  style: Config["namingStyle"],
  raw: string,
  maxChars: number,
): string | undefined {
  switch (style) {
    case "slug": {
      const s = sanitizeSlug(raw);
      return s ? truncateToMax(s, maxChars) : undefined;
    }
    case "natural": {
      const t = normalizeTitle(raw, maxChars);
      // The temporary-title flow owns ISO timestamps; treat them as "no title".
      return ISO_FALLBACK_RE.test(t) ? undefined : t;
    }
    case "topic-project": {
      return cleanTitle(raw, maxChars) ?? undefined;
    }
  }
}

/** The two names produced by a single naming call. */
export interface GeneratedNames {
  windowName: string;
  sessionName: string;
}

/** Why name generation failed. */
export type GenerateFailureReason =
  | "missing_prompt"
  | "missing_model"
  | "missing_auth"
  | "request_failed"
  | "invalid_output";

export type GenerateNamesResult =
  | { ok: true; names: GeneratedNames }
  | { ok: false; reason: GenerateFailureReason };

/**
 * Environmental failures never resolve mid-session (missing config/prompt) —
 * callers must latch rather than schedule temporary-title re-runs (§11).
 */
export const ENVIRONMENTAL_FAILURES: ReadonlySet<GenerateFailureReason> = new Set([
  "missing_prompt",
  "missing_model",
  "missing_auth",
]);

/** A leading `window:` label at the line start. */
const WINDOW_LABEL_RE = /^window\s*:\s*(.*)$/i;
/** A leading `session:` label at the line start. */
const SESSION_LABEL_RE = /^session\s*:\s*(.*)$/i;
/** Surrounding quotes/whitespace on a generated value. */
const GENERATED_VALUE_QUOTES_RE = /^[\s"'`]+|[\s"'`]+$/g;

function cleanGeneratedValue(value: string): string {
  return value.replace(GENERATED_VALUE_QUOTES_RE, "").trim();
}

/**
 * Parse the two labeled lines. Anchored at the line start so a "session:"
 * appearing inside a WINDOW value (or "window:" inside a SESSION value) is
 * never misread as the other label. Punctuation inside values is stripped
 * later by the sanitizers.
 */
export function parseGeneratedNames(value: string): {
  window?: string;
  session?: string;
} {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let windowName: string | undefined;
  let sessionName: string | undefined;

  for (const line of lines) {
    if (!windowName) {
      const windowMatch = line.match(WINDOW_LABEL_RE);
      if (windowMatch?.[1]) windowName = cleanGeneratedValue(windowMatch[1]);
    }
    if (!sessionName) {
      const sessionMatch = line.match(SESSION_LABEL_RE);
      if (sessionMatch?.[1]) sessionName = cleanGeneratedValue(sessionMatch[1]);
    }
    if (windowName && sessionName) break;
  }
  return { window: windowName, session: sessionName };
}

/**
 * Single naming LLM call, in order of preference:
 *
 * 1. `ctx.modelRegistry.complete` — pi-mono main exposes it (delegating to
 *    ModelRuntime.complete), routing through pi's runtime: ALL providers
 *    (built-in + custom providers) and pi's credential
 *    store. A fresh `createModels()` cannot see extension-registered providers
 *    — that was the original "Unknown provider" failure.
 * 2. Published pi builds (ModelRegistry without `complete`): stream through
 *    the runtime provider (`getProvider`) with runtime-resolved auth
 *    (`getApiKeyAndHeaders`) injected — same provider catalog and auth pi
 *    itself uses, without a separate credential store.
 *
 * Failures surface as `stopReason: "error"` messages (never thrown) per
 * pi-ai's contract; the retry/fallback loop in generateNames handles them.
 */
// The npm-published @earendil-works/pi-coding-agent types lag pi-mono source
// (ModelRegistry.complete landed after the 0.83.0 publish), so widen the facade
// type locally; pi-mono main has it at runtime.
type ModelRegistryWithComplete = ModelRegistry & {
  complete<TApi extends Api>(
    model: Model<TApi>,
    context: Context,
    options?: ModelsApiStreamOptions<TApi>,
  ): Promise<AssistantMessage>;
};

async function completeOnce(
  modelRegistry: ModelRegistry,
  model: Model<Api>,
  systemPrompt: string,
  userText: string,
  options: {
    timeoutMs: number;
    signal?: AbortSignal;
    maxTokens: number;
  },
): Promise<AssistantMessage> {
  const context: Context = {
    systemPrompt,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: userText }],
        timestamp: Date.now(),
      },
    ],
  };
  const streamOptions: ModelsApiStreamOptions<Api> & {
    timeoutMs: number;
    signal?: AbortSignal;
  } = {
    maxTokens: options.maxTokens,
    maxRetries: 0,
    cacheRetention: "none" as const,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
  };

  const registry = modelRegistry as ModelRegistryWithComplete;
  if (typeof registry.complete === "function") {
    return registry.complete(model, context, streamOptions);
  }

  const { ModelsError } = await piAi();
  const provider = modelRegistry.getProvider(model.provider);
  if (!provider) throw new ModelsError("provider", `Unknown provider: ${model.provider}`);
  const auth = await modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) throw new ModelsError("auth", auth.error);
  const stream = provider.stream(model, context, {
    ...streamOptions,
    apiKey: auth.apiKey,
    headers: auth.headers,
    env: auth.env,
  });
  return stream.result();
}

/** The outcome of one generateNames attempt, so the retry loop stays small. */
type AttemptResult =
  | { ok: true; names: GeneratedNames }
  | { ok: false; kind: "missing_model" }
  | { ok: false; kind: "missing_auth" }
  | { ok: false; kind: "request_failed" }
  | { ok: false; kind: "retry" };

/**
 * Run a single naming attempt. Each risky step is wrapped in its own small
 * try/catch that logs exactly where it failed, so a failure pinpoints the
 * stage via debug instead of collapsing the whole retry iteration into one
 * opaque catch. Returns a discriminated `AttemptResult` for the caller's
 * retry loop — it never throws.
 */
async function attemptOnce(
  session: NamingSession,
  cfg: Config,
  context: NamingContext,
  titles: string[],
  cwd: string,
  pi: ExtensionAPI,
  options: { timeoutMs?: number },
  attempt: number,
  anchor: NamingAnchor,
): Promise<AttemptResult> {
  const style = cfg.namingStyle;
  const locale = buildLocale(cfg.language);

  // Step 1: resolve the model.
  const model = resolveModel(session.modelRegistry, session.model, cfg);
  if (!model) {
    debug("generateNames: missing_model — no model resolved", {
      namingModel: cfg.namingModel,
      hasCtxModel: Boolean(session.model),
    });
    return { ok: false, kind: "missing_model" };
  }
  const modelRef = `${model.provider}/${model.id}`;

  // Step 2: (diagnostic) confirm pi's runtime sees auth for this model before
  // the call — auth failures surface as stopReason "error", not throws. Log
  // only on failure — "configured" is steady-state noise.
  if (debugEnabled) {
    try {
      const auth = await session.modelRegistry.getApiKeyAndHeaders(model);
      if (!auth.ok) {
        debug("generateNames: pi runtime auth unconfigured", {
          model: modelRef,
          error: auth.error,
        });
      }
    } catch (error) {
      debug("generateNames: pi runtime auth probe failed", String(error));
    }
  }

  // Step 3: render the naming prompt (with the dedup wrapper when titles exist).
  let fullPrompt: string;
  try {
    const prompt = renderPrompt(style, context, cfg, cwd, anchor);
    fullPrompt = titles.length
      ? `${locale.dedupIntro}\n${titles.map((t) => `- ${t}`).join("\n")}\n\n${prompt}`
      : prompt;
  } catch (error) {
    debug("generateNames: renderPrompt threw", String(error));
    return { ok: false, kind: "request_failed" };
  }

  // Step 4: the LLM call itself — the site that can throw ModelsError.
  const maxTokens = resolveMaxTokens(cfg);
  debug("generateNames: attempt", { attempt, model: modelRef, maxTokens });
  const { ModelsError } = await piAi();
  let response: AssistantMessage;
  try {
    response = await completeOnce(
      session.modelRegistry,
      model,
      systemPromptFor(cfg.namingStyle, locale, cfg),
      fullPrompt,
      { timeoutMs: options.timeoutMs ?? 30_000, signal: session.signal, maxTokens },
    );
  } catch (error) {
    if (error instanceof ModelsError) {
      debug("generateNames: missing_auth (ModelsError)", {
        code: error.code,
        message: error.message,
      });
      return { ok: false, kind: "missing_auth" };
    }
    debug("generateNames: request_failed", String(error));
    return { ok: false, kind: "request_failed" };
  }

  // Only error/retry responses are diagnostic noise worth recording; a clean
  // "stop" is the expected path covered by the parsed-output log.
  if (response.stopReason !== "stop") {
    debug("generateNames: response (non-stop)", {
      stopReason: response.stopReason,
      errorMessage: response.errorMessage,
    });
    return { ok: false, kind: "retry" };
  }

  // Step 5: parse + sanitize the output.
  let windowName: string | undefined;
  let sessionName: string | undefined;
  let parsedSession: string | undefined;
  const isExplicit = cfg.windowNameMaxLength !== undefined;
  try {
    const raw = response.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const parsed = parseGeneratedNames(raw);
    parsedSession = parsed.session;
    windowName = sanitizeWindowName(style, parsed.window ?? "", windowNameBudget(cfg), cwd, {
      isExplicit,
    });
    sessionName = sanitizeSessionName(style, parsed.session ?? "", sessionNameBudget(cfg));
    debug("generateNames: parsed output", {
      raw: raw.slice(0, 120),
      window: parsed.window,
      session: parsed.session,
      sanitized: { windowName, sessionName },
    });
  } catch (error) {
    debug("generateNames: parse/sanitize threw", String(error));
    return { ok: false, kind: "request_failed" };
  }
  if (windowName && sessionName) {
    return { ok: true, names: { windowName, sessionName } };
  }
  // Salvage: the session name is the primary product (pi session + session
  // list) while the window is an auxiliary surface label. When the model
  // returns a usable session with a degenerate window (e.g. a single word
  // below the natural floor), derive the window from the session raw instead
  // of discarding both — retrying would burn another call for a name we
  // already have, and the last-message fallback would lose the model's
  // session entirely.
  if (!windowName && sessionName && parsedSession) {
    const derived = sanitizeWindowName(style, parsedSession, windowNameBudget(cfg), cwd, {
      isExplicit,
    });
    if (derived) {
      debug("generateNames: derived window from session", { derived });
      return { ok: true, names: { windowName: derived, sessionName } };
    }
  }
  debug("generateNames: invalid output — retrying");
  return { ok: false, kind: "retry" };
}

/**
 * Try the LLM (up to RETRIES), then the last-message fallback. Returns
 * `ok: false` only when nothing usable exists — the caller then goes to the
 * temporary-title flow, unless the reason is environmental
 * (`ENVIRONMENTAL_FAILURES`), in which case the caller latches instead (§11).
 */
export async function generateNames(
  session: NamingSession,
  cfg: Config,
  context: NamingContext,
  titles: string[],
  cwd: string,
  pi: ExtensionAPI,
  options: { timeoutMs?: number } = {},
): Promise<GenerateNamesResult> {
  const style = cfg.namingStyle;
  const seed = context.recentUserMessages.at(-1) ?? context.firstUserMessage;
  if (!seed) {
    debug("generateNames: missing_prompt — no seed (no user message yet)");
    return { ok: false, reason: "missing_prompt" };
  }
  debug("generateNames: start", {
    style,
    seed: seed.slice(0, 80),
  });

  const anchor = await resolveNamingAnchor(pi.exec, cwd);

  // Overall attempt budget: a hung model must not stall the caller for
  // RETRIES x the per-call timeout (e.g. ~90s on an awaited headless first
  // input). Past the budget, stop retrying and fall through to the
  // last-message fallback below, which needs no network.
  const attemptStart = Date.now();
  const attemptBudgetMs = options.timeoutMs ?? 30_000;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    if (attempt > 0 && Date.now() - attemptStart > attemptBudgetMs) {
      debug("generateNames: attempt budget exhausted - falling back", {
        attempt,
        budgetMs: attemptBudgetMs,
      });
      break;
    }
    const res = await attemptOnce(session, cfg, context, titles, cwd, pi, options, attempt, anchor);
    if (res.ok) return { ok: true, names: res.names };
    switch (res.kind) {
      case "missing_model":
        return { ok: false, reason: "missing_model" };
      case "missing_auth":
        return { ok: false, reason: "missing_auth" };
      case "request_failed":
        return { ok: false, reason: "request_failed" };
      case "retry":
        continue; // invalid / non-stop output → try again
    }
  }

  // Last-message fallback: sanitize the latest user message into both names.
  const isExplicit = cfg.windowNameMaxLength !== undefined;
  const fallbackWindow = sanitizeWindowName(style, seed, windowNameBudget(cfg), cwd, {
    isExplicit,
  });
  const fallbackSession = sanitizeSessionName(style, seed, sessionNameBudget(cfg));
  if (fallbackWindow && fallbackSession) {
    debug("generateNames: last-message fallback", {
      fallbackWindow,
      fallbackSession,
    });
    return {
      ok: true,
      names: { windowName: fallbackWindow, sessionName: fallbackSession },
    };
  }
  debug("generateNames: invalid_output — fallback produced nothing usable");
  return { ok: false, reason: "invalid_output" };
}
