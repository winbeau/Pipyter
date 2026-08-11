# User installation and Pigent model configuration

## Goal

Make the normal user path:

```bash
uv tool install pipyter
pipyter --version
```

Pigent provider endpoints, model definitions, default model selection, API keys, and OAuth credentials then live under one user-owned directory:

```text
${XDG_CONFIG_HOME:-~/.config}/pipyter/
└── pigent/
    ├── settings.json
    └── auth.json
```

For the default Linux configuration this resolves to:

```text
~/.config/pipyter/pigent/settings.json
~/.config/pipyter/pigent/auth.json
```

These are the only persistent Pigent model-configuration files. Do not create or read `models.json`, `models-store.json`, a project-local model settings file, browser-local model defaults, or standalone BeauPi/Pi user configuration.

## Installation contract

The recommended user-level installation and upgrade commands are:

```bash
uv tool install pipyter
uv tool upgrade pipyter
```

`uv tool install` gives Pipyter an isolated Python environment while keeping the `pipyter` and optional `pigent` console scripts on the user tool path. It must not:

- install a global npm package;
- run copied npm lifecycle scripts;
- write into the current project;
- download Pigent source on first launch;
- depend on an `engines/beaupi` checkout.

A conventional `pip install pipyter` remains a supported packaging path and clean-environment test, but user-facing installation examples should prefer `uv tool install pipyter`.

## Directory initialization

A command that first needs user configuration resolves the config root in this order:

1. explicit trusted Pipyter config-root option supplied by the embedding/runtime;
2. `PIPYTER_CONFIG_HOME` when intentionally set;
3. `XDG_CONFIG_HOME/pipyter`;
4. `~/.config/pipyter`.

The first generic Pipyter invocation creates only the two directories; it does not add a root model or credential file:

```text
pipyter/             mode 0700
pipyter/pigent/      mode 0700
```

The first operation that opens Pigent model configuration then creates exactly two files:

```text
settings.json        mode 0600
auth.json            mode 0600
```

Initial `settings.json` contents are:

```json
{
  "version": 1
}
```

Initial `auth.json` contents are:

```json
{}
```

Create files atomically, serialize concurrent writers with a file lock, and reapply restrictive permissions after replacement. On platforms without POSIX modes, use the closest user-only ACL behavior available and report a doctor warning when confidentiality cannot be established.

Malformed existing JSON is a configuration error. Do not overwrite, rename, or silently repair the user's file during normal startup.

## Two-file ownership contract

| File | Owns | Must not contain |
| --- | --- | --- |
| `settings.json` | default provider/model, thinking level, enabled model list, provider API protocol, model definitions, non-secret compatibility options | API base URLs, API keys, secret headers, OAuth refresh/access tokens, bridge credentials |
| `auth.json` | provider-keyed API base URL, API-key/OAuth credentials, secret headers, and explicit secret/environment references | default model, model catalog overrides, UI/session state |

The pair jointly controls availability and selection:

- `settings.json.defaultProvider` and `settings.json.defaultModel` select the model.
- `auth.json` supplies the selected provider's API base URL and usable credentials, unless the provider is explicitly keyless and uses a built-in endpoint.
- `settings.json.models.providers` contains provider protocol, model definitions, and compatibility metadata that BeauPi previously allowed in `settings.json` or `models.json`; endpoint addresses move to `auth.json`.
- A session may persist the resolved `provider/model` as an audit/reconnect snapshot, but that snapshot is not a configuration source and cannot override the two files.

## `settings.json` model schema

Pigent should retain the useful BeauPi `SettingsManager` fields while narrowing the embedded product surface to model/runtime behavior. The v0.1 model-facing subset is:

```json
{
  "version": 1,
  "defaultProvider": "my-provider",
  "defaultModel": "my-model",
  "defaultThinkingLevel": "medium",
  "enabledModels": [
    "my-provider/my-model"
  ],
  "models": {
    "providers": {
      "my-provider": {
        "name": "My Provider",
        "api": "openai-responses",
        "models": [
          {
            "id": "my-model",
            "name": "My Model",
            "reasoning": true,
            "input": ["text", "image"],
            "contextWindow": 200000,
            "maxTokens": 32000
          }
        ]
      }
    }
  }
}
```

Rules:

- `defaultProvider` and `defaultModel` must resolve to one composed model before an Agent turn starts.
- If either field is absent or invalid, Pigent reports `model_configuration_required`; the UI asks the user to choose and writes both fields to `settings.json` before creating/resuming a model turn.
- Do not silently guess a provider/model from command-line flags, environment variables, browser local storage, project files, previous sessions, or provider iteration order.
- `enabledModels` only filters the chooser/cycling list; it does not replace the explicit default pair.
- Provider/model definitions in `settings.json` compose with the built-in provider catalog shipped in `packages/pigent/ai`.
- `baseUrl`, `apiKey`, OAuth tokens, and secret request headers are rejected from `settings.json`; API address and credentials belong in `auth.json`.

Changing the model in the Pigent UI is a backend configuration mutation: validate the pair, atomically update `settings.json`, reload the host model runtime, and then emit the normal session model-change event. The browser must not keep an independent authoritative default.

## `auth.json` credential schema

Retain BeauPi's provider-keyed credential shape:

```json
{
  "my-provider": {
    "type": "api_key",
    "baseUrl": "https://api.example.com/v1",
    "key": "${MY_PROVIDER_API_KEY}"
  }
}
```

A literal key is also valid, but an explicit environment reference in `auth.json` avoids duplicating a secret. `baseUrl` is the provider's request endpoint and may be omitted only when the built-in provider supplies the intended endpoint. OAuth entries are written by the backend login flow using the copied credential type; raw tokens are never returned to the browser.

Rules:

- one API/auth entry per provider ID;
- each entry may provide `baseUrl` and secret headers plus a supported `api_key` or provider-supported `oauth` credential;
- ambient credentials may satisfy a configured reference, but an ambient environment variable must not silently add/select a provider that has no `auth.json` entry;
- credential commands or environment references are evaluated only in the Pigent host credential resolver, never echoed to logs or model context;
- API keys, OAuth tokens, secret headers, and resolved references are redacted from status, events, exceptions, process argv, and child `bash` environments.

## Embedded BeauPi runtime adaptation

Reuse the copied first-party `SettingsManager`, `ModelConfig`, `AuthStorage`, provider catalog, and OAuth orchestration, but inject exact Pipyter paths, extend the stored credential envelope with the Pipyter-owned provider `baseUrl`/secret-header fields, and remove standalone discovery.

Conceptually the Pigent host creates its model runtime as follows:

```ts
const configDir = startup.userConfigDir; // .../pipyter/pigent
const settingsPath = join(configDir, "settings.json");
const authPath = join(configDir, "auth.json");

const modelRuntime = await ModelRuntime.create({
  authPath,
  settingsPath,
  modelsPath: null,
  modelsStore: new InMemoryCodingAgentModelsStore(),
  allowModelNetwork: startup.allowModelNetwork,
});
```

Required productization changes:

1. Make the host use one global `settings.json`; disable BeauPi project `.beaupi/settings.json` merging for model selection.
2. Pass `modelsPath: null`; remove `getModelsPath()` and `models.json` diagnostics from the shipped host graph.
3. Use an in-memory `ModelsStore`; do not instantiate `FileModelsStore` or write `models-store.json`.
4. Allow an optional remote catalog refresh only in memory. It may update available metadata for the process, but it cannot change `defaultProvider/defaultModel` or persist another model file.
5. Pass `authPath` explicitly to `AuthStorage`; never call the standalone `getAgentDir()` fallback.
6. Compose `auth.json.baseUrl` and secret headers into request-time `ModelAuth`; do not take endpoint authority from `settings.json` or ambient provider variables.
7. Disable `.beaupi`, `.pi`, `BEAUPI_*`, and `PI_*` config discovery/import.
8. Keep Pipyter control-plane login credentials separate from `pigent/auth.json`; provider credentials are never reused as account/node credentials.

## Backend API and browser behavior

Suggested public endpoints:

```text
GET    /api/v1/pigent/config
PUT    /api/v1/pigent/config/model
PUT    /api/v1/pigent/config/providers/{provider_id}
GET    /api/v1/pigent/auth
PUT    /api/v1/pigent/auth/{provider_id}
POST   /api/v1/pigent/auth/{provider_id}/login
DELETE /api/v1/pigent/auth/{provider_id}
```

Contract:

- config reads return validated non-secret model settings and effective file paths;
- auth reads return only provider ID, redacted endpoint origin/label, credential type, and configured/expired status;
- raw API keys, OAuth tokens, and secret headers are write-only;
- every write uses optimistic revision or an equivalent file-generation check so two browser tabs cannot silently clobber each other;
- a successful model change invalidates/rebuilds the in-memory model snapshot and emits one product event;
- unavailable/malformed config prevents Pigent model turns but does not break ordinary Workspace, Notebook, Kernel, or Shell features.

## No automatic legacy inheritance

Pigent v0.1 must not inspect or merge:

```text
~/.beaupi/settings.json
~/.beaupi/auth.json
~/.beaupi/models.json
~/.beaupi/models-store.json
~/.pi/
<project>/.beaupi/
<project>/.pi/
```

Do not add a first-run importer. If an explicit migration command is added later, it must preview the transformation, copy only compatible settings/auth fields, omit model-store/cache/session data, preserve the source, and require the user to confirm.

## Verification

### Installation

- `uv tool install pipyter` exposes `pipyter` and the optional `pigent` launcher from one PyPI distribution.
- Running from the installed tool environment locates bundled Pigent assets through `importlib.resources`, not the source checkout.
- Upgrade preserves the user config directory and does not rewrite valid files.
- Build/install/startup work with `engines/` absent and without a global npm package.

### Files and permissions

- first generic invocation creates only the Pipyter/Pigent directories, and first Pigent config access creates exactly `pigent/settings.json` and `pigent/auth.json` under the resolved root;
- directory/file permissions are `0700/0600` on POSIX;
- concurrent writes do not lose updates;
- malformed JSON is reported with the exact path and remains byte-for-byte unchanged;
- no provider secret appears in logs, events, browser reads, argv, process status, or model context.

### Selection authority

- changing `settings.json.defaultProvider/defaultModel` changes the next resolved model;
- missing/invalid defaults produce `model_configuration_required` rather than a guessed model;
- the UI selector persists through the backend to `settings.json`;
- `auth.json` availability gates the selected provider without selecting a different provider implicitly;
- CLI/env/browser/session/project values cannot override the selected pair;
- `models.json` and `models-store.json` are never read or written;
- deleting `~/.beaupi` or running with an incompatible BeauPi config makes no difference.

## Completion criteria

- User documentation recommends `uv tool install pipyter`.
- Default Pigent configuration resolves to `~/.config/pipyter/pigent/{settings.json,auth.json}`.
- The shipped runtime has exactly two persistent Pigent model-config files.
- `settings.json` owns provider/model choice and non-secret provider protocol/model definitions.
- `auth.json` owns provider API addresses and credentials.
- Model selection has no project, CLI, environment, browser-local, session, `models.json`, or `models-store.json` authority.
- Missing/bad Pigent config disables only Pigent model turns, not the rest of Pipyter.
