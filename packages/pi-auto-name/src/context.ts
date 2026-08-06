// context.ts — conversation context assembly (3 depths).
import type { ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import type { Config } from "./config.js";

export interface NamingContext {
  firstUserMessage: string; // first user message text
  recentUserMessages: string[]; // up to 3 most recent user messages (excluding first)
  firstAssistantMessage?: string; // text of the first assistant message (topic-project)
  fullText?: string; // serialized conversation (full-conversation depth)
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (b): b is { type: string; text: string } =>
        typeof b === "object" &&
        b !== null &&
        (b as { type?: string }).type === "text" &&
        typeof (b as { text?: unknown }).text === "string",
    )
    .map((b) => b.text)
    .join("\n");
}

function userMessageText(message: { role?: string; content?: unknown }): string {
  return extractText(message.content).trim();
}

/** Text of the first assistant message with content (topic-project context). */
function getFirstAssistantMessage(entries: readonly SessionEntry[]): string | undefined {
  for (const entry of entries) {
    if (entry.type !== "message" || entry.message.role !== "assistant") continue;
    const text = extractText(entry.message.content).trim();
    if (text) return text;
  }
  return undefined;
}

/** Depth "first" + "recent": first + last 3 user messages. */
function getUserMessageContext(
  entries: readonly SessionEntry[],
): { firstUserMessage: string; recentUserMessages: string[] } | undefined {
  const userMessages: { index: number; text: string }[] = [];
  for (const [index, entry] of entries.entries()) {
    if (entry.type !== "message" || entry.message.role !== "user") continue;
    const text = userMessageText(entry.message);
    if (text) userMessages.push({ index, text });
  }
  const firstMessage = userMessages[0];
  if (!firstMessage) return undefined;
  const recentMessages = userMessages.slice(-3).filter((m) => m.index !== firstMessage.index);
  return {
    firstUserMessage: firstMessage.text,
    recentUserMessages: recentMessages.map((m) => m.text),
  };
}

const MAX_FULL_CONVERSATION_CHARS = 60_000;
/** When truncating, reserve this many leading chars for the topic-defining head. */
const FULL_CONVERSATION_HEAD_CHARS = 40_000;
/** Marker that replaces the dropped middle of an oversized conversation. */
const FULL_CONVERSATION_OMITTED = "[Earlier conversation omitted]";

/**
 * Depth "full-conversation": User:/Assistant:/Tool serialization, capped.
 * On overflow, keeps BOTH the topic-defining head and the most recent tail
 * (the opening usually carries the session's core intent, so dropping it —
 * as a tail-only slice does — defeats the feature precisely when long).
 */
function buildConversationText(entries: readonly SessionEntry[]): string {
  const sections: string[] = [];
  for (const entry of entries) {
    if (entry.type !== "message") continue;
    const message = entry.message;
    if (message.role === "toolResult") {
      const text = extractText(message.content).trim();
      if (!text) continue;
      const isError = (message as { isError?: boolean }).isError;
      sections.push(`Result from ${message.toolName}${isError ? " [error]" : ""}: ${text}`);
      continue;
    }
    if (message.role === "user") {
      const text = extractText(message.content).trim();
      if (text) sections.push(`User: ${text}`);
      continue;
    }
    if (message.role === "assistant") {
      const lines: string[] = [];
      const text = extractText(message.content).trim();
      if (text) lines.push(`Assistant: ${text}`);
      for (const block of Array.isArray(message.content) ? message.content : []) {
        if (
          block &&
          typeof block === "object" &&
          (block as { type?: string }).type === "toolCall"
        ) {
          const tc = block as { name?: string; arguments?: unknown };
          lines.push(`${tc.name ?? "?"} tool called; args ${JSON.stringify(tc.arguments)}`);
        }
      }
      if (lines.length > 0) sections.push(lines.join("\n"));
    }
  }
  const conversation = sections.join("\n\n");
  if (conversation.length <= MAX_FULL_CONVERSATION_CHARS) return conversation;
  const tailChars = MAX_FULL_CONVERSATION_CHARS - FULL_CONVERSATION_HEAD_CHARS;
  const head = conversation.slice(0, FULL_CONVERSATION_HEAD_CHARS);
  const tail = conversation.slice(-tailChars);
  return `${head}\n\n${FULL_CONVERSATION_OMITTED}\n\n${tail}`;
}

/**
 * Assemble the naming context. Deliberately synchronous: callers build the
 * context at the top of an event handler, before any await, so the
 * `ctx.sessionManager` read happens while the event context is still active.
 * Deferring a session-bound read past an await is what lets a session
 * replacement/reload (which invalidates the ctx) slip in between — avoid that
 * by reading everything up front.
 */
export function buildContext(ctx: ExtensionContext, cfg: Config): NamingContext | undefined {
  // Compaction-aware view: pre-compaction summarized entries are excluded so
  // "full-conversation" depth does not include stale or duplicated conversation.
  const entries = ctx.sessionManager.buildContextEntries();

  if (cfg.namingContextDepth === "full-conversation") {
    const fullText = buildConversationText(entries);
    const firstCtx = getUserMessageContext(entries);
    if (!firstCtx && !fullText) return undefined;
    return {
      firstUserMessage: firstCtx?.firstUserMessage ?? "",
      recentUserMessages: firstCtx?.recentUserMessages ?? [],
      firstAssistantMessage: getFirstAssistantMessage(entries),
      fullText,
    };
  }

  const firstCtx = getUserMessageContext(entries);
  if (!firstCtx) return undefined;
  return {
    firstUserMessage: firstCtx.firstUserMessage,
    recentUserMessages: firstCtx.recentUserMessages,
    firstAssistantMessage: getFirstAssistantMessage(entries),
  };
}
