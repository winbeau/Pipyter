import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const VERSION = "0.3.0";
export const APP_NAME = "Pigent";
export const PACKAGE_NAME = "@pipyter/pigent-runtime";
export const CONFIG_DIR_NAME = "pipyter/pigent";

export function getAgentDir(): string {
	const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
	return join(base, "pipyter", "pigent");
}

export function getSessionsDir(): string {
	return join(getAgentDir(), "sessions");
}

export function getPackageDir(): string {
	return dirname(dirname(fileURLToPath(import.meta.url)));
}

export function getDocsPath(): string { return join(getPackageDir(), "docs"); }
export function getExamplesPath(): string { return join(getPackageDir(), "examples"); }
export function getReadmePath(): string { return join(getPackageDir(), "README.md"); }
