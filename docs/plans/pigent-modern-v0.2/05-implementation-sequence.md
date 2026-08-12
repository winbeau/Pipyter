# Implementation sequence and acceptance gates

## Delivery rule

Implement vertical slices that remain runnable at each milestone. Do not spend the first phase on a broad visual rewrite while the local Pigent host is unavailable or visible controls are nonfunctional.

Use the smallest targeted checks after each change, plus repository-required checks before milestone closure.

## Phase 0 — Freeze baseline and contracts

### Work

- Add this v0.2 plan to the plan index/README only when implementation begins.
- Record current local/AutoDL runtime facts in a non-secret implementation issue or test fixture.
- Freeze ToolSurface state, receipt, decision, user-message correlation, environment summary, operation lifecycle, Kernel summary, and error contracts.
- Freeze asynchronous Kernel environment tool semantics: accepted tool result, correlated operation events, final receipt, and `operation_status` polling.
- Bump the tool/event protocol for the expanded Kernel action/capability/event/error unions and define the compatibility window.
- Make verified host handshake capabilities authoritative through intersection with Python's supported ceiling; an old/missing payload cannot advertise v0.2 actions.
- Freeze `kernel.environment.read/manage` capabilities and synchronized Ask/Plan/Auto filters.
- Freeze uv minimum-version and missing/incompatible degradation behavior.
- Record `/tmp/tool-ui` provenance and whether any source is copied versus reimplemented.
- Add deterministic event fixtures for all ten tools, interactions, artifacts, abort, and environment operations.

### Checks

- Python/TypeScript golden fixtures round trip, including host-handshake capability intersection.
- Unknown state/action/protocol rejected and an old payload cannot expose a new action.
- Secret redaction fixtures.
- No raw AutoDL credential in Git diff or generated fixture.

### Exit

Frontend and backend can implement without inventing fields independently.

## Phase 1 — Reproducible local Agent and DS migration

### Work

- Fix source-mode Pigent payload discovery/build workflow.
- Extend doctor/capabilities with payload, Node, and uv version/error facts.
- Flip normal Pigent demo fallback off; demo becomes an explicit design mode.
- Make Vite's Runtime proxy target configurable and align it with the documented local port.
- Implement provider-scoped SSH migration preview/apply/rollback.
- Back up local config and migrate DeepSeek only.
- Start repository Pipyter locally and perform Ask smoke.

### Focused checks

- payload manifest/hash validation;
- source checkout and built-wheel host handshake/capability negotiation;
- uv minimum/missing/incompatible diagnostics and non-environment feature degradation;
- migration preview redaction;
- pair-transaction interruption/recovery;
- config permissions/revisions;
- real local Ask response with AutoDL disconnected afterward.

### Exit

Local Pigent is real, configured, independently usable, and reproducible by another developer without manual secret file editing.

## Phase 2 — Conversation trust slice

### Work

- Add `client_message_id` and optimistic UserMessage projection.
- Wire real Stop/Abort.
- Add interaction-resolution endpoint and ApprovalSurface.
- Remove or hide unsupported mutation actions.
- Render assistant Markdown/code and clear error/config/payload states.
- Add authoritative run/turn correlation and receipts.

### Focused checks

- send success/failure/retry/idempotency;
- stop before tool, during tool, after settle;
- reconnect during stopping;
- interaction allowed/rejected/superseded;
- unknown surface fallback;
- sanitized Markdown/links.

### Exit

No visible dead control exists; a user can send, stop, retry safe failures, resolve an interaction, and reconnect without ambiguity or duplication.

## Phase 3 — ToolSurface visual slice

### Work

- Add ToolSurface registry and shared action/receipt primitives.
- Implement Plan, File/Diff, Command, Kernel, Delegate, Artifact, Approval, and Fallback surfaces.
- Use compact/full density variants in Workspace/dedicated views.
- Add copy/open/download/expand local actions.
- Add status/timestamp/duration/truncation facts.

### Focused checks

- component fixtures for queued/running/succeeded/failed/cancelled/superseded;
- partial streamed payloads do not crash;
- one primary action and action execution lock;
- reduced motion and keyboard focus;
- dedicated/embedded imports share implementations.

### Exit

All tool families are readable and operational in both Pigent surfaces.

## Phase 4 — Sessions, models, artifacts and scale

### Work

- Complete session new/rename/delete/search/workspace filtering.
- Add history paging from persisted JSONL/segments beyond the 1,000-event in-memory window and feed windowing; reconnect cursor events do not consume business event IDs.
- Replace model-list authority in both frontend and backend fixed lists with composed settings/provider catalog plus config availability.
- Add artifact image/table previews.
- Add follow-output/new-activity behavior, timestamps, empty/loading/error states.

### Focused checks

- API authorization/filter/paging across restart and beyond 1,000 events;
- cursor consistency across view switches without transport cursor event-ID holes;
- 3,000-event fixture responsiveness;
- model configured/unconfigured and authoritative change event;
- artifact authorization/stale/error rendering;
- running-session delete conflict.

### Exit

A long, multi-session research workflow is usable rather than merely visually improved.

## Phase 5 — KernelSessionRegistry correctness

### Work

- Centralize per-kernel queue/worker.
- Add complete lifecycle states, generation, queue depth, activity, dead detection.
- Add notebook binding.
- Route REST, Workspace, Notebook, Inspect, and Pigent through the same execution authority.
- Add idle/dead cleanup and process ownership facts.

### Focused checks

- two concurrent executes serialize and outputs correlate;
- Notebook and Inspect compete safely;
- interrupt/timeout/death/restart/shutdown behavior;
- generation invalidates live references;
- dirty notebook/context binding behavior;
- existing Kernel/API/Notebook/Inspect tests stay green.

### Exit

Kernel execution is correct enough to safely add environment provisioning and selection.

## Phase 6 — Temporary uv environments

### Work

- Add config-root registry/metadata/kernelspec modules.
- Add accepted asynchronous provision operation, correlated operation events, `operation_status`, and final receipts.
- Implement create/list/start/delete temporary environment.
- Add TTL/last-use reaper and failed-operation cleanup.
- Add Web environment manager and Pigent KernelSurface projection.

### Focused checks

- real uv temp environment creation and immediate accepted-operation response;
- operation event/tool correlation and `operation_status` final receipt;
- `ipykernel` import and `sys.executable` proof;
- paths with spaces/Unicode;
- cancellation/failure/recovery;
- active/busy TTL exclusion;
- no global kernelspec; no provider credentials in child environment.

### Exit

Pigent or the user can create a disposable environment, start a bound Kernel, run code, and allow it to expire safely.

## Phase 7 — Maintained uv environments and promotion

### Work

- Add create/sync/repair/start/promote/delete maintained environment.
- Support explicit packages and workspace project source.
- Add stale/lock revision detection.
- Persist/reconstruct registry across Runtime restart.
- Manage several environments in Web Kernel chooser.

### Focused checks

- two maintained environments with distinct interpreters/package facts;
- restart rediscovery and Kernel start;
- temporary promotion preserving definition;
- sync revision conflict and stale detection;
- active Kernel delete conflict;
- explicit confirmed shutdown-then-delete;
- no automatic maintained deletion or uv-cache manipulation.

### Exit

The user can maintain multiple reproducible environment definitions under the Pipyter config root and select them from Workspace or Pigent.

## Phase 8 — Quality and release candidate

### Work

- Add Vitest/Testing Library and Playwright suite.
- Add lint/format if adopted by the repository.
- Add migration, Kernel environment, browser, package, and clean-install CI checks.
- Update README/operator docs/third-party notices/changelog/version only when release is intended.
- Inspect generated web/Pigent payloads and wheel/sdist.

### Required commands

Repository-required final checks remain authoritative. Expected core set:

```bash
uv run pytest
node packages/pigent/scripts/check-engine-independence.mjs
# Pigent host typecheck/tests/build using repository scripts
cd web && pnpm typecheck && pnpm test && pnpm build
# Playwright targeted Pigent flows
uv build
# clean wheel and uv tool install smoke
```

Do not rerun an unchanged broad suite after every small edit. Run targeted failures first; run the full gate at milestone/release closure.

### Exit

The change is ready for a versioned release candidate, not automatically published.

## Browser acceptance matrix

### Viewports

```text
1440×900 primary desktop
1360×860 design comparison
1024×768 compact desktop/tablet
390×844 narrow/mobile fallback
```

### Flows

1. Start local integrated runtime and verify config/payload health.
2. Create an Ask session and stream a response.
3. Start Auto task with Tasks + file update + command verification.
4. Stop a long run; receive aborted receipts.
5. Resolve an interaction/handoff.
6. View an image artifact and a table artifact.
7. Switch dedicated ↔ Workspace panel without session/event reset.
8. Rename/search/delete sessions and page old history.
9. Create/start temporary environment; run Notebook cell.
10. Promote to maintained; restart Runtime; select it again.
11. Start second maintained environment and verify interpreter isolation.
12. Simulate provider/network/host/kernel failure and recover.

## Performance budgets

Measure, do not merely assert:

- first usable Pigent shell from local cached build: target under 2 seconds excluding initial package/payload build;
- composer keystroke/render with 3,000 retained events: no visible sustained lag, target p95 under 50 ms in development benchmark;
- event-to-visible running update on local loopback: target under 100 ms excluding model/provider latency;
- history page append preserves scroll anchor within a few pixels;
- environment creation progress begins within 500 ms even if uv installation takes minutes;
- no unbounded API/event payload or DOM growth.

Budgets are release targets, not reasons to hide operation progress or truncate silently.

## Security acceptance

- Git scan and archive inspection find no copied AutoDL key/token.
- Browser config/auth endpoints remain redacted/write-only.
- Migration preview/logs/manifest redact credentials.
- Provider/bridge/runtime proxy credentials absent from uv and Kernel child environments.
- Environment paths cannot escape the config root.
- Cross-workspace Kernel/environment/session access fails.
- SSH migration uses trusted OpenSSH identity without collecting secrets.
- Config/backups/Kernel metadata permissions are restrictive.

## Regression acceptance

Keep green:

- file reads/writes/revisions;
- Notebook stable IDs, mutation conflict, outputs;
- existing Kernel lifecycle API compatibility;
- Inspect variables/DataFrame/Figure;
- persistent Shell sessions/reconnect/split;
- Ask/Plan mutation denial and Auto allow;
- remote Runtime token and WebSocket security;
- Pigent host packaging/engine independence;
- Pi5/AutoDL runtime routing paths.

## Release checklist

1. All milestone exit gates are evidenced.
2. Local DS works with AutoDL offline.
3. Source and built-wheel Pigent payload paths work.
4. Exactly ten public tool names are advertised.
5. New Kernel actions match mode filters.
6. At least two maintained environments survive restart.
7. No visible dead frontend action exists.
8. Long feed and reconnect behavior pass.
9. Third-party notices/provenance are complete.
10. Version/changelog/package artifacts are consistent.
11. Publication still waits for explicit user approval.
