# Pigent and Shell UI migration

## Goal

Replace the existing Pilot-labelled/static UI with the Pigent and Shell design defined by:

- `design/Pipyter.dc (1).html`
- `design/PipyterPigent.dc (1).html`
- `design/PipyterWorkspace.dc (1).html`

The migration must deliver one coherent React implementation rather than copying each HTML file into a separate monolithic component.

## Design source priority

When current React behavior and the new HTML differ, use this order:

1. the three named HTML design files for product layout, labels, colors, dimensions, and visible states;
2. the existing React Workspace for working notebook/file/kernel behavior;
3. the Pigent protocol plans for live session/event semantics;
4. deterministic demo data only when the Runtime API is unavailable.

The new design already establishes the final mode selector: **Ask / Plan / Auto**. Do not reintroduce a fourth segment.

## Current-to-target gap

| Area | Current implementation | Target |
| --- | --- | --- |
| Main route | `#/pilot` | `#/pigent` |
| Navigation label | Agent | Pigent |
| Dedicated page | old brown/dark `PilotDesign` | light Pigent session workspace from `PipyterPigent` |
| Workspace right panel | dark static `PilotPanel`, collapsed rail | 360 px light Pigent panel toggled from the document tab bar |
| Modes | no real selector in Workspace panel | Ask / Plan / Auto in both Pigent surfaces |
| Activity | hard-coded task/diff/terminal blocks | shared Tasks, tool, delegate, output, diff, interaction cards driven by events |
| Terminal | one local line buffer + one-shot HTTP execute | persistent multi-session Shell panel with tabs and streamed PTY output |
| Shell actions | clear and close | new, select, clear, split, maximize/restore, close |
| CSS names | `--pilot-*`, `.ws-pilot-*` | `--pigent-*`, `.ws-pigent-*` |
| Static assets | generated bundle may contain old labels | rebuild only after source migration passes |

## Visual tokens

Promote the inline design values into shared CSS variables. Keep one source of truth in `web/src/styles.css` or a focused token module used by both page and Workspace components.

```css
--bg: #f7f6f3;
--surface: #ffffff;
--surface-2: #f1f1ef;
--surface-hover: #f1f1ef;
--border: #edece9;
--border-strong: #dcdad4;
--text: #37352f;
--text-2: #787774;
--text-3: #9b9a97;
--accent: #2383e2;
--accent-soft: #e3f2fd;
--accent-dark: #0d47a1;
--pigent: #d9730d;
--pigent-soft: #fff0e5;
--pigent-dark: #a64b18;
--success: #0f7b6c;
--success-soft: #e4f0ee;
--danger: #c33f31;
--danger-soft: #f9e6e3;
--mono: menlo, consolas, "IBM Plex Mono", monospace;
```

Migration rules:

- rename every product CSS token from `pilot` to `pigent`;
- retain orange for Pigent active/running/mutation emphasis;
- retain blue for general selection, Notebook controls, and Terminal toggle state;
- use light surfaces for the new Pigent panel and Shell; remove the current dark sidebar/terminal visual system from these surfaces;
- keep tool-family colors consistent across dedicated and embedded views:
  - workspace/read/view: blue;
  - mutation/bash: Pigent orange;
  - delegate: purple;
  - notebook/kernel: cyan/blue;
  - success/error: green/red;
- prefer CSS classes and reusable variants over repeated inline style objects.

## Global shell and routing

`Pipyter.dc` defines the product shell:

- navigation rail width: 84 px;
- items: Home, Workspace, Figures, Pigent, Settings;
- Pigent uses the orbit-style icon in the design;
- canonical route: `/pigent`.

Migration:

1. Change `PageId` from `pilot` to `pigent`.
2. Replace the Agent label with Pigent.
3. Rename `PilotPage` to `PigentPage` and `PilotDesign` to product components under a Pigent feature directory.
4. Make `#/pigent` canonical.
5. Keep one compatibility redirect from `#/pilot` to `#/pigent` for old bookmarks; never render Pilot text after redirect.
6. Update Home, Figures, Settings, aria labels, titles, placeholders, comments, icons, tests, and demo strings.

Recommended feature layout:

```text
web/src/pigent/
├── api.ts
├── types.ts
├── store.tsx
├── demo.ts
├── components/
│   ├── ModeSelector.tsx
│   ├── SessionList.tsx
│   ├── PigentHeader.tsx
│   ├── ContextChips.tsx
│   ├── TaskCard.tsx
│   ├── ToolActivityCard.tsx
│   ├── InteractionCard.tsx
│   ├── Composer.tsx
│   └── DetailPanel.tsx
├── PigentPageView.tsx
└── PigentWorkspacePanel.tsx
```

Do not keep separate implementations of task/tool/interaction cards in the dedicated page and Workspace panel. Use density/size variants.

## Dedicated Pigent page

`PipyterPigent` establishes three columns.

### Session column

- fixed width: 236 px;
- current Workspace summary at the top;
- recent Pigent Sessions list;
- each row shows title, mode, and lifecycle state;
- selected/running row uses `--pigent-soft` and `--pigent-dark`;
- states include running, completed, failed, interrupted, and waiting-for-user.

Data source:

```text
GET /api/v1/pigent/sessions?workspace_id=...
```

Selecting a row changes the active session without recreating it.

### Main activity column

- header height: 52 px;
- Pigent identity and running state;
- Ask/Plan/Auto segmented selector;
- concise mode hint;
- detail-panel toggle;
- content max width: 880 px;
- sticky composer at the bottom.

The activity feed renders product events, not raw internal Pigent runtime RPC messages:

- session title and context chips;
- Tasks card and progress;
- tool start/update/end;
- delegate result;
- diff/update result with Revert/Undo after normal Auto execution; show Apply/Revert only when the user explicitly enabled optional review-before-apply;
- Kernel output;
- visual artifact preview;
- interaction/PTY handoff;
- assistant text and final summary.

Virtualize or window long sessions after the initial implementation. The composer and currently running card must remain responsive while older events load.

### Detail column

- width: 300 px;
- hidden by default and toggled from the header;
- context chips;
- active model;
- effective tool list for Ask/Plan/Auto;
- runtime execution identity;
- recommended next actions.

At widths where all columns do not fit, close the detail column before shrinking the central feed. The 1360×860 design is the baseline visual fixture.

## Workspace Pigent panel

`PipyterWorkspace` replaces the current dark static panel.

Target behavior:

- width: 360 px;
- light `--surface` background;
- 40 px header;
- Pigent icon/name, running state, Ask/Plan/Auto selector, close chevron;
- context-chip row below the header;
- scrollable Tasks and Tool Activity feed;
- interaction card near the relevant tool event, used for PTY/browser handoff or an explicitly enabled review preference rather than a mandatory Auto command gate;
- composer fixed at the bottom;
- the document tab bar owns the Pigent toggle;
- closing the panel removes the entire right column; do not leave the old 40 px vertical `PILOT` rail.

The tab-bar toggle and dedicated page must point to the same active Pigent session. Opening `/pigent` should preserve that session and its event cursor.

State to persist locally or in session summary:

```text
pigentOpen
pigentMode
activePigentSessionId
pigentDetailOpen (dedicated page only)
lastPigentEventId
```

Do not persist provider credentials, prompts, or full event content in browser local storage.

## Shared mode selector

One `ModeSelector` component renders the exact Ask/Plan/Auto order in both surfaces.

Mode hints:

- Ask: `只分析回答，不修改或执行`
- Plan: `分析并生成 Tasks，不执行修改`
- Auto: `以当前 Runtime 用户身份自主执行`

Switching modes calls the Pigent session API and waits for the authoritative session event before updating the active state. Optimistic highlighting may be used only while clearly marked pending.

## Shell design

The new bottom panel is a user Shell, not the Pigent `bash` tool transcript.

Target geometry:

- default height: 220 px;
- header: 34 px;
- content: light surface with mono font;
- footer: 24 px;
- resizable vertically with a persisted height;
- maximize/restore fills the document area without covering the global menu/status bar.

### Shell tabs

Each tab represents a real persistent process/session:

```text
ShellSession
  id
  name
  executable
  cwd
  status
  cols
  rows
  created_at
  last_exit_code
```

Initial tabs may be `bash` and `python` as in the design, but labels come from actual sessions. The `+` action creates a new default Shell or opens a small profile menu.

Do not implement multiple visual tabs over one shared `terminalLines` array.

### Shell actions

- select tab;
- create session;
- clear visible buffer without killing the process;
- split horizontally/vertically using two session panes;
- maximize/restore;
- close session with running-process confirmation when needed;
- resize PTY on panel/pane changes;
- preserve sessions across browser reconnect while the runtime remains alive.

Keyboard requirements:

- normal terminal key input is delivered to the active PTY;
- tab switching has a non-conflicting shortcut;
- browser shortcuts do not capture Ctrl+C/Ctrl+D when terminal focus is active;
- focus returns to the terminal after tab/split operations.

### Runtime/API migration

The current `/api/v1/terminals/execute` uses `subprocess.run` per command and cannot implement the design. Keep it temporarily for the Pigent `bash` tool and compatibility tests, but add a persistent Shell session API:

```text
GET    /api/v1/terminals
POST   /api/v1/terminals
GET    /api/v1/terminals/{session_id}
DELETE /api/v1/terminals/{session_id}
POST   /api/v1/terminals/{session_id}/resize
WS     /api/v1/terminals/{session_id}/stream
```

The WebSocket carries binary/text PTY output and client input with a small versioned control envelope for resize, status, exit, and replay cursor.

Recommended owner:

```text
src/pipyter/terminal/session_manager.py
```

It may adapt the Jupyter/terminado terminal stack already available with JupyterLab, or a platform adapter behind one interface. Do not make the React client own command execution state.

The human Shell and Pigent `bash` share:

- runtime OS identity;
- cwd/environment construction;
- process ownership and cleanup;
- audit/session listing.

They differ in interaction model:

- human Shell: persistent PTY and raw user input;
- Pigent `bash`: structured tool lifecycle, bounded captured result or an explicit PTY attachment when interactive.

### Shell status footer

Render actual facts:

- connection/running dot;
- executable/version where available;
- cwd or profile;
- last exit code;
- duration;
- encoding.

Do not hard-code `bash 5.2`, `zsh-compatible`, or `exit 0` in API mode.

## Event and state mapping

The Pigent UI consumes the public event contract from `04-runtime-bridge.md`.

Recommended client stores:

```text
PigentStore
  sessions
  activeSessionId
  mode
  status
  tasksSnapshot
  eventsById
  pendingInteractions
  context
  lastEventId

ShellStore
  sessions
  activeSessionId
  panes
  outputBuffers
  connectionState
  panelHeight
  maximized
```

Keep Pigent state separate from `WorkspaceState`; connect them through active document/cell/kernel context selectors. This avoids turning the existing Workspace reducer into a single oversized store.

## File migration map

| Existing file | Planned action |
| --- | --- |
| `web/src/App.tsx` | route and component rename to Pigent; old route redirect |
| `web/src/components/NavigationRail.tsx` | Pigent PageId/label/icon and 84 px rail styling |
| `web/src/pages/PilotPage.tsx` | replace with `PigentPage.tsx` |
| `web/src/design/pages/PilotDesign.tsx` | retire after extracting new design into reusable components |
| `web/src/pages/WorkspacePage.tsx` | rename panel state/props to Pigent and connect session state |
| `web/src/workspace/WorkspaceApp.tsx` | new Pigent/Terminal toggles and panel layout |
| `web/src/workspace/components/PilotPanel.tsx` | replace with shared `PigentWorkspacePanel` |
| `web/src/workspace/components/TerminalPanel.tsx` | replace line-input UI with session tabs, panes, PTY renderer |
| `web/src/workspace/store.tsx` | remove single terminal buffer ownership; retain Workspace document state |
| `web/src/workspace/types.ts` | remove old single-buffer terminal types after ShellStore lands |
| `web/src/workspace/api.ts` | add Pigent and persistent terminal clients/streams |
| `web/src/workspace/icons.tsx` | `IconPigent` and Shell action icons |
| `web/src/styles.css` | token rename and new Pigent/Shell component styles |
| `web/src/design/pages/HomeDesign.tsx` | Pilot text → Pigent |
| `web/src/design/pages/FiguresDesign.tsx` | Ask/mini-panel text and state → Pigent/shared component |
| `web/src/design/pages/SettingsDesign.tsx` | Pigent model/permission wording and three-mode settings |
| `packages/protocol/src/index.ts` | Pigent session/events and Shell session contracts |
| `src/pipyter/terminal/manager.py` | split compatibility execute from persistent session manager |
| `src/pipyter/server/app.py` | add terminal session WebSocket/lifecycle and Pigent routes |
| `src/pipyter/static/` | regenerate only after source build passes; remains ignored |

## Migration phases

### UI-0: Token, names, and route

- introduce `--pigent-*` tokens;
- rename React identifiers/files/classes;
- make `/pigent` canonical and redirect `/pilot`;
- replace product copy across all pages;
- keep existing behavior temporarily.

Exit: source and built UI contain no visible Pilot label.

### UI-1: Shared Pigent components with demo state

- implement mode selector, task/tool/interaction cards, composer, context chips, session list, detail panel;
- reproduce both design layouts using the same components;
- keep deterministic demo events for static preview.

Exit: Playwright screenshots at 1360×860 and 1440×900 match the design structure and tokens.

### UI-2: Live Pigent session integration

- connect REST/WebSocket session API;
- mode changes, events, Tasks, context, interactions, reconnect cursor;
- share the active session between Workspace panel and dedicated page.

Exit: one live session can move between both surfaces without event duplication or restart.

### Shell-0: Persistent backend sessions

- introduce TerminalSession contracts and manager;
- create/list/write/resize/close/stream;
- retain one-shot execute for Pigent compatibility;
- integrate Running panel and shutdown.

Exit: two real Shell sessions keep independent cwd, environment, output, and process state.

### Shell-1: New Shell panel

- implement tabs, create/clear/close, footer, resizing, reconnect;
- implement maximize/restore;
- add split panes after the single-pane session lifecycle is stable.

Exit: the visible Shell matches `PipyterWorkspace` and survives browser reconnect.

### UI-3: Interaction handoff and polish

- open/focus the correct Shell session for Pigent interactive operations;
- optional review card actions;
- accessibility, empty/error/loading states, long-event virtualization;
- remove old components and dead CSS.

Exit: no legacy panel, route, token, or one-buffer terminal path remains.

## Verification

### Static/source

- `rg` finds no product-visible Pilot text outside the intentional old-route compatibility test;
- no `.ws-pilot-*` or `--pilot-*` token remains;
- `/pigent` is canonical;
- dedicated and embedded Pigent views import shared cards/mode selector;
- generated `src/pipyter/static` is rebuilt, not hand-edited.

### Type/build

- `cd web && pnpm typecheck`
- `cd web && pnpm build`
- protocol fixtures/type checks for Pigent and Shell contracts.

### Browser

At 1360×860 and 1440×900 verify:

- rail labels and active state;
- dedicated session list/main/detail geometry;
- Ask/Plan/Auto switching;
- 360 px Workspace Pigent panel open/close;
- 220 px Shell open/close and resize;
- two Shell tabs maintain independent output;
- new/clear/maximize/restore/close;
- split panes when enabled;
- Pigent event stream, Tasks progress, tool cards, interaction handoff;
- reconnect resumes session/event cursor and PTY sessions;
- Workspace notebook/file/kernel behavior remains intact.

### Accessibility

- semantic buttons and aria labels for mode, panel, session, and Shell controls;
- visible keyboard focus;
- color is not the only status indicator;
- reduced-motion disables pulse/spinner animation where practical;
- terminal focus preserves terminal key semantics.

## Stop conditions

- Do not fake multiple Shell tabs with one stateless command endpoint.
- Do not expose raw engine RPC events directly to React.
- Do not maintain separate card implementations for the dedicated and embedded Pigent views.
- Do not edit the ignored built static bundle by hand.
- Do not keep Pilot as a selectable mode or visible product label.
