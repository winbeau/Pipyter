# Risk register, security and rollback

## Goal

Identify the assumptions most likely to fail and define a bounded rollback for each major subsystem before implementation changes local credentials, Kernel environments, public protocols, or the frontend event model.

## Risk summary

| Risk | Impact | Mitigation | Rollback |
| --- | --- | --- | --- |
| AutoDL secret leaks during migration | critical | preview redaction, pipe-only transfer, no shell, private backups/log policy | revoke provider key, restore local backup, scrub logs/artifacts |
| local config pair partially replaced | high | lock, staged validation, transaction journal, recovery tests | automatic or explicit restore from migration backup |
| source mode loads stale/wrong Node payload | high | manifest/hash/protocol verification, exact dev resolver | disable source payload path; run built wheel |
| Python advertises actions an old/missing host cannot execute | high | handshake-authoritative capability intersection and protocol bump | hide v0.2 actions; require rebuilt payload |
| Agent waits indefinitely on uv work or uses an unfinished environment | high | accepted async operation + correlated events + `operation_status` | cancel where safe; keep environment unavailable until ready |
| frontend optimistic state diverges | medium/high | client IDs, authoritative events, idempotency, receipt projection | feature flag new projection; fall back to stable event feed |
| new actions duplicate accepted mutation | high | idempotency keys and unknown-state policy | stop retry; surface unknown outcome for manual verification |
| Kernel outputs cross between requests | critical correctness | one queue/worker owner before uv environments | disable concurrent execute; revert to one active request per kernel |
| temporary reaper deletes active work | high | active/busy/operation references, conservative TTL, rename-to-trash | disable reaper; restore metadata/env from trash if retained |
| maintained environment becomes unreproducible | medium | definition/lock revision, explicit sync, stale state | keep prior environment/metadata backup; start old interpreter |
| package install executes hostile code | inherent high | explicit consequence, runtime-user boundary, structured argv, audit | cancel/delete environment; no sandbox claim |
| uv is missing/incompatible on a deployment | medium | tested minimum, doctor/capabilities finding, optional subsystem boundary | disable environment management; keep legacy/system Kernel path |
| global kernelspec pollution | medium | private kernelspec only, tests | remove accidental global spec; disable project spec registration |
| protocol change breaks AutoDL/older UI | high | capability negotiation and compatibility tests | hide new UI/actions; continue v0.1 contract |
| tool-ui copy creates dependency/license burden | medium | copy minimal MIT files or reimplement patterns; provenance | remove copied source and keep internal implementation |
| web redesign regresses Workspace/Shell | medium | feature boundaries and browser regression suite | revert Pigent feature bundle independently |
| remote duplicate Runtime processes persist | medium ops | single-instance/pid ownership follow-up | stop stale parents; retain known listening service |

## Secret migration boundary

### Threats

- command-line exposure through `ps`;
- terminal/log output containing JSON/auth keys;
- temporary files with broad permissions;
- exception repr of secret-bearing dicts;
- copying extra remote state;
- backups forgotten indefinitely;
- browser config reads returning secret data.

### Controls

- SSH alias/target only; no password/private-key collection;
- secret transfer over inherited stdin/stdout pipes;
- no shell wrappers or interpolated command strings;
- write through the existing redacting config service;
- destination and backup directories `0700`, files `0600`;
- remote envelope supports provider filtering;
- preview includes only credential type/availability and endpoint facts;
- literal key objects use redacted wrappers/custom repr where practical;
- test logs and captured CLI output for recognizable secret fixtures;
- backup prune command with explicit retention documentation.

### Incident response

If a real provider credential appears in chat, Git, logs, browser payload, or a non-private artifact:

1. stop migration/runtime that may continue emitting it;
2. revoke/rotate the provider credential;
3. restore valid local config using the new key;
4. remove leaked files/logs from working tree and build artifacts;
5. assess Git history/cache and rewrite only if committed;
6. add a regression fixture matching the leak path.

Do not treat deletion of the local file as sufficient once a credential was exposed externally.

## Configuration rollback

Every applied migration has:

```text
migration ID
source alias and sanitized version facts
selected provider IDs
pre/post revisions
backup paths and hashes
transaction state
```

Rollback guarantees:

- no source AutoDL modification;
- restores both local config files as a pair;
- preserves mode/ownership;
- refuses to overwrite later changes without explicit forced preview;
- leaves a recovery audit record without secret values.

Failure during apply:

```text
before first replace      remove stages; active config unchanged
after one replace         recovery journal restores backup pair
post-write validation     restore backup pair; preserve failure diagnostics
process killed            next config access detects prepared transaction
```

## Frontend rollout and rollback

Use feature seams rather than a permanent maze of flags.

Suggested temporary rollout controls:

```text
modernFeedProjection
kernelEnvironmentManager
```

Rules:

- enabled in development/test first;
- old Pigent page may remain for one migration phase but must not receive new features;
- both dedicated/embedded modern views share the same projection;
- remove flags after release stabilization;
- never maintain duplicate API/event stores long term.

Rollback options:

- keep backend additive while hide new surfaces/actions from capabilities;
- revert ToolSurface registry to existing `ToolActivityCard` renderer;
- retain accepted message/operation schema because data rollback is harder than renderer rollback;
- do not delete session/event data during frontend rollback.

## Kernel environment rollback

### Registry/metadata changes

- write atomic revisions;
- retain the previous metadata generation or reconstruct from per-environment files;
- if registry corrupt, scan known `temporary/maintained` directories in read-only recovery mode;
- never infer and delete an unknown directory automatically.

### Provision/sync

Create new environment content in a staging directory and publish by atomic rename only after interpreter/ipykernel validation.

For maintained sync, preferred safe policy:

```text
build/sync staged replacement
→ validate
→ ensure no active kernel or require restart decision
→ swap current to backup, staged to current
→ start/verify if requested
→ delete backup after retention window
```

Avoid mutating the only working maintained environment in place when practical. If disk cost requires in-place sync initially, mark the limitation and preserve metadata/lock plus clear failure state; do not claim transactional package rollback.

### Promotion

- no live Kernel under the environment path;
- same-filesystem rename preferred;
- registry commit after target metadata is valid;
- on conflict/failure, temporary source remains usable;
- do not delete source until maintained target is committed.

### Delete

- explicit active Kernel check;
- rename to private trash before recursive deletion;
- bounded retention permits recovery from UI/operator mistakes;
- temporary GC can shorten retention but never bypass active references;
- maintained delete always requires confirmation.

## Kernel execution safety

### Correctness threats

- multiple clients consuming one IOPub queue;
- interrupt/restart races;
- stale Notebook outputs written after source changes;
- stale figure/variable references after restart;
- dead Kernel reported as busy until timeout;
- Runtime exit leaving child processes.

### Controls

- one queue/worker per Kernel;
- parent message correlation inside that owner;
- document revision check before output commit;
- generation attached to live references;
- explicit state transition table;
- heartbeat/process monitoring;
- shutdown ownership and orphan reconciliation tests;
- bounded output/artifact offload.

State transition examples:

```text
starting → idle | dead
idle → busy | restarting | stopping
busy → idle | dead | stopping
restarting → idle | dead
stopping → removed | dead
```

Unknown state is an error; do not force `idle` after every interrupt regardless of the process.

## Package-install boundary

A uv-managed environment is not a sandbox. Installing packages can:

- execute package build hooks;
- access network/files as the Runtime user;
- consume large disk/CPU time;
- install native code.

Product behavior:

- explain package/Python/source before creation/sync;
- show operation progress and cancellation limits;
- record requested package intent and outcome;
- enforce size/count/time/output operational bounds where possible;
- rely on OS/container identity for real multi-user isolation;
- do not advertise package safety guarantees Pipyter does not enforce.

## Storage/resource risks

### Disk growth

Sources:

- multiple uv environments;
- package caches;
- Pigent sessions/events/artifacts;
- migration backups;
- operation logs/trash.

Controls:

- report per-environment size on demand or asynchronously;
- temporary TTL and trash retention;
- bounded logs/events/artifacts;
- explicit backup/environment cleanup UI/CLI;
- do not delete uv's shared cache automatically;
- warn before large sync based on available disk when measurable.

### Process growth

- one active Kernel session per notebook by default;
- list all running sessions in Running panel;
- optional idle Kernel TTL distinct from environment TTL;
- normal Runtime shutdown cleans owned kernels;
- single-instance lock for remote `node serve` should be a deployment follow-up.

## Compatibility rollback

### Older frontend with newer Runtime

- additive fields ignored;
- old Kernel actions continue;
- environment resources are simply invisible.

### New frontend with older Runtime

- capabilities lack environment actions/resources;
- hide manager and show “Runtime upgrade required”;
- modern conversation surfaces still work on v0.1 events through fallback mapping.

### Host/runtime mismatch

- strict protocol handshake and host-advertised action/capability intersection;
- disable v0.2 Agent actions/turns with exact mismatch diagnostic rather than returning Python's static new catalog;
- Workspace/Notebook/Shell and legacy system Kernel behavior remain available;
- never attempt a best-effort mutating tool call across incompatible schemas.

## Third-party provenance

If copying tool-ui source:

- capture source repository URL and commit/date;
- retain MIT copyright/license;
- list exact copied/adapted files;
- keep them behind a Pipyter adapter boundary;
- audit transitive dependencies separately;
- avoid `@pierre/diffs` until licensing is confirmed.

If only reimplementing design patterns, document inspiration and avoid copying substantial source verbatim; a bundled source notice may not be required, but repository policy should make that decision explicit.

## Rollback drills

Before release candidate, exercise:

1. migrate DeepSeek, then rollback to the original local placeholder config;
2. kill migration after the first file replacement and recover;
3. disable new frontend projection while retaining new event data;
4. kill Runtime during temporary provisioning and clean/recover;
5. fail maintained sync and start the prior environment;
6. attempt active-environment delete and confirm no data/process loss;
7. restart Kernel and verify stale live references are blocked;
8. run new frontend against a v0.1 capabilities fixture;
9. run old frontend fixture against new additive Runtime;
10. remove source payload and confirm precise fallback to package/doctor behavior.

## Release stop conditions

Stop the release if any of these remains true:

- a real AutoDL credential appears in any repository/log/browser/test artifact;
- local DS success depends on AutoDL remaining online;
- source mode can load an unverified/stale Pigent payload;
- visible frontend actions lack backend semantics;
- Kernel callers still have independent lock ownership;
- an asynchronous operation can be mistaken for completed before its final receipt, or a temporary reaper can delete an active environment;
- maintained environment sync/delete has no documented failure recovery;
- global Jupyter kernelspecs are created;
- protocol mismatch or static Python capabilities can expose/execute an unsupported mutating call;
- copied MIT source lacks attribution;
- required tests or clean-install smoke fail;
- publication lacks explicit user approval.
