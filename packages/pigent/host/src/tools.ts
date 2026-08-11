import type { AgentToolResult } from "@pipyter/pigent-agent";
import { type ToolDefinition } from "@pipyter/pigent-runtime";
import { Type, type TSchema } from "typebox";

// Mirrored from packages/protocol/src/pigent.ts. The protocol package is not a
// runtime dependency of the self-contained Pigent payload; protocol tests keep
// this projection byte-for-byte aligned with PIGENT_CATALOGS/ACTION_FILTERS.
export const TOOL_NAMES = ["read", "view", "write", "update", "bash", "notebook", "kernel", "inspect", "tasks", "delegate"] as const;
export type ToolName = typeof TOOL_NAMES[number];
export type Mode = "ask" | "plan" | "auto";
export const CATALOGS: Record<Mode, readonly ToolName[]> = {
  ask: ["read", "view", "notebook", "kernel", "inspect", "delegate"],
  plan: ["read", "view", "notebook", "kernel", "inspect", "delegate", "tasks"],
  auto: TOOL_NAMES,
};
export const ACTION_FILTERS: Record<string, Record<Mode, readonly string[]>> = {
  notebook: { ask: ["read_cell"], plan: ["read_cell"], auto: ["read_cell", "update_cell", "insert_cell", "delete_cell", "move_cell", "run_cell", "add_markdown", "clear_output"] },
  kernel: { ask: ["status"], plan: ["status"], auto: ["status", "execute", "interrupt", "restart", "shutdown"] },
  inspect: { ask: ["variables", "variable", "dataframe", "figure", "object"], plan: ["variables", "variable", "dataframe", "figure", "object"], auto: ["variables", "variable", "dataframe", "figure", "object"] },
  tasks: { ask: [], plan: ["get", "replace", "patch"], auto: ["get", "replace", "patch"] },
  delegate: { ask: ["analysis", "research", "review"], plan: ["analysis", "research", "review"], auto: ["analysis", "research", "review", "implementation"] },
};

export interface ToolSessionContext {
  sessionId: string;
  workspaceId: string;
  mode: Mode;
  activeKernelId?: string;
  bridgeEndpoint: string;
  bridgeToken: string;
  tasks(action: string, arguments_: Record<string, unknown>): Promise<Record<string, unknown>>;
  delegate(arguments_: Record<string, unknown>, signal?: AbortSignal, update?: (value: unknown) => void): Promise<Record<string, unknown>>;
  interaction(payload: Record<string, unknown>): void;
}

function actionSchema(tool: ToolName, mode: Mode): TSchema {
  const actions = ACTION_FILTERS[tool]?.[mode];
  if (!actions) return Type.Record(Type.String(), Type.Unknown());
  const actionKey = tool === "delegate" ? "profile" : "action";
  const variants = actions.map((action) => Type.Literal(action));
  const action = variants.length === 1 ? variants[0]! : Type.Union(variants);
  // Keep the request schema flat. Some OpenAI-compatible providers reject
  // TypeBox's Intersect/Record `allOf` projection even though the same shape is
  // valid JSON Schema. Additional operation fields remain explicitly allowed.
  return Type.Object({ [actionKey]: action }, { additionalProperties: true });
}

function result(value: Record<string, unknown>): AgentToolResult<Record<string, unknown>> {
  const summary = typeof value.summary === "string" ? value.summary : JSON.stringify(value);
  if (value.ok === false) throw new Error(summary);
  return { content: [{ type: "text", text: summary }], details: value };
}

async function bridgeCall(context: ToolSessionContext, tool: ToolName, toolCallId: string,
                          arguments_: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
  if (!context.bridgeEndpoint || !context.bridgeToken) throw new Error("Pigent bridge is unavailable");
  const endpoint = `${context.bridgeEndpoint.replace(/\/$/, "")}/tools/${tool}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${context.bridgeToken}` },
    body: JSON.stringify({ context: { protocol_version: "0.1", tool_call_id: toolCallId,
      session_id: context.sessionId, workspace_id: context.workspaceId, mode: context.mode,
      active_kernel_id: context.activeKernelId }, arguments: arguments_ }), signal,
  });
  if (!response.ok) throw new Error(`Pigent bridge returned HTTP ${response.status}`);
  const value = await response.json() as Record<string, any>;
  const interaction = value.error?.details?.interaction;
  if (interaction && typeof interaction === "object") context.interaction({ tool_call_id: toolCallId, ...interaction });
  return value;
}

/** Build only the mode-projected product catalog; Auto is exactly ten definitions. */
export function createToolDefinitions(context: ToolSessionContext): ToolDefinition[] {
  return CATALOGS[context.mode].map((name): ToolDefinition => ({
    name,
    label: name[0]!.toUpperCase() + name.slice(1),
    description: `Pigent ${name} tool`,
    promptSnippet: `${name}: Pipyter-owned ${name} operation`,
    parameters: actionSchema(name, context.mode),
    executionMode: name === "delegate" ? "parallel" : "sequential",
    execute: async (toolCallId, params, signal, onUpdate) => {
      const args = params as Record<string, unknown>;
      if (name === "tasks") return result(await context.tasks(String(args.action), args));
      if (name === "delegate") return result(await context.delegate(args, signal, (partial) =>
        onUpdate?.({ content: [{ type: "text", text: JSON.stringify(partial) }], details: partial as Record<string, unknown> })));
      return result(await bridgeCall(context, name, toolCallId, args, signal));
    },
    renderCall: () => ({}), renderResult: () => ({}),
  }));
}
