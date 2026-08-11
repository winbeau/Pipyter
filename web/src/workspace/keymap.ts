/** User-configurable notebook shortcuts (Jupyter-style defaults). */

export type KeyCombo = {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  /** Ctrl on Windows/Linux, Cmd on macOS. */
  ctrlOrMeta?: boolean
}

export type KeyActionId =
  | 'runCell'
  | 'runCellAdvance'
  | 'runCellInsert'
  | 'runAll'
  | 'enterEdit'
  | 'exitEdit'
  | 'selectUp'
  | 'selectDown'
  | 'insertAbove'
  | 'insertBelow'
  | 'deleteCell'
  | 'toMarkdown'
  | 'toCode'
  | 'copyCell'
  | 'cutCell'
  | 'pasteCell'
  | 'save'
  | 'interruptKernel'
  | 'restartKernel'
  | 'clearOutput'

export type Keymap = Record<KeyActionId, KeyCombo>

export const keyActionLabels: Record<KeyActionId, string> = {
  runCell: '运行 Cell（不前进）',
  runCellAdvance: '运行 Cell 并前进',
  runCellInsert: '运行 Cell 并在下方插入',
  runAll: '运行全部 Cell',
  enterEdit: '进入编辑模式',
  exitEdit: '退出编辑模式（命令模式）',
  selectUp: '选择上一个 Cell',
  selectDown: '选择下一个 Cell',
  insertAbove: '在上方插入 Cell',
  insertBelow: '在下方插入 Cell',
  deleteCell: '删除当前 Cell',
  toMarkdown: '转为 Markdown Cell',
  toCode: '转为 Code Cell',
  copyCell: '复制 Cell',
  cutCell: '剪切 Cell',
  pasteCell: '粘贴 Cell',
  save: '保存文档',
  interruptKernel: '中断 Kernel',
  restartKernel: '重启 Kernel',
  clearOutput: '清除全部输出',
}

export const keyActionOrder: KeyActionId[] = [
  'runCell',
  'runCellAdvance',
  'runCellInsert',
  'runAll',
  'save',
  'enterEdit',
  'exitEdit',
  'selectUp',
  'selectDown',
  'insertAbove',
  'insertBelow',
  'deleteCell',
  'toMarkdown',
  'toCode',
  'copyCell',
  'cutCell',
  'pasteCell',
  'interruptKernel',
  'restartKernel',
  'clearOutput',
]

export const defaultKeymap: Keymap = {
  runCell: { key: 'Enter', ctrlOrMeta: true },
  runCellAdvance: { key: 'Enter', shift: true },
  runCellInsert: { key: 'Enter', alt: true },
  runAll: { key: 'Enter', ctrlOrMeta: true, shift: true },
  enterEdit: { key: 'Enter' },
  exitEdit: { key: 'Escape' },
  selectUp: { key: 'ArrowUp' },
  selectDown: { key: 'ArrowDown' },
  insertAbove: { key: 'a' },
  insertBelow: { key: 'b' },
  deleteCell: { key: 'd', shift: true },
  toMarkdown: { key: 'm' },
  toCode: { key: 'y' },
  copyCell: { key: 'c', ctrlOrMeta: true },
  cutCell: { key: 'x', ctrlOrMeta: true },
  pasteCell: { key: 'v', ctrlOrMeta: true },
  save: { key: 's', ctrlOrMeta: true },
  interruptKernel: { key: 'i', ctrlOrMeta: true },
  restartKernel: { key: 'r', ctrlOrMeta: true, shift: true },
  clearOutput: { key: 'o', ctrlOrMeta: true, shift: true },
}

export function comboLabel(combo: KeyCombo): string {
  const parts: string[] = []
  if (combo.ctrl) parts.push('Ctrl')
  if (combo.ctrlOrMeta) parts.push('Ctrl/Cmd')
  if (combo.alt) parts.push('Alt')
  if (combo.shift) parts.push('Shift')
  const key = combo.key.length === 1 ? combo.key.toUpperCase() : combo.key
  parts.push(key === ' ' ? 'Space' : key)
  return parts.join('+')
}

export type KeyboardEventLike = {
  key: string
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
}

export function matchesCombo(event: KeyboardEventLike, combo: KeyCombo): boolean {
  if (event.key !== combo.key) return false
  if (combo.ctrlOrMeta) {
    if (!(event.ctrlKey || event.metaKey)) return false
  } else {
    if (event.ctrlKey !== (combo.ctrl ?? false)) return false
    if (event.metaKey) return false
  }
  if (event.shiftKey !== (combo.shift ?? false)) return false
  if (event.altKey !== (combo.alt ?? false)) return false
  return true
}

export function findAction(keymap: Keymap, event: KeyboardEventLike): KeyActionId | null {
  for (const actionId of keyActionOrder) {
    if (matchesCombo(event, keymap[actionId])) return actionId
  }
  return null
}

const STORAGE_KEY = 'pipyter.keymap.v1'

export function loadKeymap(): Keymap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultKeymap
    const parsed = JSON.parse(raw) as Partial<Keymap>
    return { ...defaultKeymap, ...parsed }
  } catch {
    return defaultKeymap
  }
}

export function persistKeymap(keymap: Keymap): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keymap))
}
