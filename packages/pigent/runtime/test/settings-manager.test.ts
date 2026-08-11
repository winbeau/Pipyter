import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SettingsManager } from "../src/core/settings-manager.ts";

describe("SettingsManager", () => {
  it("reads the injected global settings directory", () => {
    const root = mkdtempSync(join(tmpdir(), "pigent-settings-"));
    const config = join(root, "config");
    mkdirSync(config, { recursive: true });
    writeFileSync(join(config, "settings.json"), JSON.stringify({ defaultProvider: "faux", defaultModel: "session", images: { blockImages: true } }));
    const manager = SettingsManager.create(root, config);
    expect(manager.getDefaultProvider()).toBe("faux");
    expect(manager.getDefaultModel()).toBe("session");
    expect(manager.getBlockImages()).toBe(true);
  });
});
