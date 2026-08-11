import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolvePath } from "../utils/paths.ts";
import type { ResourceDiagnostic } from "./diagnostics.ts";
import type { InlineExtension, LoadExtensionsResult, ExtensionRuntime } from "./extensions/types.ts";
import type { PromptTemplate } from "./prompt-templates.ts";
import type { SettingsManager } from "./settings-manager.ts";

export type { ResourceCollision, ResourceDiagnostic, SkillPolicyDiagnosticReason } from "./diagnostics.ts";

export interface ResourceExtensionPaths {
	promptPaths?: Array<{ path: string; metadata?: unknown }>;
}

export interface ResourceLoaderReloadOptions {
	resolveProjectTrust?: (input: { extensionsResult: LoadExtensionsResult }) => Promise<boolean>;
}

export interface ResourceLoader {
	getExtensions(): LoadExtensionsResult;
	getSkills(): { skills: never[]; diagnostics: ResourceDiagnostic[] };
	getPrompts(): { prompts: PromptTemplate[]; diagnostics: ResourceDiagnostic[] };
	getThemes(): { themes: never[]; diagnostics: ResourceDiagnostic[] };
	getAgentsFiles(): { agentsFiles: Array<{ path: string; content: string }> };
	getSystemPrompt(): string | undefined;
	getAppendSystemPrompt(): string[];
	extendResources(paths: ResourceExtensionPaths): void;
	reload(options?: ResourceLoaderReloadOptions): Promise<void>;
}

function inactiveRuntime(): ExtensionRuntime {
	let active = true;
	const unavailable = (): never => {
		if (!active) throw new Error("Extension runtime is stale");
		throw new Error("Extension actions are unavailable before session binding");
	};
	return {
		flagValues: new Map(),
		pendingProviderRegistrations: [],
		pendingNativeProviderRegistrations: [],
		assertActive: () => { if (!active) throw new Error("Extension runtime is stale"); },
		invalidate: () => { active = false; },
		registerProvider: unavailable,
		registerNativeProvider: unavailable,
		unregisterProvider: unavailable,
		sendMessage: unavailable,
		sendUserMessage: unavailable,
		appendEntry: unavailable,
		setSessionName: unavailable,
		getSessionName: unavailable,
		setLabel: unavailable,
		getActiveTools: unavailable,
		getAllTools: unavailable,
		setActiveTools: unavailable,
		refreshTools: unavailable,
		getCommands: unavailable,
		setModel: unavailable,
		getThinkingLevel: unavailable,
		setThinkingLevel: unavailable,
	};
}

function emptyExtensions(): LoadExtensionsResult {
	return { extensions: [], errors: [], runtime: inactiveRuntime() };
}

function loadContextFile(dir: string): { path: string; content: string } | undefined {
	for (const name of ["AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD"]) {
		const path = join(dir, name);
		try {
			if (existsSync(path) && statSync(path).isFile()) return { path, content: readFileSync(path, "utf8") };
		} catch {
			// Context files are advisory resources; unreadable files are skipped.
		}
	}
	return undefined;
}

export function loadProjectContextFiles(options: { cwd: string; agentDir: string }): Array<{ path: string; content: string }> {
	const cwd = resolvePath(options.cwd);
	const agentDir = resolvePath(options.agentDir);
	const result: Array<{ path: string; content: string }> = [];
	const seen = new Set<string>();
	const global = loadContextFile(agentDir);
	if (global) { result.push(global); seen.add(global.path); }
	const ancestors: Array<{ path: string; content: string }> = [];
	for (let current = cwd; ; current = dirname(current)) {
		const item = loadContextFile(current);
		if (item && !seen.has(item.path)) { ancestors.unshift(item); seen.add(item.path); }
		const parent = dirname(current);
		if (parent === current) break;
	}
	return [...result, ...ancestors];
}

export interface DefaultResourceLoaderOptions {
	cwd: string;
	agentDir: string;
	settingsManager?: SettingsManager;
	additionalPromptTemplatePaths?: string[];
	extensionFactories?: InlineExtension[];
	noContextFiles?: boolean;
	systemPrompt?: string;
	appendSystemPrompt?: string[];
	agentsFilesOverride?: (base: { agentsFiles: Array<{ path: string; content: string }> }) => { agentsFiles: Array<{ path: string; content: string }> };
	systemPromptOverride?: (base: string | undefined) => string | undefined;
	appendSystemPromptOverride?: (base: string[]) => string[];
}

/** Minimal Pigent resource loader: explicit prompt text plus AGENTS.md context only. */
export class DefaultResourceLoader implements ResourceLoader {
	private readonly options: DefaultResourceLoaderOptions;
	private extensions = emptyExtensions();
	private agentsFiles: Array<{ path: string; content: string }> = [];
	private promptPaths: string[];

	constructor(options: DefaultResourceLoaderOptions) {
		this.options = options;
		this.promptPaths = [...(options.additionalPromptTemplatePaths ?? [])];
	}

	getExtensions(): LoadExtensionsResult { return this.extensions; }
	getSkills() { return { skills: [] as never[], diagnostics: [] as ResourceDiagnostic[] }; }
	getPrompts() { return { prompts: [] as PromptTemplate[], diagnostics: [] as ResourceDiagnostic[] }; }
	getThemes() { return { themes: [] as never[], diagnostics: [] as ResourceDiagnostic[] }; }
	getAgentsFiles() { return { agentsFiles: this.agentsFiles.map((item) => ({ ...item })) }; }
	getSystemPrompt(): string | undefined { return this.options.systemPromptOverride?.(this.options.systemPrompt) ?? this.options.systemPrompt; }
	getAppendSystemPrompt(): string[] {
		const base = [...(this.options.appendSystemPrompt ?? [])];
		return this.options.appendSystemPromptOverride?.(base) ?? base;
	}
	extendResources(paths: ResourceExtensionPaths): void {
		for (const item of paths.promptPaths ?? []) this.promptPaths.push(resolvePath(item.path));
	}
	async reload(): Promise<void> {
		this.extensions.runtime.invalidate();
		this.extensions = emptyExtensions();
		const base = this.options.noContextFiles ? { agentsFiles: [] } : { agentsFiles: loadProjectContextFiles(this.options) };
		this.agentsFiles = (this.options.agentsFilesOverride?.(base) ?? base).agentsFiles;
	}
}
