import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";

const tempDirs: string[] = [];

afterEach(() => {
	for (const path of tempDirs.splice(0)) {
		if (existsSync(path)) rmSync(path, { recursive: true });
	}
});

function tempConfigDir(): string {
	const dir = join(tmpdir(), `pigent-model-config-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	tempDirs.push(dir);
	mkdirSync(dir, { recursive: true });
	return dir;
}

describe("ModelRuntime settings model configuration", () => {
	it("loads providers from settings and keeps the default catalog store in memory", async () => {
		const dir = tempConfigDir();
		const settingsPath = join(dir, "settings.json");
		writeFileSync(
			settingsPath,
			JSON.stringify({
				models: {
					providers: {
						custom: {
							api: "openai-completions",
							apiKey: "test-key",
							baseUrl: "https://example.test/v1",
							models: [{ id: "configured-model" }],
						},
					},
				},
			}),
		);

		const runtime = await ModelRuntime.create({
			credentials: AuthStorage.inMemory(),
			settingsPath,
			allowModelNetwork: false,
		});

		expect(runtime.getModel("custom", "configured-model")?.baseUrl).toBe("https://example.test/v1");
		expect(runtime.getProviderAuthStatus("custom")).toMatchObject({ configured: true, source: "settings_key" });
		expect(readdirSync(dir)).toEqual(["settings.json"]);
	});

	it("allows settings loading to be disabled explicitly", async () => {
		const runtime = await ModelRuntime.create({
			credentials: AuthStorage.inMemory(),
			settingsPath: null,
			allowModelNetwork: false,
		});
		expect(runtime.getError()).toBeUndefined();
	});
});
