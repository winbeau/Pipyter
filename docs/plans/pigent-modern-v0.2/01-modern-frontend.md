# Modern frontend and tool surfaces

## Goal

Make Pigent feel like an operational Web Agent rather than a static dashboard. Preserve the existing React 19 + Vite architecture, public Pigent event contract, and shared dedicated/Workspace components.

The frontend work has two priorities:

1. **Trust:** the user must understand what was requested, what is running, what changed, what failed, and what action is possible.
2. **Density:** rich tool details remain compact by default and expand only when needed.

## Existing assets to keep

Keep and evolve:

```text
web/src/pigent/api.ts
web/src/pigent/store.tsx
web/src/pigent/feed.ts
web/src/pigent/PigentPageView.tsx
web/src/pigent/PigentWorkspacePanel.tsx
web/src/pigent/components/*
packages/protocol/src/pigent.ts
```

The current store already owns sessions, the active session, event IDs, reconnect cursor, mode, tasks snapshot, context, and pending interactions. Do not replace it with a second state library merely for style.

## Information architecture

### Dedicated page

Use three adaptive areas. The existing 236 px session column and 300 px inspector remain the primary 1360×860 design baseline; the ranges below are intentional responsive bounds, not a silent replacement of the v0.1 visual source:

```text
84 px global rail
220–252 px session sidebar (236 px baseline)
minmax(560 px, 880 px) conversation/activity feed
280–320 px optional inspector (300 px baseline)
```

Behavior:

- Collapse the inspector before compressing the feed.
- At narrower desktop/tablet widths, session sidebar becomes a drawer.
- Preserve the 360 px Workspace Pigent panel as a compact density, not a different feature implementation.
- Keep the composer anchored while the feed scrolls.

### Feed grammar

The feed is a conversation interleaved with operational surfaces:

```text
User turn
Assistant prose/thinking summary
Plan/Tasks surface
Tool/delegate/kernel/artifact surface(s)
Interaction surface when needed
Assistant completion summary
```

Do not render a wall of anonymous cards. Group correlated events by `turn_id` and `tool_call_id`; retain timestamps and stable anchors.

## ToolSurface registry

Introduce a small dispatch layer, for example:

```text
web/src/pigent/tool-ui/
├── contract.ts
├── parse.ts
├── registry.tsx
├── actions.tsx
├── receipts.tsx
├── fallback.tsx
├── adapters/
└── surfaces/
```

Each renderer receives a serializable product projection, not raw host data:

```ts
type ToolSurfaceModel = {
  id: string
  toolCallId: string
  tool: PigentToolName
  action?: string
  state: 'queued' | 'running' | 'waiting_for_user' | 'succeeded' | 'failed' | 'cancelled'
  startedAt?: string
  endedAt?: string
  durationMs?: number
  operation?: {
    operationId: string
    kind: string
    phase?: string
    completed?: number
    total?: number | null
    message?: string
  }
  input?: unknown
  output?: unknown
  error?: PublicPigentError
  receipt?: ToolReceipt
  actions?: ToolSurfaceAction[]
}
```

Requirements:

- stable ID and correlation;
- parse/sanitize partially streamed data;
- invalid/incomplete payload falls back safely instead of crashing the feed;
- no callback or React element in persisted/event data;
- renderer derives running/receipt mode from product state, not ad-hoc local booleans.

## Action model

Separate:

```text
Local action
  copy · download · open file · reveal in Workspace · expand
  no Agent continuation and no interaction result

Decision action
  allow once · reject · retry · cancel · confirm delete · select option
  commits a versioned result and may resume the Agent/tool
```

All decision actions need:

- one in-flight action per surface;
- idempotency key;
- disabled/executing state;
- timeout/error feedback;
- destructive second confirmation where appropriate;
- Escape to cancel a pending confirmation;
- an authoritative receipt after resolution.

Do not show Apply/Revert/Undo until their backend semantics exist:

- Apply requires review-before-apply state and a pending change set.
- Revert requires a validated inverse/current revision policy.
- Undo requires a server-owned accepted mutation receipt and conflict behavior.

For v0.2, hide unsupported actions rather than simulating them locally.

## Core surfaces

### `UserMessage`

States:

```text
pending → accepted → running → settled
        ↘ failed → retrying
```

- Add immediately after Send.
- Assign `client_message_id` before request.
- Reconcile with server response/event without duplication.
- Show retry only for a safe failed submission, not for an accepted unknown in-flight mutation.
- Preserve text in memory until accepted; do not persist prompts in localStorage.

### `AssistantMessage`

- Render CommonMark/GFM subset with sanitized links.
- Syntax-highlight fenced code lazily; plain escaped fallback remains available.
- Support streaming without remounting the entire message.
- Separate concise thinking/status text from final answer when the event contract supplies it; do not invent hidden reasoning.
- Add copy at message/code-block level.

### `PlanSurface`

Adapt tool-ui Plan/Progress ideas:

- title, optional description, `done / total`, progress bar;
- pending/active/completed/failed/blocked states with text and icon;
- only the active/failed item expands by default;
- compact density in Workspace panel;
- snapshot revisions update in place without animating every old item.

### `FileSurface`

For `read`, `write`, and `update`:

- operation, path, byte/line facts, revision and status header;
- collapsed text preview with copy/open/reveal;
- diff as unified plain-text renderer initially, split mode only if a vetted dependency is added;
- success receipt states exactly what was changed;
- conflict/error highlights expected/current revisions.

### `CommandSurface`

For `bash` and related process outputs:

- cwd, command, exit code, duration, timeout/cancelled, truncation facts;
- stdout and stderr remain distinguishable;
- ANSI parser optional and isolated;
- bounded default height with line count and Expand;
- Open Shell only when a real TerminalSession reference exists.

### `KernelSurface`

- current environment, kernel status, notebook binding, generation, queue depth;
- code preview for execute, output MIME summaries, error traceback folding;
- restart/interrupt/shutdown receipts;
- environment operation progress (`provisioning`, `syncing`, `promoting`) without pretending it is normal code execution.

### `DelegateSurface`

Build a native surface because tool-ui has no direct equivalent:

- profile/type, task summary, state, duration;
- bounded progress/last activity;
- structured result summary and references;
- failure/timeout/cancelled receipt;
- no child transcript dumping into the main feed.

### `ArtifactSurface`

- image thumbnail with dimensions/MIME/size and Open/Download; the Artifact backend must populate dimensions through a small trusted image-header parser or vetted dependency rather than guessing in React;
- table schema + bounded row preview;
- text/log artifact metadata and Open action;
- stale live-object warning after Kernel generation changes;
- authorization failure/error fallback, never a broken raw URL.

### `ApprovalSurface`

For interaction/clarification/review/handoff:

- clear requested action and consequence;
- source tool and expiry/superseded state;
- real DecisionActions;
- `role="dialog"` while interactive and `role="status"` as receipt;
- Shell/browser handoff opens the referenced destination and records resolution.

### `FallbackSurface`

For an unknown/new tool payload:

- tool name, lifecycle state, bounded input/result JSON, error/cancelled reason;
- collapsible by default;
- must never prevent later feed items from rendering.

## Composer

Required controls:

- auto-growing textarea;
- Send when idle, Stop when a turn is active;
- `Enter` send and `Shift+Enter` newline; `Esc` stops only when focus/IME behavior makes it safe;
- mode selector and model selector with clear authoritative/pending states;
- active context chips and remove/update controls where supported;
- offline/config/payload errors above the composer with one useful recovery action.

Stop behavior:

```text
click Stop
  → immediately disable duplicate Stop
  → POST abort with session/run correlation
  → show “正在停止”
  → settle only on authoritative aborted/settled event or bounded timeout
```

Do not optimistically mark a run cancelled before the server confirms it.

## Sessions and model configuration

### Session sidebar

Add:

- New session;
- search by title;
- workspace filter supplied to the API;
- rename and delete menu;
- running/waiting-for-user/failed/interrupted/completed states;
- date grouping or recency, not an unbounded flat list;
- preserve active selection and cursor when moving between dedicated/embedded views.

Deletion must require confirmation when a session is running or owns pending interaction state.

### Model selector

- Source choices from negotiated `/api/v1/pigent/capabilities` and config health.
- Remove hard-coded authority from both frontend `models.ts` and backend fixed UI pair lists. Choices derive from built-in plus `settings.json` provider/model definitions, filtered by enabled/configured status; local static labels may be fallback display metadata only.
- Show configured/unconfigured status.
- A model change persists through the backend and becomes authoritative on the model-change event.
- Do not silently select another provider if the configured default is unavailable.

## Feed scale and scroll

- Keep an ordered event index keyed by business event ID and a derived turn/surface projection. `reconnect.cursor` is a transport snapshot and must not consume a business event ID.
- Add `before_event_id` or equivalent history paging backed by runtime-local JSONL/segment storage; do not rely on the current 1,000-event in-memory window or `slice(-N)` as the data policy.
- Window rendered old turns when sessions become large; preserve anchor while loading earlier events.
- Follow output only if the user is near the bottom. Show a “new activity” button when scrolled upward.
- Target: 3,000 retained events / 500 visible surfaces without composer lag on a normal development machine.

## Visual system

Keep the current light Pipyter identity while making hierarchy stronger:

- 8 px spacing grid with compact 4 px micro spacing;
- 8–12 px card radius, subtle one-pixel borders, limited shadow;
- orange only for Pigent/action emphasis, blue for selection/notebook, cyan for Kernel, purple for delegate;
- mono only for code, commands, paths, IDs, and numeric runtime facts;
- no ornamental gradients or continuous pulsing;
- one primary button per decision surface;
- running animation respects `prefers-reduced-motion`.

Use CSS variables and component variants. Do not add Tailwind solely to copy tool-ui.

## Accessibility

- full keyboard path through sidebar, feed actions, mode/model, composer, dialogs;
- visible focus ring;
- status text in addition to color;
- `aria-live="polite"` for run/tool progress, assertive only for blocking failure;
- `aria-busy` for executing surfaces;
- touch targets at least 44×44 on touch layouts;
- dialogs label title/description and return focus on close;
- sanitized Markdown and external-link disclosure;
- reduced motion and 200% zoom checks.

## Suggested file changes

```text
web/src/pigent/api.ts
web/src/pigent/store.tsx
web/src/pigent/feed.ts
web/src/pigent/types.ts
web/src/pigent/components/Composer.tsx
web/src/pigent/components/SessionList.tsx
web/src/pigent/components/ToolActivityCard.tsx      # retire into registry/surfaces
web/src/pigent/components/InteractionCard.tsx       # retire into ApprovalSurface
web/src/pigent/tool-ui/*                            # new
web/src/pigent/components/UserMessage.tsx           # new
web/src/pigent/components/AssistantMessage.tsx      # new
web/src/styles.css
web/package.json
```

Add dependencies only when they replace meaningful custom risk. Likely acceptable:

- a small Markdown renderer/sanitizer;
- a compact ANSI parser;
- Vitest and Testing Library.

Defer xterm.js because the user request targets Pigent; replace the current pseudo-terminal in a separate Shell-focused slice unless Agent handoff requires it for correctness.

## Verification

### Unit/component

- reducer event de-duplication and reconnect cursor;
- optimistic user message reconciliation and retry;
- assistant delta coalescing;
- ToolSurface parse/fallback behavior on partial/unknown data;
- action lock, confirmation, failure, and receipt transition;
- interaction required/resolved/superseded;
- model list/configured state;
- history paging/scroll anchor helpers.

### Browser flows

At 1440×900, 1360×860, 1024×768, and a 390 px mobile viewport:

1. create session and send a message;
2. user message appears immediately;
3. stream assistant text and one running tool surface;
4. stop run and receive aborted receipt;
5. complete an interaction decision;
6. render file diff, command output, delegate, Kernel, and image artifact fixtures;
7. switch dedicated ↔ Workspace panel without duplicate events;
8. rename/search/delete a session;
9. load earlier history while preserving scroll;
10. disconnect/reconnect and resume after cursor.

### Acceptance

- No visible control lacks a working handler.
- No raw provider secret, bridge token, or host RPC payload appears.
- Feed remains responsive with the target long-session fixture.
- Shared surfaces are imported by both Pigent page variants.
- `pnpm typecheck`, `pnpm build`, unit/component tests, and Playwright flows pass.
