#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const NODE_MIN = "22.19.0";
const PIGENT_PROTOCOL_VERSION = "0.2";
const here = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(here, "..");
const repository = resolve(workspace, "../..");
const output = resolve(repository, "build/pigent-runtime");
const verifyOnly = process.argv.includes("--verify");
const allowedExtensions = new Set([".js", ".mjs", ".cjs", ".json", ".wasm"]);
const forbiddenSegments = new Set(["engines", ".beaupi", ".pi", "cache", "caches", "sessions", "logs", "coverage", "test", "tests", "example", "examples", "docs", ".bin"]);
const forbiddenNames = new Set(["settings.json", "auth.json", "models.json", "models-store.json", ".npmrc", ".env"]);
const compareNames = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function versionTuple(value) {
  const match = /^(?:v)?(\d+)\.(\d+)\.(\d+)/.exec(value);
  if (!match) throw new Error(`cannot parse Node version: ${value}`);
  return match.slice(1).map(Number);
}
function versionAtLeast(actual, minimum) {
  const a = versionTuple(actual), b = versionTuple(minimum);
  return a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] >= b[2])));
}
function sha256(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}
function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(stable(value), null, 2)}\n`, { mode: 0o644 });
}
function pathParts(path) { return path.split(/[\\/]+/).filter(Boolean); }
function forbiddenPath(rel) {
  const parts = pathParts(rel);
  return parts.some((part) => {
    const lower = part.toLowerCase();
    return forbiddenSegments.has(lower) || /^(?:browser|system|integration|unit)-test$/.test(lower) || /^test-/.test(lower) || /-tests?$/.test(lower);
  }) || forbiddenNames.has(basename(rel).toLowerCase()) || basename(rel) === "__pycache__";
}
function copyRuntimeTree(source, destination) {
  const rootReal = realpathSync(source);
  const active = new Set();
  function copyDirectory(directory, targetDirectory, logicalPrefix = "") {
    const directoryReal = realpathSync(directory);
    if (!(directoryReal === rootReal || directoryReal.startsWith(rootReal + sep)))
      throw new Error(`escaping directory rejected: ${directory}`);
    if (active.has(directoryReal)) throw new Error(`symlink cycle rejected: ${directory}`);
    active.add(directoryReal);
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => compareNames(a.name, b.name))) {
      const src = join(directory, entry.name);
      const logical = logicalPrefix ? `${logicalPrefix}/${entry.name}` : entry.name;
      if (forbiddenPath(logical)) continue;
      const details = lstatSync(src);
      let targetSource = src;
      if (details.isSymbolicLink()) {
        targetSource = realpathSync(src);
        if (!(targetSource === rootReal || targetSource.startsWith(rootReal + sep)))
          throw new Error(`escaping symlink rejected: ${src}`);
      }
      const targetDetails = statSync(targetSource);
      const target = join(targetDirectory, entry.name);
      if (targetDetails.isDirectory()) {
        mkdirSync(target, { recursive: true, mode: 0o755 });
        copyDirectory(targetSource, target, logical);
        if (existsSync(target) && readdirSync(target).length === 0) rmSync(target, { recursive: true });
        continue;
      }
      if (!targetDetails.isFile()) throw new Error(`unsupported payload entry: ${targetSource}`);
      if (extname(entry.name).toLowerCase() === ".node") throw new Error(`native Node module rejected: ${targetSource}`);
      const lower = entry.name.toLowerCase();
      const isNotice = /^(license|licence|notice|copyright)(\..*)?$/i.test(entry.name);
      if (!allowedExtensions.has(extname(lower)) && !isNotice) continue;
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(targetSource, target);
      chmodSync(target, 0o644);
    }
    active.delete(directoryReal);
  }
  copyDirectory(source, destination);
}
function allFiles(root) {
  const result = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => compareNames(a.name, b.name))) {
      const path = join(directory, entry.name), rel = relative(root, path).split(sep).join("/");
      if (entry.isSymbolicLink()) throw new Error(`symlink rejected from final payload: ${rel}`);
      if (entry.isDirectory()) walk(path); else if (entry.isFile()) result.push(rel); else throw new Error(`unsupported payload entry: ${rel}`);
    }
  }
  walk(root); return result;
}
function validatePayloadContent(root, files) {
  const forbiddenLegacyNames = ["models.json", "models-store.json"];
  for (const rel of files) {
    const bytes = readFileSync(join(root, rel));
    const folded = bytes.toString("latin1").toLowerCase();
    if (folded.includes("beaupi")) throw new Error(`legacy product identity leaked into payload content: ${rel}`);
    for (const name of forbiddenLegacyNames) {
      if (bytes.includes(Buffer.from(name))) throw new Error(`legacy model filename leaked into payload content: ${rel}`);
    }
  }
}
function validatePayload(root, manifest) {
  if (!existsSync(root)) throw new Error(`Pigent payload missing: ${root}`);
  if (manifest.portable !== true || manifest.node_min !== NODE_MIN || manifest.external_engine_required !== false ||
      manifest.schema_version !== 2 || manifest.host_protocol_version !== PIGENT_PROTOCOL_VERSION ||
      manifest.tool_protocol_version !== PIGENT_PROTOCOL_VERSION)
    throw new Error("Pigent manifest portability/runtime contract mismatch");
  const payloadFiles = allFiles(root).sort(compareNames);
  validatePayloadContent(root, payloadFiles);
  const files = payloadFiles.filter((item) => item !== "manifest.json");
  const expected = Object.keys(manifest.files ?? {}).sort(compareNames);
  if (JSON.stringify(files) !== JSON.stringify(expected)) throw new Error("Pigent payload has stale, missing, or unmanifested files");
  for (const rel of files) {
    if (forbiddenPath(rel) || rel.toLowerCase().endsWith(".node")) throw new Error(`forbidden payload path: ${rel}`);
    if (sha256(join(root, rel)) !== manifest.files[rel]) throw new Error(`Pigent payload hash mismatch: ${rel}`);
    const extension = extname(rel).toLowerCase();
    if ([".js", ".mjs", ".cjs", ".json"].includes(extension)) {
      const text = readFileSync(join(root, rel), "utf8");
      const ignoredEngine = `engines/${"beau" + "pi"}`;
      const ignoredEngineWindows = ignoredEngine.replace("/", "\\");
      if (text.includes(repository) || text.includes(ignoredEngine) || text.includes(ignoredEngineWindows))
        throw new Error(`checkout/engine path leaked into payload: ${rel}`);
    }
  }
  return manifest;
}
function verify(root = output) { return validatePayload(root, json(join(root, "manifest.json"))); }

if (!versionAtLeast(process.version, NODE_MIN)) throw new Error(`Node ${NODE_MIN} or newer is required; found ${process.version}`);
if (verifyOnly) { verify(); console.log(`verified ${output}`); process.exit(0); }

rmSync(output, { recursive: true, force: true });
execFileSync("npm", ["ci", "--omit=optional", "--ignore-scripts"], { cwd: workspace, stdio: "inherit", shell: false });
execFileSync("npm", ["run", "build"], { cwd: workspace, stdio: "inherit", shell: false });
execFileSync("npm", ["prune", "--omit=dev", "--omit=optional", "--ignore-scripts"], { cwd: workspace, stdio: "inherit", shell: false });

mkdirSync(output, { recursive: true, mode: 0o755 });
for (const file of ["main.js", "events.js", "tools.js"]) {
  const target = file === "main.js" ? "host.mjs" : file;
  copyFileSync(join(workspace, "host/dist", file), join(output, target)); chmodSync(join(output, target), 0o644);
}
const internal = ["ai", "agent", "runtime"];
for (const name of internal) {
  const destination = join(output, "node_modules/@pipyter", `pigent-${name}`);
  mkdirSync(destination, { recursive: true });
  copyRuntimeTree(join(workspace, name, "dist"), join(destination, "dist"));
  copyFileSync(join(workspace, name, "package.json"), join(destination, "package.json")); chmodSync(join(destination, "package.json"), 0o644);
}
for (const entry of readdirSync(join(workspace, "node_modules"), { withFileTypes: true }).sort((a, b) => compareNames(a.name, b.name))) {
  if (entry.name === "@pipyter" || entry.name === ".bin" || entry.name === ".package-lock.json") continue;
  if (entry.name.startsWith("@")) {
    for (const scoped of readdirSync(join(workspace, "node_modules", entry.name), { withFileTypes: true }).sort((a, b) => compareNames(a.name, b.name))) {
      if (!scoped.isDirectory() && !scoped.isSymbolicLink()) continue;
      copyRuntimeTree(join(workspace, "node_modules", entry.name, scoped.name), join(output, "node_modules", entry.name, scoped.name));
    }
  } else if (entry.isDirectory() || entry.isSymbolicLink()) {
    copyRuntimeTree(join(workspace, "node_modules", entry.name), join(output, "node_modules", entry.name));
  }
}
// Python's version module is intentionally parsed without importing the checkout.
const versionText = readFileSync(join(repository, "src/pipyter/_version.py"), "utf8");
const pipyterVersion = /__version__\s*=\s*["']([^"']+)/.exec(versionText)?.[1];
if (!pipyterVersion) throw new Error("cannot read Pipyter version");
writeJson(join(output, "package.json"), {
  name: "@pipyter/pigent-runtime-payload", version: pipyterVersion,
  private: true, type: "module", main: "./host.mjs", engines: { node: `>=${NODE_MIN}` }, dependencies: {}
});
const lock = json(join(workspace, "package-lock.json"));
const dependencies = [];
for (const [path, metadata] of Object.entries(lock.packages ?? {})) {
  if (!path.startsWith("node_modules/") || path.startsWith("node_modules/@pipyter/")) continue;
  const packagePath = join(output, path);
  if (!existsSync(packagePath)) continue;
  const packageJson = existsSync(join(packagePath, "package.json")) ? json(join(packagePath, "package.json")) : {};
  dependencies.push({ name: packageJson.name ?? path.slice("node_modules/".length), version: metadata.version ?? packageJson.version ?? "unknown",
    license: metadata.license ?? packageJson.license ?? "unknown", integrity: metadata.integrity ?? null });
}
dependencies.sort((a, b) => compareNames(a.name, b.name) || compareNames(a.version, b.version));
writeJson(join(output, "dependency-manifest.json"), { version: 1, generated_from: "packages/pigent/package-lock.json", dependencies });
const payloadPackage = json(join(output, "package.json")); payloadPackage.version = pipyterVersion; writeJson(join(output, "package.json"), payloadPackage);
const stagedFiles = allFiles(output).filter((item) => item !== "manifest.json").sort(compareNames);
validatePayloadContent(output, stagedFiles);
const files = Object.fromEntries(stagedFiles.map((item) => [item, sha256(join(output, item))]));
writeJson(join(output, "manifest.json"), {
  schema_version: 2, runtime: "pigent-host", runtime_version: pipyterVersion, pigent_version: pipyterVersion,
  pipyter_version: pipyterVersion, source_package: "packages/pigent", host_entry: "host.mjs",
  host_protocol_version: PIGENT_PROTOCOL_VERSION, tool_protocol_version: PIGENT_PROTOCOL_VERSION, protocol_package_version: json(join(repository, "packages/protocol/package.json")).version,
  node_min: NODE_MIN, portable: true, first_party: true, external_engine_required: false, files,
});
verify();
console.log(`built ${output} (${Object.keys(files).length} files)`);
