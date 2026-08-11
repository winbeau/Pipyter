# React Workspace

## JupyterLab shell mapping

- `menu`: File, Edit, View, Run, Kernel, Tabs, Settings, Help.
- `left`: activity strip plus Files, Running and Outline panels.
- `main`: restorable document tabs for notebooks, editors, images and terminals.
- `down`: terminal/output panel with collapse and resize-ready layout.
- `right`: preserve the current Pilot sidebar and collapsed rail; do not add Agent backend work.
- `bottom`: connection, save, kernel, cursor, indentation and trust status.

## File browser

- Breadcrumbs, filename filter, refresh, new file/folder, upload affordance.
- Folder expand/collapse, selection, open, rename and delete confirmation.
- File type icons and running-kernel indicators.

## Notebook

- Toolbar: save, insert, cut/copy/paste, run-and-advance, interrupt, restart, run all and cell type.
- Cells: command/edit focus, markdown/code types, insert/delete/duplicate/move, editable source, execution count.
- Output: busy feedback, stream/result/error rendering, clear/collapse controls.
- Preserve current notebook title, code examples, figure placeholder and Pilot toggle.

## Terminal and running

- Terminal tabs, prompt input, history, clear and close.
- Running panel lists kernels and terminal sessions with per-item/all shutdown actions.
- Status bar mirrors active document, kernel and connection state.

## Integration behavior

- Call `/api/v1` when the Runtime API is available.
- Fall back to deterministic in-browser demo data so the static portal remains usable.
- Persist layout/open tabs/cells in local storage.
