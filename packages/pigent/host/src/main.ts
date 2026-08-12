import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@pipyter/pigent-ai/providers/faux";
import {
  AuthStorage, createAgentSessionFromServices, createAgentSessionServices, InMemoryCodingAgentModelsStore,
  ModelRuntime, SessionManager, SettingsManager, type AgentSession,
} from "@pipyter/pigent-runtime";
import { attachJsonlLineReader, serializeJsonLine } from "@pipyter/pigent-runtime";
import { EVENT_TYPES, EventEmitter } from "./events.js";
import { ACTION_FILTERS, CAPABILITIES, CATALOGS, createToolDefinitions, type Mode, PROTOCOL_VERSION, type ToolSessionContext, TOOL_NAMES } from "./tools.js";

const VERSION = "0.3.0";

export const EMOJI_STYLE_GUIDANCE = "Do not use emoji by default. Do not decorate headings or list items with emoji. " +
  "Only when one emoji materially improves clarity may you use it, and never use more than one emoji in the entire response.";

interface StartupConfig {
  version: 1; protocolVersion: "0.2"; workspaceId: string; workspaceRoot: string;
  userConfigDir: string; sessionDir: string; bridgeEndpoint: string;
}
interface HostSession {
  id: string;
  mode: Mode;
  model: { provider: string; model: string };
  runtime: AgentSession;
  events: EventEmitter;
  unsubscribe: () => void;
  setMode: (mode: Mode) => void;
  reloadModel: (provider: string, model: string) => Promise<{ provider: string; model: string }>;
  setContext: (activeDocument?: string, activeKernelId?: string) => void;
  interactions: Map<string, Record<string, unknown>>;
}

function send(value: unknown): void { process.stdout.write(serializeJsonLine(value)); }
function response(id: unknown, value: Record<string, unknown> = {}): void { send({ version: 1, id, ok: true, ...value }); }
function failure(id: unknown, code: string, message: string): void { send({ version: 1, id, ok: false, error: { code, message } }); }
function parseConfig(): StartupConfig {
  const path = process.env.PIGENT_HOST_CONFIG_PATH;
  const raw = path ? readFileSync(path, "utf8") : process.env.PIGENT_HOST_CONFIG;
  if (!raw) throw new Error("PIGENT_HOST_CONFIG_PATH is required");
  const value = JSON.parse(raw) as Partial<StartupConfig>;
  if (value.version !== 1 || value.protocolVersion !== PROTOCOL_VERSION || !value.workspaceId || !value.workspaceRoot ||
      !value.userConfigDir || !value.sessionDir || typeof value.bridgeEndpoint !== "string") throw new Error("invalid Pigent host configuration");
  return value as StartupConfig;
}
function readObject(path: string): Record<string, any> {
  if (!existsSync(path)) throw new Error(`model_configuration_required: missing ${path}`);
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`model_configuration_required: malformed ${path}`);
  return value;
}
function configuredSecret(value: unknown): boolean {
  if (typeof value !== "string" || !value) return false;
  const reference = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(value);
  return reference ? Boolean(process.env[reference[1]!]) : true;
}
function usableAuth(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  if (entry.type === "keyless") return true;
  return configuredSecret(entry.key) || configuredSecret(entry.accessToken) || configuredSecret(entry.refreshToken);
}
function selectedModel(config: StartupConfig): { settings: Record<string, any>; provider: string; model: string } {
  const settingsPath = join(config.userConfigDir, "settings.json");
  const settings = readObject(settingsPath);
  const auth = readObject(join(config.userConfigDir, "auth.json"));
  const provider = settings.defaultProvider, model = settings.defaultModel;
  if (typeof provider !== "string" || !provider || typeof model !== "string" || !model)
    throw new Error("model_configuration_required: settings.json needs defaultProvider/defaultModel");
  const definition = settings.models?.providers?.[provider];
  if (definition && (!Array.isArray(definition.models) || !definition.models.some((item: any) => item?.id === model)))
    throw new Error(`model_configuration_required: unknown ${provider}/${model}`);
  if (provider !== "faux" && !usableAuth(auth[provider]))
    throw new Error(`model_configuration_required: auth.json has no usable ${provider} credential`);
  return { settings, provider, model };
}
export function mapStatus(status: string): string {
  return ({ active: "running", completed: "done" } as Record<string, string>)[status] ?? status;
}
export function publicTasks(snapshot: any): Record<string, unknown> {
  if (!snapshot) return { revision: "0", root: { id: "root", title: "Tasks", status: "pending", children: [] } };
  return { revision: String(snapshot.revision), updated_at: new Date(snapshot.updatedAt).toISOString(),
    root: { id: snapshot.planId, title: snapshot.goal, status: snapshot.tasks.every((x: any) => x.status === "completed") ? "done" : "running",
      children: snapshot.tasks.map((task: any) => ({ id: task.id, title: task.title, status: mapStatus(task.status),
        depends_on: task.dependsOn, completion_criteria: [], children: [] })) } };
}
export function dynamicTasksInput(args: Record<string, any>, snapshot: any): Record<string, unknown> {
  const root = args.root ?? args.snapshot?.root;
  const source = Array.isArray(args.tasks) ? args.tasks : Array.isArray(root?.children) ? root.children : [];
  const status = (value: string): string => ({ running: "active", done: "completed" } as Record<string, string>)[value] ?? value;
  return { version: 1, expectedRevision: Number(args.expected_revision ?? args.expectedRevision ?? snapshot?.revision ?? 0),
    reason: snapshot ? "plan_changed" : "initial_plan", goal: String(args.goal ?? root?.title ?? snapshot?.goal ?? "Tasks"),
    tasks: source.map((item: any) => ({ id: String(item.id), title: String(item.title), status: status(String(item.status ?? "pending")),
      dependsOn: item.depends_on ?? item.dependsOn ?? [], matchHints: item.match_hints ?? item.matchHints ?? [],
      activity: item.activity, blockedBy: item.blocked_by ?? item.blockedBy ?? [] })) };
}

export function mainAgentSystemPrompt(identityPrompt: string): string {
  return `You are Pigent. ${identityPrompt} ${EMOJI_STYLE_GUIDANCE}`;
}

export function agentProfile(id: string, write: boolean) {
  return { id, systemPrompt: `Pigent ${id} sub-agent. Do not delegate. ${EMOJI_STYLE_GUIDANCE}`,
    toolAllowlist: [...(write ? TOOL_NAMES : CATALOGS.ask)].filter((name) => name !== "delegate"),
    allowFileModifications: write, timeoutMs: 600_000 };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  if (args.includes("--version")) { console.log(`Pigent ${VERSION}`); return; }
  const config = parseConfig();
  const bridgeToken = process.env.PIGENT_BRIDGE_TOKEN;
  if (!bridgeToken || bridgeToken.length < 32) throw new Error("PIGENT_BRIDGE_TOKEN is missing or too short");
  const sessions = new Map<string, HostSession>();
  let shuttingDown = false;

  const createSession = async (record: any): Promise<HostSession> => {
    if (!record || typeof record.id !== "string" || !["ask", "plan", "auto"].includes(record.mode) || record.mode === "pilot")
      throw new Error("invalid session or mode");
    const chosen = selectedModel(config);
    const settingsPath = join(config.userConfigDir, "settings.json"), authPath = join(config.userConfigDir, "auth.json");
    const readOnlyAuth = AuthStorage.fromStorage({
      withLock: (fn) => fn(readFileSync(authPath, "utf8")).result,
      withLockAsync: async (fn) => (await fn(readFileSync(authPath, "utf8"))).result,
    });
    const modelRuntime = await ModelRuntime.create({ settingsPath, authPath, credentials: readOnlyAuth,
      modelsStore: new InMemoryCodingAgentModelsStore(), allowModelNetwork: false });
    let model;
    if (chosen.provider === "faux") {
      const faux = fauxProvider({ api: "faux", provider: "faux", models: [{ id: chosen.model, name: chosen.model }] });
      let scripted: Array<{ tool: string; arguments?: Record<string, unknown> }> = [];
      if (process.env.PIGENT_FAUX_SCRIPT) {
        const parsed = JSON.parse(process.env.PIGENT_FAUX_SCRIPT);
        if (Array.isArray(parsed)) scripted = parsed;
      }
      faux.setResponses([
        ...scripted.map((step, index) => fauxAssistantMessage(fauxToolCall(step.tool, step.arguments ?? {}, { id: `faux-${index + 1}` }), { stopReason: "toolUse" })),
        fauxAssistantMessage("Pigent faux response."),
      ]);
      modelRuntime.registerNativeProvider(faux.provider); await modelRuntime.refresh({ allowNetwork: false }); model = faux.getModel();
    } else { await modelRuntime.refresh({ allowNetwork: false }); model = modelRuntime.getModel(chosen.provider, chosen.model); }
    if (!model) throw new Error(`model_configuration_required: unknown ${chosen.provider}/${chosen.model}`);
    const settingsManager = SettingsManager.inMemory({ defaultProvider: chosen.provider, defaultModel: chosen.model });
    const identity = record.execution_identity && typeof record.execution_identity === "object" ? record.execution_identity : {};
    const identityPrompt = `Execution identity (authoritative): username=${String(identity.username ?? "unknown")}, ` +
      `uid=${String(identity.uid ?? "unknown")}, home=${String(identity.home ?? "unknown")}, workspace=${String(identity.workspace ?? config.workspaceRoot)}.`;
    const sessionWorkspace = typeof identity.workspace === "string" && identity.workspace ? identity.workspace : config.workspaceRoot;
    const services = await createAgentSessionServices({ cwd: sessionWorkspace, agentDir: config.userConfigDir,
      settingsManager, modelRuntime, resourceLoaderOptions: { skills: false, systemPrompt: mainAgentSystemPrompt(identityPrompt) } as any });
    let runtime!: AgentSession;
    const eventEmitter = new EventEmitter(record.id, (event) => send({ version: 1, kind: "event", event }));
    const context: ToolSessionContext = { sessionId: record.id, workspaceId: config.workspaceId, mode: record.mode as Mode,
      activeDocument: record.active_document?.path ?? record.active_document, activeKernelId: record.active_kernel_id,
      bridgeEndpoint: config.bridgeEndpoint, bridgeToken,
      tasks: async (action: string, args_: Record<string, any>) => {
        const dynamic = runtime.dynamicTaskRuntime!;
        if (action === "get") return { ok: true, summary: "Tasks snapshot", data: { snapshot: publicTasks(dynamic.getSnapshot()) } };
        const current = dynamic.getSnapshot();
        const merged = action === "patch" && current ? { ...args_, goal: current.goal,
          tasks: current.tasks.map((task: any) => ({ ...task, ...(Array.isArray(args_.updates) ? args_.updates.find((u: any) => u.id === task.id) : {}) })) } : args_;
        const mutation = await dynamic.updatePlan(dynamicTasksInput(merged, current));
        const snapshot = publicTasks(mutation.snapshot);
        eventEmitter.emit("tasks.snapshot", { snapshot });
        return { ok: mutation.status === "accepted" || mutation.status === "no_change", summary: `Tasks ${mutation.status}`,
          data: { status: mutation.status, snapshot }, error: mutation.status === "revision_conflict" ?
            { code: "revision_conflict", message: "Tasks revision conflict", retryable: true } : undefined };
      },
      interaction: (payload: Record<string, unknown>) => {
        const interactionId = typeof payload.interaction_id === "string" ? payload.interaction_id : `interaction_${Date.now()}`;
        const interaction = { version: 1, interaction_id: interactionId, session_id: record.id, revision: 1, ...payload };
        hostSession?.interactions.set(interactionId, interaction);
        eventEmitter.emit("interaction.required", { interaction, revision: 1 });
      },
      delegate: async (args_: Record<string, any>, signal?: AbortSignal, update?: (value: unknown) => void) => {
        const profile = String(args_.profile ?? "analysis");
        if (!["analysis", "research", "review", "implementation"].includes(profile)) throw new Error("invalid delegate profile");
        eventEmitter.emit("delegate.start", { profile });
        const result = await runtime.agentPool!.delegateTask({ task: String(args_.task ?? ""), profile,
          budget: typeof args_.budget === "object" ? args_.budget : undefined }, signal, (progress) => {
            eventEmitter.emit("delegate.update", { profile, progress }); update?.(progress);
          });
        eventEmitter.emit("delegate.end", { profile, result });
        return { ok: result.status === "completed", summary: result.summary, data: { result } };
      } };
    const customTools = createToolDefinitions(context);
    const created = await createAgentSessionFromServices({ services, sessionManager: SessionManager.create(sessionWorkspace, config.sessionDir),
      model, thinkingLevel: chosen.settings.defaultThinkingLevel ?? "medium", customTools, tools: [...CATALOGS[record.mode as Mode]],
      agentPool: { maxConcurrency: 4, defaultProfile: "analysis", profiles: [agentProfile("analysis", false), agentProfile("research", false),
        agentProfile("review", false), agentProfile("implementation", true)] } });
    runtime = created.session;
    const unsubscribe = runtime.subscribe((event) => eventEmitter.translate(event));
    let hostSession!: HostSession;
    hostSession = {
      id: record.id,
      mode: record.mode,
      model: { provider: chosen.provider, model: chosen.model },
      runtime,
      events: eventEmitter,
      unsubscribe,
      setMode: (mode: Mode) => { context.mode = mode; runtime.replaceToolDefinitions(createToolDefinitions(context)); },
      reloadModel: async (provider: string, modelId: string) => {
        const next = selectedModel(config);
        if (next.provider !== provider || next.model !== modelId)
          throw new Error("model_configuration_required: selected model changed concurrently");
        await modelRuntime.refresh({ allowNetwork: false });
        const selected = modelRuntime.getModel(next.provider, next.model);
        if (!selected) throw new Error(`model_configuration_required: unknown ${next.provider}/${next.model}`);
        runtime.setModel(selected);
        hostSession.model = { provider: next.provider, model: next.model };
        return hostSession.model;
      },
      interactions: new Map(),
      setContext: (activeDocument?: string, activeKernelId?: string) => {
        context.activeDocument = activeDocument || undefined;
        context.activeKernelId = activeKernelId || undefined;
        runtime.replaceToolDefinitions(createToolDefinitions(context));
      },
    };
    sessions.set(record.id, hostSession);
    return hostSession;
  };

  const handle = async (command: any): Promise<void> => {
    const id = command?.id;
    try {
      switch (command?.command) {
        case "handshake": response(id, { protocol_version: PROTOCOL_VERSION, runtime_version: VERSION,
          tool_protocol_version: PROTOCOL_VERSION, tools: TOOL_NAMES, modes: CATALOGS,
          action_filters: ACTION_FILTERS, capabilities: CAPABILITIES, event_types: EVENT_TYPES }); return;
        case "create_session": { const item = await createSession(command.session); response(id, { session_id: command.session.id, model: item.model }); return; }
        case "delete_session": { const item = sessions.get(command.session_id); item?.unsubscribe(); item?.runtime.dispose(); sessions.delete(command.session_id); response(id); return; }
        case "prompt": case "follow_up": { const item = sessions.get(command.session_id); if (!item) throw new Error("session not found");
          item.events.queueCorrelation({ client_message_id: command.client_message_id, run_id: command.run_id, turn_id: command.turn_id });
          response(id, { accepted: true, client_message_id: command.client_message_id, run_id: command.run_id, turn_id: command.turn_id });
          item.events.emit("session.updated", { client_message_id: command.client_message_id, run_id: command.run_id, turn_id: command.turn_id, run_active: true });
          void item.runtime.prompt(String(command.text ?? ""), command.command === "follow_up" ? { streamingBehavior: "followUp" } : {}).catch((error) => item.events.emit("error", { code: "internal_error", message: String(error), run_id: command.run_id, turn_id: command.turn_id })); return; }
        case "abort": { const item = sessions.get(command.session_id); if (!item) throw new Error("session not found"); await item.runtime.abort(); item.events.emit("aborted", { run_id: command.run_id, reason: command.reason ?? "user_stop" }); response(id, { accepted: true }); return; }
        case "interaction_resolve": { const item = sessions.get(command.session_id); if (!item) throw new Error("session not found");
          const interaction = item.interactions.get(String(command.interaction_id));
          if (!interaction || interaction.revision !== command.revision) throw new Error("interaction_superseded");
          const choices = Array.isArray(interaction.choices) ? interaction.choices : [];
          if (!choices.includes(command.action_id)) throw new Error("invalid interaction action");
          item.interactions.delete(String(command.interaction_id));
          const receipt = { outcome: "success", summary: `Interaction resolved: ${String(command.action_id)}`, identifiers: { interaction_id: String(command.interaction_id), decision_id: String(command.decision_id) }, at: new Date().toISOString() };
          item.events.emit("interaction.resolved", { interaction_id: command.interaction_id, decision_id: command.decision_id, action_id: command.action_id, receipt });
          response(id, { receipt }); return; }
        case "mode_change": { if (!["ask", "plan", "auto"].includes(command.mode) || command.mode === "pilot") throw new Error("invalid mode");
          const old = sessions.get(command.session_id); if (!old) throw new Error("session not found"); old.mode = command.mode; old.setMode(command.mode as Mode); old.events.emit("mode.changed", { mode: command.mode, tools: CATALOGS[command.mode as Mode], actions: ACTION_FILTERS }); response(id); return; }
        case "model_change": { const item = sessions.get(command.session_id); if (!item) throw new Error("session not found");
          const model = await item.reloadModel(String(command.provider ?? ""), String(command.model ?? "")); response(id, { model }); return; }
        case "context_change": { const item = sessions.get(command.session_id); if (!item) throw new Error("session not found");
          item.setContext(typeof command.active_document === "string" ? command.active_document : undefined,
            typeof command.active_kernel_id === "string" ? command.active_kernel_id : undefined); response(id); return; }
        case "reconnect": { const item = sessions.get(command.session_id); if (!item) throw new Error("session not found"); item.events.emit("reconnect.cursor", { mode: item.mode, model: item.model, tasks: publicTasks(item.runtime.dynamicTaskRuntime?.getSnapshot()) }); response(id); return; }
        case "shutdown": shuttingDown = true; for (const item of sessions.values()) { item.unsubscribe(); item.runtime.dispose(); } response(id); setImmediate(() => process.exit(0)); return;
        default: failure(id, "invalid_request", "unknown command");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failure(id, message.includes("model_configuration_required") ? "model_configuration_required" : "invalid_request", message);
    }
  };
  attachJsonlLineReader(process.stdin, (line) => {
    if (!line.trim()) return;
    let command: unknown; try { command = JSON.parse(line); } catch { send({ version: 1, ok: false, error: { code: "invalid_request", message: "malformed JSONL" } }); return; }
    void handle(command);
  });
  process.stdin.resume();
  send({ version: 1, kind: "host_event", event: { version: 1, type: "pigent.ready", timestamp: new Date().toISOString(),
    payload: { protocol_version: PROTOCOL_VERSION, runtime_version: VERSION, tool_protocol_version: PROTOCOL_VERSION,
      tools: TOOL_NAMES, capabilities: CAPABILITIES, commands: ["jsonl", "prompt", "follow_up", "abort", "mode_change", "model_change", "context_change", "reconnect", "shutdown"] } } });
  if (shuttingDown) process.exit(0);
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
