import { randomUUID } from "node:crypto";

export const EVENT_TYPES = [
  "session.created", "session.updated", "mode.changed", "assistant.text", "assistant.thinking",
  "tool.start", "tool.update", "tool.end", "tasks.snapshot", "delegate.start", "delegate.update",
  "delegate.end", "interaction.required", "interaction.resolved", "context.updated", "kernel.updated",
  "artifact.created", "error", "aborted", "settled", "reconnect.cursor",
] as const;
export type EventType = typeof EVENT_TYPES[number];

const SECRET_FIELD = /(?:api[_-]?key|token|secret|password|authorization|credential|input[_-]?bytes)/i;

export function sanitizeEventPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeEventPayload);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) =>
    [key, SECRET_FIELD.test(key) ? "[redacted]" : sanitizeEventPayload(item)]));
}

export interface StableEvent {
  version: 1;
  event_id: number;
  session_id: string;
  type: EventType;
  timestamp: string;
  payload: Record<string, unknown>;
}

export class EventEmitter {
  private nextId = 1;
  private readonly sessionId: string;
  private readonly send: (event: StableEvent) => void;
  private assistantText = "";
  private assistantMessageId: string | null = null;
  constructor(sessionId: string, send: (event: StableEvent) => void) {
    this.sessionId = sessionId;
    this.send = send;
  }
  emit(type: EventType, payload: Record<string, unknown> = {}): StableEvent {
    const event: StableEvent = { version: 1, event_id: this.nextId++, session_id: this.sessionId,
      type, timestamp: new Date().toISOString(), payload: sanitizeEventPayload(payload) as Record<string, unknown> };
    this.send(event);
    return event;
  }
  translate(event: any): void {
    switch (event?.type) {
      case "message_start":
        if (event.message?.role === "assistant") {
          this.assistantText = "";
          this.assistantMessageId = randomUUID();
        }
        return;
      case "message_update":
      case "message_end": {
        if (event.message?.role !== "assistant") return;
        const messageId = this.assistantMessageId ??= randomUUID();
        if (event.type === "message_end" && event.message.stopReason === "error") {
          const detail = String(event.message.errorMessage ?? "");
          const status = /(?:status|HTTP|API error)\D{0,12}(\d{3})/i.exec(detail)?.[1];
          const category = /tool|schema|function/i.test(detail) ? "tool_schema" :
            /reasoning|thinking/i.test(detail) ? "reasoning" :
            /context|token|length/i.test(detail) ? "context" :
            /timeout|abort/i.test(detail) ? "timeout" :
            /auth|unauthorized|forbidden|401|403/i.test(detail) ? "authentication" : "request";
          this.emit("error", { code: "provider_error", category,
            message: status ? `Provider request failed with HTTP ${status}` : "Provider request failed" });
          this.assistantText = "";
          this.assistantMessageId = null;
          return;
        }
        const text = Array.isArray(event.message.content)
          ? event.message.content.filter((part: any) => part?.type === "text").map((part: any) => part.text).join("") : "";
        if (!text) {
          if (event.type === "message_end") {
            this.assistantText = "";
            this.assistantMessageId = null;
          }
          return;
        }
        if (event.type === "message_update") {
          const delta = text.startsWith(this.assistantText) ? text.slice(this.assistantText.length) : text;
          this.assistantText = text;
          if (delta) this.emit("assistant.text", { text: delta, delta: true, message_id: messageId });
        } else {
          if (text !== this.assistantText) this.emit("assistant.text", { text, delta: false, message_id: messageId });
          this.assistantText = "";
          this.assistantMessageId = null;
        }
        return;
      }
      case "tool_execution_start":
        this.emit("tool.start", { tool_call_id: event.toolCallId, tool: event.toolName, arguments: event.args }); return;
      case "tool_execution_update":
        this.emit("tool.update", { tool_call_id: event.toolCallId, tool: event.toolName, update: event.partialResult }); return;
      case "tool_execution_end":
        this.emit("tool.end", { tool_call_id: event.toolCallId, tool: event.toolName,
          status: event.isError ? "failed" : "completed", result: event.result }); return;
      case "agent_settled": this.assistantText = ""; this.assistantMessageId = null; this.emit("settled"); return;
      default: return; // raw copied-runtime event names never cross the host protocol
    }
  }
}
