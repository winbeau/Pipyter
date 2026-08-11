#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const textExtensions = new Set([".ts", ".js", ".mjs", ".cjs", ".json"]);
const ignored = new Set(["node_modules", "dist", "coverage"]);
const legacyPackagePattern = new RegExp(`@earendil-works/(?:pi-${"ai"}|pi-agent-core|pi-coding-agent)`);
const enginePathPattern = new RegExp(`engines[\\\\/]${"beau" + "pi"}|file:\\.\\./\\.\\./engines`);
const violations = [];
function walk(directory) {
  for (const name of readdirSync(directory).sort()) {
    if (ignored.has(name)) continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) { walk(path); continue; }
    if (!textExtensions.has(extname(name))) continue;
    const text = readFileSync(path, "utf8");
    if (enginePathPattern.test(text) || legacyPackagePattern.test(text))
      violations.push(relative(root, path));
  }
}
walk(root);
if (violations.length) {
  console.error(`engine independence violations:\n${violations.join("\n")}`);
  process.exit(1);
}
console.log("tracked Pigent source is independent of ignored engine checkouts");
