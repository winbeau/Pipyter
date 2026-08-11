import type { AgentEvent } from "@pipyter/pigent-agent";
import type { SessionEntry } from "../session-manager.ts";
import type { DynamicTaskPlanV1 } from "../tasks/types.ts";

export const TASK_LEDGER_DETAILS_KEY = "taskLedger";
export const TASK_LEDGER_DETAILS_VERSION = 1;

export type TaskVerificationStatus = "none" | "pending" | "running" | "passed" | "failed" | "cancelled";

export interface TaskLedgerToolDetails {
	version: typeof TASK_LEDGER_DETAILS_VERSION;
	eventId: string;
	status: "success" | "failed" | "cancelled";
	startedAt: number;
	endedAt: number;
	filesRead?: string[];
	filesModified?: string[];
	verification?: boolean;
}

export interface TaskLedgerSnapshot {
	taskId: string;
	revision: number;
	filesRead: ReadonlyArray<{ id: string; path: string; commandId: string; timestamp: number }>;
	filesModified: readonly string[];
	network: ReadonlyArray<{ citations: readonly unknown[] }>;
	verification: { status: TaskVerificationStatus; label?: string; timestamp?: number };
	dynamicTasks?: DynamicTaskPlanV1;
}

function record(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function getTaskLedgerToolDetails(details: unknown): TaskLedgerToolDetails | undefined {
	const value = record(record(details)?.[TASK_LEDGER_DETAILS_KEY]);
	if (!value || value.version !== TASK_LEDGER_DETAILS_VERSION || typeof value.eventId !== "string") return undefined;
	if (value.status !== "success" && value.status !== "failed" && value.status !== "cancelled") return undefined;
	return value as unknown as TaskLedgerToolDetails;
}

export function attachTaskLedgerToolDetails(details: unknown, metadata: TaskLedgerToolDetails): unknown {
	return { ...(record(details) ?? {}), [TASK_LEDGER_DETAILS_KEY]: structuredClone(metadata) };
}

export function isVerificationCommand(command: string): boolean {
	return /(?:^|\s)(?:test|pytest|vitest|jest|tsc|mypy|ruff|lint|check)(?:\s|$)/iu.test(command);
}

/** Core task ledger retained by Pigent: tool outcomes, file facts, verification, and Dynamic Tasks projection. */
export class TaskLedger {
	private readonly taskId: string;
	private revision = 0;
	private readonly starts = new Map<string, { toolName: string; startedAt: number; args: unknown }>();
	private filesRead: Array<{ id: string; path: string; commandId: string; timestamp: number }> = [];
	private filesModified = new Set<string>();
	private verification: TaskLedgerSnapshot["verification"] = { status: "none" };
	private dynamicTasks?: DynamicTaskPlanV1;

	constructor(options: { taskId: string; cwd?: string; entries?: readonly SessionEntry[] }) {
		this.taskId = options.taskId;
	}

	rebuild(_entries: readonly SessionEntry[]): void {
		this.starts.clear();
		this.filesRead = [];
		this.filesModified.clear();
		this.verification = { status: "none" };
		this.revision++;
	}

	setDynamicTaskPlan(plan: DynamicTaskPlanV1 | undefined): void {
		this.dynamicTasks = plan ? structuredClone(plan) : undefined;
		this.revision++;
	}

	handleAgentEvent(event: AgentEvent, options?: { cancelled?: boolean }): TaskLedgerToolDetails | undefined {
		if (event.type === "tool_execution_start") {
			this.starts.set(event.toolCallId, { toolName: event.toolName, startedAt: Date.now(), args: event.args });
			if (event.toolName === "bash" && typeof record(event.args)?.command === "string" && isVerificationCommand(record(event.args)!.command as string)) {
				this.verification = { status: "running", label: record(event.args)!.command as string, timestamp: Date.now() };
			}
			return undefined;
		}
		if (event.type !== "tool_execution_end") return undefined;
		const start = this.starts.get(event.toolCallId);
		this.starts.delete(event.toolCallId);
		const result = record(event.result);
		const detail = record(result?.details);
		const read = [...(Array.isArray(detail?.filesRead) ? detail!.filesRead : []), ...(Array.isArray(detail?.references) ? detail!.references : [])]
			.filter((item): item is string => typeof item === "string");
		const modified = (Array.isArray(detail?.filesModified) ? detail!.filesModified : [])
			.filter((item): item is string => typeof item === "string");
		for (const path of read) this.filesRead.push({ id: `${event.toolCallId}:${path}`, path, commandId: event.toolCallId, timestamp: Date.now() });
		for (const path of modified) this.filesModified.add(path);
		const verification = start?.toolName === "bash" && typeof record(start.args)?.command === "string" && isVerificationCommand(record(start.args)!.command as string);
		if (verification) this.verification = { status: event.isError ? "failed" : options?.cancelled ? "cancelled" : "passed", label: record(start!.args)!.command as string, timestamp: Date.now() };
		this.revision++;
		return {
			version: TASK_LEDGER_DETAILS_VERSION,
			eventId: event.toolCallId,
			status: options?.cancelled ? "cancelled" : event.isError ? "failed" : "success",
			startedAt: start?.startedAt ?? Date.now(),
			endedAt: Date.now(),
			filesRead: read,
			filesModified: modified,
			verification,
		};
	}

	getToolDetails(_toolCallId: string): TaskLedgerToolDetails | undefined { return undefined; }
	getSnapshot(): TaskLedgerSnapshot {
		return {
			taskId: this.taskId,
			revision: this.revision,
			filesRead: this.filesRead.map((item) => ({ ...item })),
			filesModified: [...this.filesModified],
			network: [],
			verification: { ...this.verification },
			dynamicTasks: this.dynamicTasks ? structuredClone(this.dynamicTasks) : undefined,
		};
	}
}
