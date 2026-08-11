# Pigent v0.1 design baseline (Phase 0)

## Visual source of truth

The three named HTML design files are the authoritative product visuals:

| File | Surface |
| --- | --- |
| `design/Pipyter.dc (1).html` | global shell: 84 px navigation rail, Home / Workspace / Figures / Pigent / Settings |
| `design/PipyterPigent.dc (1).html` | dedicated Pigent page: 236 px session column, main feed, optional 300 px detail panel |
| `design/PipyterWorkspace.dc (1).html` | Workspace: 360 px light Pigent right panel, 220 px persistent multi-session Shell panel |

Machine-readable extraction: `packages/protocol/schemas/fixtures/design-baseline.json`
(generated and verified by `node scripts/extract-design-baseline.mjs [--check]`).

## Frozen layout constants

| Token | Value | Source |
| --- | --- | --- |
| `rail_width` | 84 px | Pipyter.dc |
| `session_list_width` | 236 px | PipyterPigent |
| `detail_panel_width` | 300 px | PipyterPigent (hidden by default) |
| `workspace_pigent_panel_width` | 360 px | PipyterWorkspace |
| `shell_panel_height` | 220 px | PipyterWorkspace |
| `pigent_header_height` | 52 px | PipyterPigent |
| `content_max_width` | 880 px | PipyterPigent |
| `shell_header_height` | 34 px | PipyterWorkspace |
| `shell_footer_height` | 24 px | PipyterWorkspace |
| `pigent_panel_header_height` | 40 px | PipyterWorkspace |
| `file_browser_width` | 228 px | PipyterWorkspace |

## Frozen color tokens

```css
--bg: #f7f6f3; --surface: #fff; --surface-2: #f1f1ef; --surface-hover: #f1f1ef;
--border: #edece9; --border-strong: #dcdad4;
--text: #37352f; --text-2: #787774; --text-3: #9b9a97;
--accent: #2383e2; --accent-soft: #e3f2fd; --accent-dark: #0d47a1;
--pigent: #d9730d; --pigent-soft: #fff0e5; --pigent-dark: #a64b18;
--success: #0f7b6c; --success-soft: #e4f0ee;
--danger: #c33f31; --danger-soft: #f9e6e3;
--mono: menlo, consolas, "IBM Plex Mono", monospace;
```

CSS variable names migrate from `--pilot-*` to `--pigent-*`; `--pigent`,
`--pigent-soft`, `--pigent-dark` are the active/running/mutation emphasis
tokens, `--accent*` stays blue for selection/notebook/terminal states.

## Frozen interaction facts

- Mode selector order is exactly Ask / Plan / Auto in both surfaces; no fourth segment.
- Mode hints: Ask `只分析回答，不修改或执行`; Plan `分析并生成 Tasks，不执行修改`; Auto `以当前 Runtime 用户身份自主执行`.
- Tool-family colors: workspace/read/view blue, mutation/bash Pigent orange,
  delegate purple, notebook/kernel cyan/blue, success/error green/red.
- Shell tabs are real persistent PTY sessions (`bash`, `python`, `+`); actions:
  select, new, clear, split, maximize/restore, close. Footer shows real facts
  (executable/version, cwd, last exit code, duration, encoding), never hard-coded demo values.

## Rendered fixtures note

The `.dc (1).html` files are DesignComposer `x-dc` documents. They render
statically without the `support.js` runtime (only interactive `DCLogic`
bindings such as `{{ modeHint }}` stay as literal placeholders), so Phase 0
captured baseline comparison screenshots at 1360×860 and 1440×900 with
Playwright:

```text
.beaupi/design-fixtures/pigent-1360x860.png     # dedicated Pigent page
.beaupi/design-fixtures/workspace-1360x860.png  # Workspace panel + 220px Shell
.beaupi/design-fixtures/shell-1440x900.png      # 84px global rail
```

These are Git-ignored local comparison fixtures. The frozen machine-readable
baseline lives in `packages/protocol/schemas/fixtures/design-baseline.json`.
Phase 5 re-renders the React implementation at the same viewports and
compares against these fixtures.
