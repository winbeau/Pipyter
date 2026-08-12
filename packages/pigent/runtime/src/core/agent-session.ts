import type { Agent, AgentEvent, AgentMessage, AgentState, ThinkingLevel } from "@pipyter/pigent-agent";
import { contentText, type ImageContent, type Model } from "@pipyter/pigent-ai";
import type { AgentPool } from "./agents/agent-pool.ts";
import { ExtensionRunner, type ReplacedSessionContext, type SessionStartEvent, type ToolDefinition } from "./extensions/index.ts";
import { ModelRegistry } from "./model-registry.ts";
import type { ModelRuntime } from "./model-runtime.ts";
import type { ResourceLoader } from "./resource-loader.ts";
import type { SessionEntry, SessionManager } from "./session-manager.ts";
import type { SettingsManager } from "./settings-manager.ts";
import { DynamicTaskRuntime } from "./tasks/dynamic-task-runtime.ts";
import { createTasksUpdateToolDefinition } from "./tasks/tools.ts";
import { TaskLedger } from "./state/task-ledger.ts";
import { wrapToolDefinitions } from "./tools/tool-definition-wrapper.ts";

export type AgentSessionEvent =
	| Exclude<AgentEvent, { type: "agent_end" }>
	| { type: "agent_end"; messages: AgentMessage[]; willRetry: false }
	| { type: "agent_settled" }
	| { type: "entry_appended"; entry: SessionEntry }
	| { type: "thinking_level_changed"; level: ThinkingLevel };
export type AgentSessionEventListener = (event: AgentSessionEvent) => void;

export interface PromptOptions {
	images?: ImageContent[];
	streamingBehavior?: "steer" | "followUp";
	resolveDocumentContract?: boolean;
	preflightResult?: (success: boolean) => void;
}

export interface SessionStats {
	sessionFile: string | undefined;
	sessionId: string;
	userMessages: number;
	assistantMessages: number;
	toolCalls: number;
	toolResults: number;
	totalMessages: number;
	tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
	cost: number;
}

export interface AgentSessionConfig {
	agent: Agent;
	sessionManager: SessionManager;
	settingsManager: SettingsManager;
	cwd: string;
	resourceLoader: ResourceLoader;
	modelRuntime: ModelRuntime;
	customTools?: ToolDefinition[];
	agentPool?: AgentPool;
	dynamicTasksEnabled?: boolean;
	dynamicTaskRuntime?: DynamicTaskRuntime;
	scopedModels?: Array<{ model: Model<any>; thinkingLevel?: ThinkingLevel }>;
	extensionRunnerRef?: { current?: ExtensionRunner };
	sessionStartEvent?: SessionStartEvent;
	initialActiveToolNames?: string[];
	allowedToolNames?: string[];
	excludedToolNames?: string[];
}

/** Productized Pigent session core with persistence, tools, Dynamic Tasks, delegation, and event forwarding. */
export class AgentSession {
	readonly agent: Agent;
	readonly sessionManager: SessionManager;
	readonly settingsManager: SettingsManager;
	readonly taskLedger: TaskLedger;
	readonly dynamicTaskRuntime?: DynamicTaskRuntime;
	readonly extensionRunner: ExtensionRunner;
	readonly cwd: string;
	private readonly listeners = new Set<AgentSessionEventListener>();
	private readonly unsubscribeAgent: () => void;
	private disposed = false;
	private readonly modelRuntimeValue: ModelRuntime;
	private readonly agentPoolValue?: AgentPool;
	private readonly resourceLoader: ResourceLoader;

	constructor(config: AgentSessionConfig) {
		this.agent = config.agent;
		this.sessionManager = config.sessionManager;
		this.settingsManager = config.settingsManager;
		this.cwd = config.cwd;
		this.modelRuntimeValue = config.modelRuntime;
		this.agentPoolValue = config.agentPool;
		this.resourceLoader = config.resourceLoader;
		this.taskLedger = new TaskLedger({ taskId: config.sessionManager.getSessionId(), cwd: config.cwd, entries: config.sessionManager.getBranch() });
		this.dynamicTaskRuntime = config.dynamicTasksEnabled === false
			? undefined
			: (config.dynamicTaskRuntime ?? new DynamicTaskRuntime({ sessionManager: config.sessionManager }));
		this.dynamicTaskRuntime?.subscribe((plan) => this.taskLedger.setDynamicTaskPlan(plan));

		const extensionResult = config.resourceLoader.getExtensions();
		this.extensionRunner = new ExtensionRunner(
			extensionResult.extensions,
			extensionResult.runtime,
			config.cwd,
			config.sessionManager,
			new ModelRegistry(config.modelRuntime),
		);
		if (config.extensionRunnerRef) config.extensionRunnerRef.current = this.extensionRunner;

		const excluded = new Set(config.excludedToolNames ?? []);
		const allowed = config.allowedToolNames ? new Set(config.allowedToolNames) : undefined;
		const definitions = [...(config.customTools ?? [])];
		if (config.agentPool) definitions.push(config.agentPool.delegateTaskTool);
		if (this.dynamicTaskRuntime) definitions.push(createTasksUpdateToolDefinition(this.dynamicTaskRuntime) as ToolDefinition<any, any>);
		const unique = new Map(definitions.map((tool) => [tool.name, tool]));
		const active = [...unique.values()].filter((tool) => !excluded.has(tool.name) && (!allowed || allowed.has(tool.name)));
		this.agent.state.tools = wrapToolDefinitions(active);
		this.agent.state.systemPrompt = this.buildSystemPrompt(config.resourceLoader, active);
		this.unsubscribeAgent = this.agent.subscribe((event) => this.handleAgentEvent(event));
	}

	private buildSystemPrompt(loader: ResourceLoader, tools: readonly ToolDefinition[]): string {
		const custom = loader.getSystemPrompt() ?? "You are Pigent, Pipyter's embedded coding agent runtime.";
		const context = loader.getAgentsFiles().agentsFiles;
		const contextText = context.length
			? `\n\n<project_context>\n${context.map((item) => `<project_instructions path="${item.path}">\n${item.content}\n</project_instructions>`).join("\n")}\n</project_context>`
			: "";
		const append = loader.getAppendSystemPrompt();
		const toolText = tools.length ? `\n\nAvailable tools: ${tools.map((tool) => tool.name).join(", ")}` : "";
		const guidance = tools.map((tool) => tool.promptSnippet).filter((value): value is string => Boolean(value));
		const guidanceText = guidance.length ? `\n\nTool usage:\n${guidance.map((value) => `- ${value}`).join("\n")}` : "";
		return `${custom}${toolText}${guidanceText}${contextText}${append.length ? `\n\n${append.join("\n\n")}` : ""}`;
	}

	private async handleAgentEvent(event: AgentEvent): Promise<void> {
		if (this.disposed) return;
		const ledger = this.taskLedger.handleAgentEvent(event);
		if (event.type === "message_end" && (event.message.role === "user" || event.message.role === "assistant" || event.message.role === "toolResult" || event.message.role === "custom" || event.message.role === "bashExecution")) {
			this.sessionManager.appendMessage(event.message);
		}
		if (event.type === "tool_execution_end" && ledger && event.result && typeof event.result === "object") {
			(event.result as { details?: unknown }).details = { ...((event.result as { details?: object }).details ?? {}), taskLedger: ledger };
		}
		if (event.type === "agent_end") {
			this.emit({ type: "agent_end", messages: event.messages, willRetry: false });
			this.emit({ type: "agent_settled" });
			return;
		}
		this.emit(event);
	}

	private emit(event: AgentSessionEvent): void {
		for (const listener of this.listeners) listener(event);
	}

	get modelRuntime(): ModelRuntime { return this.modelRuntimeValue; }
	get agentPool(): AgentPool | undefined { return this.agentPoolValue; }
	get state(): AgentState { return this.agent.state; }
	get messages(): AgentMessage[] { return this.agent.state.messages; }
	get model(): Model<any> { return this.agent.state.model; }
	get thinkingLevel(): ThinkingLevel { return this.agent.state.thinkingLevel; }
	get isStreaming(): boolean { return this.agent.state.isStreaming; }
	get sessionFile(): string | undefined { return this.sessionManager.getSessionFile(); }
	get sessionId(): string { return this.sessionManager.getSessionId(); }
	get pendingMessageCount(): number { return this.agent.hasQueuedMessages() ? 1 : 0; }

	subscribe(listener: AgentSessionEventListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

	async prompt(text: string, options: PromptOptions = {}): Promise<void> {
		options.preflightResult?.(true);
		if (this.isStreaming) {
			const message: AgentMessage = { role: "user", content: [{ type: "text", text }, ...(options.images ?? [])], timestamp: Date.now() };
			if (options.streamingBehavior === "steer") this.agent.steer(message);
			else if (options.streamingBehavior === "followUp") this.agent.followUp(message);
			else throw new Error("streamingBehavior is required while the session is streaming");
			return;
		}
		await this.agent.prompt(text, options.images);
	}

	async abort(): Promise<void> { this.agent.abort(); await this.agent.waitForIdle(); }
	abortBash(): void { this.agent.abort(); }
	async waitForIdle(): Promise<void> { await this.agent.waitForIdle(); }
	initializeDocumentRuntime(): Promise<void> { return Promise.resolve(); }
	initializeMonitorRuntime(): Promise<void> { return Promise.resolve(); }

	getLastAssistantText(): string | undefined {
		for (let index = this.messages.length - 1; index >= 0; index--) {
			const message = this.messages[index];
			if (message?.role === "assistant") return contentText(message.content);
		}
		return undefined;
	}

	getSessionStats(): SessionStats {
		let userMessages = 0, assistantMessages = 0, toolResults = 0, toolCalls = 0;
		let input = 0, output = 0, cacheRead = 0, cacheWrite = 0, cost = 0;
		for (const message of this.messages) {
			if (message.role === "user") userMessages++;
			if (message.role === "toolResult") toolResults++;
			if (message.role === "assistant") {
				assistantMessages++;
				toolCalls += message.content.filter((part) => part.type === "toolCall").length;
				input += message.usage.input; output += message.usage.output; cacheRead += message.usage.cacheRead; cacheWrite += message.usage.cacheWrite; cost += message.usage.cost.total;
			}
		}
		return { sessionFile: this.sessionFile, sessionId: this.sessionId, userMessages, assistantMessages, toolCalls, toolResults, totalMessages: this.messages.length, tokens: { input, output, cacheRead, cacheWrite, total: input + output + cacheRead + cacheWrite }, cost };
	}

	/** Replace the host-owned projected tool catalog without creating a second session. */
	replaceToolDefinitions(definitions: readonly ToolDefinition[]): void {
		this.agent.state.tools = wrapToolDefinitions([...definitions]);
		this.agent.state.systemPrompt = this.buildSystemPrompt(this.resourceLoader, definitions);
	}

	setModel(model: Model<any>): void { this.agent.state.model = model; this.sessionManager.appendModelChange(model.provider, model.id); }
	setThinkingLevel(level: ThinkingLevel): void { this.agent.state.thinkingLevel = level; this.sessionManager.appendThinkingLevelChange(level); this.emit({ type: "thinking_level_changed", level }); }

	createReplacedSessionContext(): ReplacedSessionContext {
		return {
			sendMessage: async (message) => { this.sessionManager.appendCustomMessageEntry(message.customType, message.content, message.display, message.details); },
			sendUserMessage: async (content, options) => {
				const message: AgentMessage = { role: "user", content: typeof content === "string" ? content : content, timestamp: Date.now() };
				if (options?.deliverAs === "steer") this.agent.steer(message); else this.agent.followUp(message);
			},
		} as ReplacedSessionContext;
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.unsubscribeAgent();
		this.agent.abort();
		this.agentPoolValue?.dispose();
		this.listeners.clear();
	}
}
