import { describe, expect, it } from "vitest";
import { fauxAssistantMessage, fauxProvider } from "@pipyter/pigent-ai/providers/faux";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";
import { InMemoryCodingAgentModelsStore } from "../src/core/models-store.ts";
import { DefaultResourceLoader } from "../src/core/resource-loader.ts";
import { createAgentSession } from "../src/core/sdk.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";

async function harness() {
  const faux = fauxProvider({ provider: "faux", api: "faux", models: [{ id: "pool" }] });
  const modelRuntime = await ModelRuntime.create({ credentials: AuthStorage.inMemory(), settingsPath: null, modelsStore: new InMemoryCodingAgentModelsStore() });
  modelRuntime.registerNativeProvider(faux.provider);
  await modelRuntime.refresh({ allowNetwork: false });
  const settingsManager = SettingsManager.inMemory({ defaultProvider: "faux", defaultModel: "pool" });
  const resourceLoader = new DefaultResourceLoader({ cwd: "/repo", agentDir: "/config", settingsManager, noContextFiles: true });
  await resourceLoader.reload();
  const created = await createAgentSession({
    cwd: "/repo", agentDir: "/config", modelRuntime, model: faux.getModel(), settingsManager, resourceLoader,
    sessionManager: SessionManager.inMemory("/repo"), dynamicTasks: false,
    agentPool: { maxConcurrency: 2, defaultProfile: "test", profiles: [{ id: "test", systemPrompt: "Return the requested summary.", timeoutMs: 5000 }] },
  });
  return { faux, session: created.session };
}

describe("AgentPool", () => {
  it("runs children in parallel and returns structured results", async () => {
    const { faux, session } = await harness();
    faux.setResponses([
      async () => { await new Promise((resolve) => setTimeout(resolve, 30)); return fauxAssistantMessage("first summary"); },
      async () => { await new Promise((resolve) => setTimeout(resolve, 30)); return fauxAssistantMessage("second summary"); },
    ]);
    const pool = session.agentPool!;
    const results = await Promise.all([pool.delegateTask({ task: "first" }), pool.delegateTask({ task: "second" })]);
    expect(pool.maxObservedConcurrency).toBe(2);
    expect(results.map((result) => result.status)).toEqual(["completed", "completed"]);
    expect(results.map((result) => result.summary).sort()).toEqual(["first summary", "second summary"]);
    expect(results.every((result) => typeof result.taskId === "string" && result.usage.totalTokens >= 0)).toBe(true);
    session.dispose();
  });
});
