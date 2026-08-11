import type { ResourceExtensionPaths, ResourceLoader } from "../resource-loader.ts";
import type { AgentProfile } from "./agent-profile.ts";

export const CONTROLLED_AGENT_CLARIFICATION_PROTOCOL = `If the task cannot be completed without user clarification, do not ask interactively. Return exactly one machine-readable block in the final response:
<clarification_request>{"version":1,"questions":[{"question":"A focused question","options":["Option A","Option B"]}]}</clarification_request>
Use 1-4 questions and 2-4 concrete options per question. Do not request secrets.`;

export function createControlledResourceLoader(base: ResourceLoader, profile: AgentProfile): ResourceLoader {
	return {
		getExtensions: () => base.getExtensions(),
		getSkills: () => ({ skills: [], diagnostics: [] }),
		getPrompts: () => base.getPrompts(),
		getThemes: () => ({ themes: [], diagnostics: [] }),
		getAgentsFiles: () => base.getAgentsFiles(),
		getSystemPrompt: () => `${profile.systemPrompt}\n\n${CONTROLLED_AGENT_CLARIFICATION_PROTOCOL}`,
		getAppendSystemPrompt: () => [],
		extendResources: (_paths: ResourceExtensionPaths) => {},
		reload: async () => {},
	};
}
