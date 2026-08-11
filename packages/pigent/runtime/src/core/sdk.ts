import { join } from "node:path";
import { Agent, type AgentMessage, setDefaultStreamFn, type ThinkingLevel } from "@pipyter/pigent-agent";
import type { ImageContent, Message, Model, TextContent } from "@pipyter/pigent-ai";
import { clampThinkingLevel, streamSimple } from "@pipyter/pigent-ai/compat";
import { getAgentDir } from "../config.ts";
import { resolvePath } from "../utils/paths.ts";
import { AgentSession } from "./agent-session.ts";
import { AgentPool } from "./agents/agent-pool.ts";
import type { AgentPoolConfig } from "./agents/agent-profile.ts";
import type { LoadExtensionsResult, SessionStartEvent, ToolDefinition } from "./extensions/index.ts";
import { convertToLlm } from "./messages.ts";
import { ModelRuntime } from "./model-runtime.ts";
import type { PolicyRuntime } from "./policy/index.ts";
import { DefaultResourceLoader, type ResourceLoader } from "./resource-loader.ts";
import { getDefaultSessionDir, SessionManager } from "./session-manager.ts";
import { SettingsManager } from "./settings-manager.ts";

setDefaultStreamFn(streamSimple);

export interface CreateAgentSessionOptions {
	cwd?: string;
	agentDir?: string;
	modelRuntime?: ModelRuntime;
	model?: Model<any>;
	thinkingLevel?: ThinkingLevel;
	scopedModels?: Array<{ model: Model<any>; thinkingLevel?: ThinkingLevel }>;
	noTools?: "all" | "builtin";
	tools?: string[];
	excludeTools?: string[];
	customTools?: ToolDefinition[];
	resourceLoader?: ResourceLoader;
	sessionManager?: SessionManager;
	settingsManager?: SettingsManager;
	sessionStartEvent?: SessionStartEvent;
	policyRuntime?: PolicyRuntime;
	agentPool?: AgentPoolConfig | false;
	dynamicTasks?: boolean;
}

export interface CreateAgentSessionResult {
	session: AgentSession;
	extensionsResult: LoadExtensionsResult;
	modelFallbackMessage?: string;
}

export * from "./agent-session-runtime.ts";
export type { ToolDefinition, SessionStartEvent } from "./extensions/index.ts";

function blockImages(messages: Message[]): Message[] {
	return messages.map((message) => {
		if ((message.role !== "user" && message.role !== "toolResult") || !Array.isArray(message.content)) return message;
		let previousBlocked = false;
		const content = message.content.flatMap((part) => {
			if (part.type !== "image") { previousBlocked = false; return [part]; }
			if (previousBlocked) return [];
			previousBlocked = true;
			return [{ type: "text" as const, text: "Image reading is disabled." }];
		});
		return { ...message, content } as Message;
	});
}

/** Create a headless Pigent session. Host-owned tools are the only tools registered. */
export async function createAgentSession(options: CreateAgentSessionOptions = {}): Promise<CreateAgentSessionResult> {
	const cwd = resolvePath(options.cwd ?? options.sessionManager?.getCwd() ?? process.cwd());
	const agentDir = resolvePath(options.agentDir ?? getAgentDir());
	const settingsManager = options.settingsManager ?? SettingsManager.create(cwd, agentDir);
	const modelRuntime = options.modelRuntime ?? await ModelRuntime.create({
		settingsPath: join(agentDir, "settings.json"),
		authPath: join(agentDir, "auth.json"),
	});
	const sessionManager = options.sessionManager ?? SessionManager.create(cwd, getDefaultSessionDir(cwd, agentDir));
	const resourceLoader = options.resourceLoader ?? new DefaultResourceLoader({ cwd, agentDir, settingsManager });
	if (!options.resourceLoader) await resourceLoader.reload();

	const restored = sessionManager.buildSessionContext();
	let model = options.model;
	let modelFallbackMessage: string | undefined;
	if (!model && restored.model) {
		model = modelRuntime.getModel(restored.model.provider, restored.model.modelId);
		if (!model) modelFallbackMessage = `Could not restore model ${restored.model.provider}/${restored.model.modelId}`;
	}
	if (!model) {
		const provider = settingsManager.getDefaultProvider();
		const modelId = settingsManager.getDefaultModel();
		model = provider && modelId ? modelRuntime.getModel(provider, modelId) : undefined;
	}
	if (!model) model = modelRuntime.getAvailableSnapshot()[0] ?? modelRuntime.getModels()[0];
	if (!model) throw new Error("No Pigent model is available");

	let thinkingLevel = options.thinkingLevel ?? (restored.thinkingLevel as ThinkingLevel | undefined) ?? settingsManager.getDefaultThinkingLevel() ?? "medium";
	thinkingLevel = clampThinkingLevel(model, thinkingLevel) as ThinkingLevel;
	const convertToLlmWithSettings = async (messages: AgentMessage[]): Promise<Message[]> => {
		const converted = convertToLlm(messages);
		return settingsManager.getBlockImages() ? blockImages(converted) : converted;
	};
	const agent = new Agent({
		initialState: { systemPrompt: "", model, thinkingLevel, tools: [], messages: restored.messages },
		convertToLlm: convertToLlmWithSettings,
		streamFn: (activeModel, context, streamOptions) => modelRuntime.streamSimple(activeModel, context, {
			...streamOptions,
			timeoutMs: streamOptions?.timeoutMs ?? settingsManager.getProviderRetrySettings().timeoutMs ?? (settingsManager.getHttpIdleTimeoutMs() || undefined),
			maxRetries: streamOptions?.maxRetries ?? settingsManager.getProviderRetrySettings().maxRetries,
			maxRetryDelayMs: streamOptions?.maxRetryDelayMs ?? settingsManager.getProviderRetrySettings().maxRetryDelayMs,
		}),
		sessionId: sessionManager.getSessionId(),
		steeringMode: settingsManager.getSteeringMode(),
		followUpMode: settingsManager.getFollowUpMode(),
		transport: settingsManager.getTransport(),
		thinkingBudgets: settingsManager.getThinkingBudgets(),
	});
	if (restored.messages.length === 0) {
		sessionManager.appendModelChange(model.provider, model.id);
		sessionManager.appendThinkingLevelChange(thinkingLevel);
	}

	let agentPool: AgentPool | undefined;
	if (options.agentPool) {
		agentPool = new AgentPool(options.agentPool, {
			cwd, agentDir, modelRuntime, resourceLoader, model,
			customTools: options.customTools,
			policySettings: settingsManager.getPolicySettings(),
			createSession: (childOptions) => createAgentSession(childOptions),
		});
	}
	const selectedTools = options.noTools ? [] : options.tools;
	const session = new AgentSession({
		agent, sessionManager, settingsManager, cwd, resourceLoader, modelRuntime,
		customTools: options.customTools,
		agentPool,
		dynamicTasksEnabled: options.dynamicTasks !== false && options.noTools !== "all" && options.noTools !== "builtin",
		allowedToolNames: selectedTools,
		excludedToolNames: options.excludeTools,
		scopedModels: options.scopedModels,
		sessionStartEvent: options.sessionStartEvent,
	});
	return { session, extensionsResult: resourceLoader.getExtensions(), modelFallbackMessage };
}
