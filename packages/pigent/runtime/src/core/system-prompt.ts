export interface BuildSystemPromptOptions {
	customPrompt?: string;
	selectedTools?: string[];
	toolSnippets?: Record<string, string>;
	promptGuidelines?: string[];
	appendSystemPrompt?: string;
	cwd: string;
	contextFiles?: Array<{ path: string; content: string }>;
	executionContract?: string;
}

/** Build the headless Pigent prompt from host-selected tools and explicit context files. */
export function buildSystemPrompt(options: BuildSystemPromptOptions): string {
	let prompt = options.customPrompt ?? "You are Pigent, Pipyter's embedded coding agent runtime.";
	const tools = options.selectedTools ?? [];
	if (tools.length) {
		prompt += `\n\nAvailable tools:\n${tools.map((name) => `- ${name}${options.toolSnippets?.[name] ? `: ${options.toolSnippets[name]}` : ""}`).join("\n")}`;
	}
	if (options.promptGuidelines?.length) prompt += `\n\nGuidelines:\n${options.promptGuidelines.map((item) => `- ${item}`).join("\n")}`;
	if (options.appendSystemPrompt) prompt += `\n\n${options.appendSystemPrompt}`;
	if (options.contextFiles?.length) {
		prompt += `\n\n<project_context>\n${options.contextFiles.map((item) => `<project_instructions path="${item.path}">\n${item.content}\n</project_instructions>`).join("\n")}\n</project_context>`;
	}
	if (options.executionContract) prompt += `\n\n<execution_contract>\n${options.executionContract}\n</execution_contract>`;
	return `${prompt}\nCurrent working directory: ${options.cwd.replace(/\\/gu, "/")}`;
}
