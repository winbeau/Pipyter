import type { AgentToolResult } from "@pipyter/pigent-agent";
import { type ToolDefinition } from "@pipyter/pigent-runtime";
import { Type, type TSchema } from "typebox";

export const PROTOCOL_VERSION = "0.2" as const;
export const CAPABILITIES = ["filesystem.read", "filesystem.write", "visual.read", "notebook.read", "notebook.write", "kernel.status", "kernel.inspect", "kernel.execute", "process.execute", "process.interactive", "network", "system.execute", "tasks.write", "delegate.read", "delegate.write", "kernel.environment.read", "kernel.environment.manage"] as const;

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
  kernel: {
    ask: ["status", "list_environments", "operation_status"],
    plan: ["status", "list_environments", "operation_status"],
    auto: ["status", "execute", "interrupt", "restart", "shutdown", "list_environments", "operation_status", "create_temporary", "create_maintained", "sync_environment", "start_environment", "promote_environment", "delete_environment"],
  },
  inspect: { ask: ["variables", "variable", "dataframe", "figure", "object"], plan: ["variables", "variable", "dataframe", "figure", "object"], auto: ["variables", "variable", "dataframe", "figure", "object"] },
  tasks: { ask: [], plan: ["get", "replace", "patch"], auto: ["get", "replace", "patch"] },
  delegate: { ask: ["analysis", "research", "review"], plan: ["analysis", "research", "review"], auto: ["analysis", "research", "review", "implementation"] },
};

export interface ToolSessionContext {
  sessionId: string;
  workspaceId: string;
  mode: Mode;
  activeDocument?: string;
  activeKernelId?: string;
  bridgeEndpoint: string;
  bridgeToken: string;
  tasks(action: string, arguments_: Record<string, unknown>): Promise<Record<string, unknown>>;
  delegate(arguments_: Record<string, unknown>, signal?: AbortSignal, update?: (value: unknown) => void): Promise<Record<string, unknown>>;
  interaction(payload: Record<string, unknown>): void;
}

function actionType(tool: ToolName, mode: Mode): TSchema | undefined {
  const actions = ACTION_FILTERS[tool]?.[mode];
  if (!actions?.length) return undefined;
  const variants = actions.map((action) => Type.Literal(action));
  return variants.length === 1 ? variants[0]! : Type.Union(variants);
}

const revision = Type.String({ description: "Opaque sha256 revision returned by the previous read or mutation." });
const position = Type.Object({
  kind: Type.Union([Type.Literal("start"), Type.Literal("end"), Type.Literal("before"), Type.Literal("after")]),
  cell_id: Type.Optional(Type.String({ description: "Required when position.kind is before or after." })),
}, { additionalProperties: false });

function toolSchema(tool: ToolName, mode: Mode, activeDocument?: string): TSchema {
  const action = actionType(tool, mode);
  switch (tool) {
    case "read":
      return Type.Object({
        path: Type.String({ description: "File or directory path. Relative paths resolve from the Workspace." }),
        offset: Type.Optional(Type.Integer({ minimum: 1 })),
        limit: Type.Optional(Type.Integer({ minimum: 1 })),
        depth: Type.Optional(Type.Integer({ minimum: 1, maximum: 3 })),
      }, { additionalProperties: false });
    case "view":
      return Type.Object({
        source: Type.Object({
          kind: Type.Union([Type.Literal("file"), Type.Literal("artifact"), Type.Literal("figure")]),
          path: Type.Optional(Type.String()),
          artifact_id: Type.Optional(Type.String()),
          figure_id: Type.Optional(Type.String()),
        }, { additionalProperties: false }),
      }, { additionalProperties: false });
    case "write":
      return Type.Object({
        path: Type.String(),
        content: Type.String(),
        expected_revision: Type.Optional(Type.Union([revision, Type.Null()])),
      }, { additionalProperties: false });
    case "update":
      return Type.Object({
        path: Type.String(),
        strategy: Type.Union([Type.Literal("replace"), Type.Literal("patch")]),
        expected_revision: Type.Optional(revision),
        edits: Type.Optional(Type.Array(Type.Object({ old_text: Type.String(), new_text: Type.String() }, { additionalProperties: false }))),
        patch: Type.Optional(Type.String()),
      }, { additionalProperties: false });
    case "bash":
      return Type.Object({
        command: Type.String(),
        cwd: Type.Optional(Type.String({ description: "Working directory; defaults to the Workspace." })),
        timeout: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
        interactive: Type.Optional(Type.Boolean()),
      }, { additionalProperties: false });
    case "notebook":
      return Type.Object({
        action: action!,
        path: Type.Optional(Type.String({
          description: activeDocument
            ? `Notebook path. Omit to use the active notebook: ${activeDocument}`
            : "Notebook path ending in .ipynb.",
        })),
        cell_id: Type.Optional(Type.String()),
        include_outputs: Type.Optional(Type.Boolean()),
        expected_revision: Type.Optional(revision),
        source: Type.Optional(Type.String()),
        cell_type: Type.Optional(Type.Union([Type.Literal("code"), Type.Literal("markdown"), Type.Literal("raw")])),
        metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
        clear_outputs: Type.Optional(Type.Boolean()),
        position: Type.Optional(position),
        scope: Type.Optional(Type.Literal("all")),
        timeout: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
        save_outputs: Type.Optional(Type.Boolean()),
      }, { additionalProperties: false });
    case "kernel":
      return Type.Object({
        action: action!,
        code: Type.Optional(Type.String({ description: "Scratch code for action=execute only; it does not update notebook cells." })),
        timeout: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
        store_history: Type.Optional(Type.Boolean()),
        operation_id: Type.Optional(Type.String()),
        environment_id: Type.Optional(Type.String()),
        python: Type.Optional(Type.String()),
        packages: Type.Optional(Type.Array(Type.String(), { maxItems: 100 })),
        ttl_seconds: Type.Optional(Type.Integer({ minimum: 900, maximum: 604800 })),
        name: Type.Optional(Type.String()),
        display_name: Type.Optional(Type.String()),
        source: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
        expected_revision: Type.Optional(Type.String()),
        notebook_path: Type.Optional(Type.String()),
        confirm_shutdown: Type.Optional(Type.Boolean()),
        confirmed: Type.Optional(Type.Boolean()),
      }, { additionalProperties: false });
    case "inspect":
      return Type.Object({
        action: action!,
        name: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1 })),
        rows: Type.Optional(Type.Integer({ minimum: 1 })),
        columns: Type.Optional(Type.Integer({ minimum: 1 })),
        format: Type.Optional(Type.Union([Type.Literal("png"), Type.Literal("svg")])),
      }, { additionalProperties: false });
    case "tasks":
      return Type.Object({
        action: action!,
        expected_revision: Type.Optional(Type.Union([Type.String(), Type.Number()])),
        revision: Type.Optional(Type.Union([Type.String(), Type.Number()])),
        root: Type.Optional(Type.Unknown()),
        patch: Type.Optional(Type.Unknown()),
      }, { additionalProperties: true });
    case "delegate":
      return Type.Object({
        profile: action!,
        task: Type.String(),
        timeout: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
      }, { additionalProperties: true });
  }
}

function toolGuidance(tool: ToolName, context: ToolSessionContext): string {
  switch (tool) {
    case "notebook": {
      const active = context.activeDocument ? ` The active notebook is ${context.activeDocument}; omit path to use it.` : " No active notebook is currently bound; provide path.";
      return "Read and mutate nbformat cells through stable cell IDs. Call read_cell first and use data.revision as expected_revision. "
        + "insert_cell requires source, cell_type, position, and expected_revision; it returns the generated cell_id and new revision. "
        + "run_cell requires that cell_id and the latest revision, executes the persisted source in the bound kernel, and saves outputs. "
        + "Never rewrite or probe .ipynb files through kernel, write, update, or bash when notebook can perform the operation." + active;
    }
    case "kernel":
      return "Operate the currently bound Jupyter kernel or Pipyter-private Kernel environments. list_environments and operation_status are read-only in all modes. Environment create/sync/promote/delete return accepted operation references immediately; inspect operation_status before starting unfinished environments. Use environment_id only for Pipyter-private environments and never infer a global kernelspec name.";
    case "read":
      return "Read one text file or bounded directory listing. Use notebook.read_cell instead of parsing .ipynb JSON.";
    case "write":
    case "update":
      return `${tool} edits normal text files. Use notebook for every .ipynb mutation.`;
    case "bash":
      return "Run a non-interactive command as the Pipyter Runtime OS user. Do not use it to bypass notebook operations or print credentials.";
    default:
      return `${tool}: Pipyter-owned ${tool} operation.`;
  }
}

function sanitize(value: unknown, depth = 0, key = ""): unknown {
  if (depth > 6) return "[truncated]";
  if (/^(?:api[_-]?key|token|secret|password|authorization|credential)$/i.test(key)) return "[redacted]";
  if (typeof value === "string") {
    if (key === "data_url" || key.startsWith("image/")) return `[binary payload omitted: ${value.length} chars]`;
    return value.length > 4_000 ? `${value.slice(0, 4_000)}…[truncated ${value.length - 4_000} chars]` : value;
  }
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
      if (childKey === "artifacts" && Array.isArray(child) && child.length === 0) continue;
      output[childKey] = sanitize(child, depth + 1, childKey);
    }
    return output;
  }
  return value;
}

function modelText(value: Record<string, unknown>): string {
  const visible = sanitize({
    summary: value.summary,
    data: value.data,
    revisions: value.revisions,
    error: value.error,
    warnings: value.warnings,
  });
  const text = JSON.stringify(visible);
  return text.length > 16_000 ? `${text.slice(0, 16_000)}…[tool result truncated]` : text;
}

function result(value: Record<string, unknown>): AgentToolResult<Record<string, unknown>> {
  const text = modelText(value);
  if (value.ok === false) {
    const error = value.error as Record<string, unknown> | undefined;
    const code = typeof error?.code === "string" ? error.code : "tool_failed";
    const failure = new Error(text) as Error & { code?: string };
    failure.code = code;
    throw failure;
  }
  return { content: [{ type: "text", text }], details: value };
}

async function bridgeCall(context: ToolSessionContext, tool: ToolName, toolCallId: string,
                          arguments_: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
  if (!context.bridgeEndpoint || !context.bridgeToken) throw new Error("Pigent bridge is unavailable");
  const endpoint = `${context.bridgeEndpoint.replace(/\/$/, "")}/tools/${tool}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${context.bridgeToken}` },
    body: JSON.stringify({ context: { protocol_version: PROTOCOL_VERSION, tool_call_id: toolCallId,
      session_id: context.sessionId, workspace_id: context.workspaceId, mode: context.mode,
      active_document: context.activeDocument ? { path: context.activeDocument } : undefined,
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
  return CATALOGS[context.mode].map((name): ToolDefinition => {
    const guidance = toolGuidance(name, context);
    return {
      name,
      label: name[0]!.toUpperCase() + name.slice(1),
      description: guidance,
      promptSnippet: guidance,
      parameters: toolSchema(name, context.mode, context.activeDocument),
      executionMode: name === "delegate" ? "parallel" : "sequential",
      execute: async (toolCallId, params, signal, onUpdate) => {
        const args = { ...(params as Record<string, unknown>) };
        if (name === "notebook" && !args.path && context.activeDocument) args.path = context.activeDocument;
        if (name === "tasks") return result(await context.tasks(String(args.action), args));
        if (name === "delegate") return result(await context.delegate(args, signal, (partial) =>
          onUpdate?.({ content: [{ type: "text", text: JSON.stringify(sanitize(partial)) }], details: partial as Record<string, unknown> })));
        return result(await bridgeCall(context, name, toolCallId, args, signal));
      },
      renderCall: () => ({}), renderResult: () => ({}),
    };
  });
}
