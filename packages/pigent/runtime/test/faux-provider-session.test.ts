import { describe, expect, it } from "vitest";
import { fauxAssistantMessage, fauxProvider } from "@pipyter/pigent-ai/providers/faux";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";
import { InMemoryCodingAgentModelsStore } from "../src/core/models-store.ts";
import { createAgentSession } from "../src/core/sdk.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";

async function setup() {
  const faux = fauxProvider({ provider: "faux", api: "faux", models: [{ id: "session" }], tokensPerSecond: 20, tokenSize: { min: 1, max: 1 } });
  const modelRuntime = await ModelRuntime.create({ credentials: AuthStorage.inMemory(), settingsPath: null, modelsStore: new InMemoryCodingAgentModelsStore() });
  modelRuntime.registerNativeProvider(faux.provider);
  await modelRuntime.refresh({ allowNetwork: false });
  return { faux, modelRuntime, settings: SettingsManager.inMemory({ defaultProvider: "faux", defaultModel: "session" }) };
}

describe("faux provider session", () => {
  it("prompts, streams, aborts, and restores session messages", async () => {
    const { faux, modelRuntime, settings } = await setup();
    const manager = SessionManager.inMemory("/repo");
    faux.setResponses([fauxAssistantMessage("deterministic reply")]);
    const first = await createAgentSession({ cwd: "/repo", agentDir: "/config", modelRuntime, model: faux.getModel(), settingsManager: settings, sessionManager: manager, noTools: "all" });
    await first.session.prompt("hello");
    expect(first.session.getLastAssistantText()).toBe("deterministic reply");
    first.session.dispose();

    const restored = await createAgentSession({ cwd: "/repo", agentDir: "/config", modelRuntime, model: faux.getModel(), settingsManager: settings, sessionManager: manager, noTools: "all" });
    expect(restored.session.messages.some((message) => message.role === "assistant")).toBe(true);
    faux.setResponses([fauxAssistantMessage("this response is deliberately long enough to abort")]);
    const pending = restored.session.prompt("abort me");
    await new Promise((resolve) => setTimeout(resolve, 20));
    await restored.session.abort();
    await pending;
    const last = restored.session.messages.at(-1);
    expect(last?.role).toBe("assistant");
    if (last?.role === "assistant") expect(last.stopReason).toBe("aborted");
    restored.session.dispose();
  });
});
