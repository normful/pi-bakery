import { fauxAssistantMessage } from "@earendil-works/pi-ai";

export function fauxWindowSession(windowName: string, sessionName: string) {
  return fauxAssistantMessage(`WINDOW: ${windowName}\nSESSION: ${sessionName}`);
}

export function fauxInvalidOutput(text = "WINDOW: Only one line") {
  return fauxAssistantMessage(text);
}

export function fauxErrorOutput(message = "transient error") {
  return fauxAssistantMessage("", { stopReason: "error" as const, errorMessage: message });
}
