import type { Usage } from "@pipyter/pigent-ai";
import { validateTaskPatch } from "./schema.ts";
import type { DynamicTaskFactV1, DynamicTaskPlanV1, TaskPatchV1 } from "./types.ts";

export type TaskReviewTrigger = "agent_settled" | "mutation_batch" | "verification_finished" | "critical_failure" | "background_attention";
export interface TaskReviewLimits { timeoutMs: number; maxInputCharacters: number; maxOutputCharacters: number; }
export interface TaskReviewInput {
	snapshot: DynamicTaskPlanV1;
	expectedRevision: number;
	factsHash: string;
	lastReviewedFactsHash?: string;
	facts: DynamicTaskFactV1[];
	trigger: TaskReviewTrigger;
	limits: TaskReviewLimits;
}
export type TaskReviewResultStatus = "skipped" | "completed" | "unavailable" | "malformed" | "provider_failure" | "timed_out" | "aborted";
export interface TaskReviewResult {
	status: TaskReviewResultStatus;
	expectedRevision: number;
	factsHash: string;
	patch?: TaskPatchV1;
	model?: string;
	usage?: Usage;
	error?: string;
	inputTruncated: boolean;
}
export interface TaskReviewer { review(input: TaskReviewInput, signal?: AbortSignal): Promise<TaskReviewResult>; }

export function parseTaskPatchOutput(text: string, expectedRevision: number, factsHash: string, knownTaskIds: ReadonlySet<string>): TaskPatchV1 | undefined {
	try {
		const match = text.match(/\{[\s\S]*\}/u);
		if (!match) return undefined;
		const patch = validateTaskPatch(JSON.parse(match[0]));
		if (patch.expectedRevision !== expectedRevision || patch.factsHash !== factsHash) return undefined;
		if (patch.updates.some((update) => !knownTaskIds.has(update.id))) return undefined;
		return patch;
	} catch { return undefined; }
}

export interface ModelTaskReviewerOptions { modelRuntime: unknown; modelResolver?: unknown; }
/** Phase 1 keeps the reviewer boundary but does not create a separate review-model dependency. */
export class ModelTaskReviewer implements TaskReviewer {
	constructor(_options: ModelTaskReviewerOptions) {}
	async review(input: TaskReviewInput, signal?: AbortSignal): Promise<TaskReviewResult> {
		return { status: signal?.aborted ? "aborted" : "unavailable", expectedRevision: input.expectedRevision, factsHash: input.factsHash, inputTruncated: false };
	}
}
