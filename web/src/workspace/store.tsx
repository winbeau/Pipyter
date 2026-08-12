import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ExecuteResponse, KernelOutput, KernelSpecSummary, KernelSummary, NotebookDocument, RunningResponse } from '../../../packages/protocol/src/index'
import { ApiUnavailableError, createApiClient, detectMode, type WorkspaceApiClient } from './api'
import { demoNotebookCells } from './demo'
import { defaultKeymap, loadKeymap, persistKeymap, type KeyActionId, type KeyCombo, type Keymap } from './keymap'
import type { CellModel, DialogState, DocKind, FileEntry, LeftTab, Mode, OpenDoc, WorkspaceState } from './types'

const STORAGE_PREFIX = 'pipyter.workspace.v2'
const storageKey = (runtimeKey: string) => `${STORAGE_PREFIX}:${runtimeKey}`

const initialState: WorkspaceState = {
  mode: 'connecting',
  workspace: null,
  cwd: '',
  filter: '',
  entries: null,
  openDocs: [],
  active: null,
  dirty: {},
  notebooks: {},
  notebookDoc: {},
  texts: {},
  kernelId: null,
  kernels: [],
  kernelSpecs: [],
  keymap: loadKeymap(),
  running: null,
  busy: false,
  busyCell: null,
  leftTab: 'files',
  leftOpen: true,
  bottomOpen: false,
  dialog: null,
  toast: null,
  lastError: null,
}

type Action =
  | { type: 'setMode'; mode: Mode }
  | { type: 'setWorkspace'; workspace: WorkspaceState['workspace'] }
  | { type: 'setEntries'; entries: WorkspaceState['entries'] }
  | { type: 'setCwd'; cwd: string }
  | { type: 'setFilter'; filter: string }
  | { type: 'openDoc'; doc: OpenDoc }
  | { type: 'closeDoc'; path: string }
  | { type: 'setActive'; path: string | null }
  | { type: 'closeAllDocs' }
  | { type: 'replaceDocPath'; oldPath: string; newPath: string }
  | { type: 'setDirty'; path: string; dirty: boolean }
  | { type: 'loadNotebook'; path: string; cells: CellModel[]; meta: WorkspaceState['notebookDoc'][string] }
  | { type: 'patchCells'; path: string; cells: CellModel[] }
  | { type: 'setText'; path: string; content: string }
  | { type: 'setKernel'; kernelId: string | null }
  | { type: 'setKernels'; kernels: KernelSummary[] }
  | { type: 'setKernelSpecs'; specs: KernelSpecSummary[] }
  | { type: 'setKeymap'; keymap: Keymap }
  | { type: 'setRunning'; running: RunningResponse | null }
  | { type: 'setBusy'; busy: boolean; cell?: { path: string; index: number } | null }
  | { type: 'applyExecute'; path: string; index: number; result: ExecuteResponse }
  | { type: 'setLeftTab'; tab: LeftTab }
  | { type: 'setLeftOpen'; open: boolean }
  | { type: 'setBottomOpen'; open: boolean }
  | { type: 'setDialog'; dialog: DialogState | null }
  | { type: 'setToast'; toast: string | null }
  | { type: 'setLastError'; error: string | null }
  | { type: 'restore'; state: Partial<WorkspaceState> }

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'setMode':
      return { ...state, mode: action.mode }
    case 'setWorkspace':
      return { ...state, workspace: action.workspace }
    case 'setEntries':
      return { ...state, entries: action.entries }
    case 'setCwd':
      return { ...state, cwd: action.cwd, entries: null }
    case 'setFilter':
      return { ...state, filter: action.filter }
    case 'openDoc': {
      if (state.openDocs.some((doc) => doc.path === action.doc.path)) {
        return { ...state, active: action.doc.path }
      }
      return { ...state, openDocs: [...state.openDocs, action.doc], active: action.doc.path }
    }
    case 'closeDoc': {
      const docs = state.openDocs.filter((doc) => doc.path !== action.path)
      let active = state.active
      if (active === action.path) {
        const index = state.openDocs.findIndex((doc) => doc.path === action.path)
        const neighbor = docs[Math.min(index, docs.length - 1)]
        active = neighbor ? neighbor.path : null
      }
      return { ...state, openDocs: docs, active }
    }
    case 'setActive':
      return { ...state, active: action.path }
    case 'closeAllDocs':
      return { ...state, openDocs: [], active: null }
    case 'replaceDocPath': {
      const openDocs = state.openDocs.map((doc) =>
        doc.path === action.oldPath ? { ...doc, path: action.newPath } : doc,
      )
      const notebooks: WorkspaceState['notebooks'] = {}
      for (const [path, cells] of Object.entries(state.notebooks)) {
        notebooks[path === action.oldPath ? action.newPath : path] = cells
      }
      const texts: WorkspaceState['texts'] = {}
      for (const [path, content] of Object.entries(state.texts)) {
        texts[path === action.oldPath ? action.newPath : path] = content
      }
      const notebookDoc: WorkspaceState['notebookDoc'] = {}
      for (const [path, meta] of Object.entries(state.notebookDoc)) {
        notebookDoc[path === action.oldPath ? action.newPath : path] = meta
      }
      return {
        ...state,
        openDocs,
        active: state.active === action.oldPath ? action.newPath : state.active,
        notebooks,
        texts,
        notebookDoc,
      }
    }
    case 'setDirty':
      return { ...state, dirty: { ...state.dirty, [action.path]: action.dirty } }
    case 'loadNotebook':
      return {
        ...state,
        notebooks: { ...state.notebooks, [action.path]: action.cells },
        notebookDoc: { ...state.notebookDoc, [action.path]: action.meta },
      }
    case 'patchCells':
      return { ...state, notebooks: { ...state.notebooks, [action.path]: action.cells } }
    case 'setText':
      return { ...state, texts: { ...state.texts, [action.path]: action.content } }
    case 'setKernel':
      return { ...state, kernelId: action.kernelId }
    case 'setKernels':
      return { ...state, kernels: action.kernels }
    case 'setKernelSpecs':
      return { ...state, kernelSpecs: action.specs }
    case 'setKeymap':
      return { ...state, keymap: action.keymap }
    case 'setRunning':
      return { ...state, running: action.running }
    case 'setBusy':
      return { ...state, busy: action.busy, busyCell: action.busy ? (action.cell ?? null) : null }
    case 'applyExecute': {
      const cells = state.notebooks[action.path]
      if (!cells) return state
      const next = cells.map((cell, index) =>
        index === action.index ? { ...cell, outputs: action.result.outputs, executionCount: action.result.execution_count } : cell,
      )
      return { ...state, notebooks: { ...state.notebooks, [action.path]: next } }
    }
    case 'setLeftTab':
      return { ...state, leftTab: action.tab }
    case 'setLeftOpen':
      return { ...state, leftOpen: action.open }
    case 'setBottomOpen':
      return { ...state, bottomOpen: action.open }
    case 'setDialog':
      return { ...state, dialog: action.dialog }
    case 'setToast':
      return { ...state, toast: action.toast }
    case 'setLastError':
      return { ...state, lastError: action.error }
    case 'restore': {
      const restored = action.state
      const next: WorkspaceState = { ...state }
      if (restored.openDocs) next.openDocs = restored.openDocs
      if (restored.active) next.active = restored.active
      if (typeof restored.leftOpen === 'boolean') next.leftOpen = restored.leftOpen
      if (typeof restored.bottomOpen === 'boolean') next.bottomOpen = restored.bottomOpen
      if (typeof restored.cwd === 'string') next.cwd = restored.cwd
      if (restored.notebooks) next.notebooks = restored.notebooks
      if (restored.notebookDoc) next.notebookDoc = restored.notebookDoc
      if (restored.texts) next.texts = restored.texts
      return next
    }
    default:
      return state
  }
}

function cellsFromDoc(doc: NotebookDocument): { cells: CellModel[]; meta: WorkspaceState['notebookDoc'][string] } {
  return {
    cells: doc.notebook.cells.map((cell, index) => ({
      id: `cell-${index}-${Math.random().toString(36).slice(2, 8)}`,
      cellType: cell.cell_type,
      source: Array.isArray(cell.source) ? cell.source.join('') : String(cell.source ?? ''),
      executionCount: cell.execution_count ?? null,
      outputs: cell.outputs ?? [],
    })),
    meta: {
      nbformat: doc.notebook.nbformat,
      nbformat_minor: doc.notebook.nbformat_minor,
      metadata: doc.notebook.metadata ?? {},
    },
  }
}

function docFromCells(path: string, cells: CellModel[], meta: WorkspaceState['notebookDoc'][string]): NotebookDocument {
  return {
    path,
    notebook: {
      cells: cells.map((cell) => ({
        cell_type: cell.cellType,
        execution_count: cell.cellType === 'code' ? cell.executionCount : null,
        metadata: {},
        outputs: cell.cellType === 'code' ? cell.outputs : [],
        source: cell.source,
      })),
      nbformat: meta?.nbformat ?? 4,
      nbformat_minor: meta?.nbformat_minor ?? 5,
      metadata: meta?.metadata ?? {},
    },
  }
}

export function newCellId(): string {
  return `cell-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiUnavailableError) return error.message
  if (error instanceof Error) return error.message
  return String(error)
}

export type WorkspaceActions = {
  reconnect: () => Promise<void>
  refreshTree: () => Promise<void>
  listFiles: (path: string) => Promise<FileEntry[]>
  setCwd: (cwd: string) => void
  setFilter: (filter: string) => void
  openDoc: (path: string, kind: DocKind) => Promise<void>
  closeDoc: (path: string) => void
  closeAll: () => void
  setActive: (path: string) => void
  saveDoc: (path: string) => Promise<void>
  setText: (path: string, content: string) => void
  markDirty: (path: string) => void
  imageUrl: (path: string) => string
  updateCell: (path: string, index: number, patch: Partial<CellModel>) => void
  insertCell: (path: string, index: number, cellType: 'code' | 'markdown', source?: string) => void
  deleteCell: (path: string, index: number) => void
  duplicateCell: (path: string, index: number) => void
  moveCell: (path: string, index: number, delta: number) => void
  clearCellOutputs: (path: string, index: number) => void
  runCell: (path: string, index: number) => Promise<void>
  runAll: (path: string) => Promise<void>
  startKernel: () => Promise<void>
  chooseKernel: (specName: string) => Promise<void>
  downloadPath: (path: string) => void
  updateKeymap: (actionId: KeyActionId, combo: KeyCombo) => void
  resetKeymap: () => void
  interruptKernel: () => Promise<void>
  restartKernel: () => Promise<void>
  shutdownKernel: (kernelId: string) => Promise<void>
  refreshRunning: () => Promise<void>
  newFile: (dir: string, name: string) => Promise<void>
  newFolder: (dir: string, name: string) => Promise<void>
  renamePath: (path: string, newName: string) => Promise<void>
  deletePath: (path: string) => Promise<void>
  uploadFiles: (files: FileList | null) => Promise<void>
  setLeftTab: (tab: LeftTab) => void
  setLeftOpen: (open: boolean) => void
  setBottomOpen: (open: boolean) => void
  showConfirm: (title: string, message: string, onConfirm: () => void, danger?: boolean) => void
  showPrompt: (title: string, label: string, initial: string, onSubmit: (value: string) => void) => void
  showAbout: () => void
  showSettings: () => void
  showKernels: () => void
  closeDialog: () => void
  showToast: (toast: string) => void
}

type WorkspaceContextValue = { state: WorkspaceState; actions: WorkspaceActions }

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function loadPersisted(runtimeKey: string): Partial<WorkspaceState> {
  try {
    const raw = window.localStorage.getItem(storageKey(runtimeKey))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<WorkspaceState>
    return {
      openDocs: Array.isArray(parsed.openDocs) ? parsed.openDocs : undefined,
      active: typeof parsed.active === 'string' ? parsed.active : undefined,
      leftOpen: typeof parsed.leftOpen === 'boolean' ? parsed.leftOpen : undefined,
      bottomOpen: typeof parsed.bottomOpen === 'boolean' ? parsed.bottomOpen : undefined,
      cwd: typeof parsed.cwd === 'string' ? parsed.cwd : undefined,
      notebooks: parsed.notebooks,
      notebookDoc: parsed.notebookDoc,
      texts: parsed.texts,
    }
  } catch {
    return {}
  }
}

export function WorkspaceProvider({
  children,
  apiBase = '',
  runtimeKey = 'local:current',
  allowDemo = true,
  expectedNodeId,
  expectedWorkspaceId,
}: {
  children: ReactNode
  apiBase?: string
  runtimeKey?: string
  allowDemo?: boolean
  expectedNodeId?: string
  expectedWorkspaceId?: string
}) {
  const [state, dispatch] = useReducer(reducer, initialState, () => reducer(initialState, { type: 'restore', state: loadPersisted(runtimeKey) }))
  const stateRef = useRef(state)
  stateRef.current = state
  const apiRef = useRef<WorkspaceApiClient>(createApiClient('demo', apiBase))
  const [apiMode, setApiMode] = useState<'api' | 'demo'>('demo')

  useEffect(() => {
    const persist = () => {
      const payload = {
        openDocs: state.openDocs,
        active: state.active,
        leftOpen: state.leftOpen,
        bottomOpen: state.bottomOpen,
        cwd: state.cwd,
        notebooks: state.notebooks,
        notebookDoc: state.notebookDoc,
        texts: state.texts,
      }
      window.localStorage.setItem(storageKey(runtimeKey), JSON.stringify(payload))
    }
    const timer = window.setTimeout(persist, 180)
    window.addEventListener('pagehide', persist)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pagehide', persist)
    }
  }, [runtimeKey, state.openDocs, state.active, state.leftOpen, state.bottomOpen, state.cwd, state.notebooks, state.notebookDoc, state.texts])

  useEffect(() => {
    if (!state.toast) return
    const timer = window.setTimeout(() => dispatch({ type: 'setToast', toast: null }), 3200)
    return () => window.clearTimeout(timer)
  }, [state.toast])

  // Re-list the directory whenever the browsing path changes.
  useEffect(() => {
    if (state.mode === 'api' || state.mode === 'demo') {
      void refreshTree()
    }
    // refreshTree reads the latest cwd through stateRef; cwd changes drive this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.cwd, state.mode])

  useEffect(() => {
    persistKeymap(state.keymap)
  }, [state.keymap])

  const notify = useCallback((message: string) => dispatch({ type: 'setToast', toast: message }), [])

  const refreshTree = useCallback(async () => {
    try {
      const entries = await apiRef.current.listFiles(stateRef.current.cwd)
      dispatch({ type: 'setEntries', entries })
    } catch (error) {
      dispatch({ type: 'setEntries', entries: null })
      notify(`无法列出目录: ${errorMessage(error)}`)
    }
  }, [notify])

  const ensureKernel = useCallback(async (): Promise<string> => {
    let kernelId = stateRef.current.kernelId
    if (!kernelId) {
      const summary = await apiRef.current.startKernel()
      kernelId = summary.id
      dispatch({ type: 'setKernel', kernelId })
    }
    return kernelId
  }, [])

  const refreshKernels = useCallback(async () => {
    try {
      const kernels = await apiRef.current.listKernels()
      dispatch({ type: 'setKernels', kernels })
      const current = stateRef.current.kernelId
      if (current && !kernels.some((kernel) => kernel.id === current)) {
        dispatch({ type: 'setKernel', kernelId: null })
      }
    } catch {
      /* keep last known kernel state */
    }
  }, [])

  const refreshKernelSpecs = useCallback(async () => {
    try {
      const specs = await apiRef.current.listKernelSpecs()
      dispatch({ type: 'setKernelSpecs', specs })
    } catch {
      dispatch({ type: 'setKernelSpecs', specs: [] })
    }
  }, [])

  const reconnect = useCallback(async () => {
    dispatch({ type: 'setMode', mode: 'connecting' })
    dispatch({ type: 'setLastError', error: null })
    try {
      const mode = await detectMode(apiBase, { allowDemo, expectedNodeId, expectedWorkspaceId })
      apiRef.current = createApiClient(mode, apiBase)
      setApiMode(mode)
      dispatch({ type: 'setMode', mode })
      const workspace = await apiRef.current.workspace()
      dispatch({ type: 'setWorkspace', workspace })
      notify(mode === 'api' ? '已连接 Runtime API' : 'Runtime API 不可用 — 本地演示模式')
      await refreshTree()
      await refreshKernels()
      await refreshKernelSpecs()
      await refreshRunning()
    } catch (error) {
      const message = errorMessage(error)
      dispatch({ type: 'setMode', mode: 'error' })
      dispatch({ type: 'setWorkspace', workspace: null })
      dispatch({ type: 'setEntries', entries: null })
      dispatch({ type: 'setLastError', error: message })
      notify(`Runtime 连接失败: ${message}`)
    }
  }, [allowDemo, apiBase, expectedNodeId, expectedWorkspaceId, notify, refreshTree, refreshKernels, refreshKernelSpecs])

  useEffect(() => {
    void reconnect()
  }, [reconnect])

  const openDoc = useCallback(
    async (path: string, kind: DocKind) => {
      dispatch({ type: 'openDoc', doc: { path, kind } })
      if (kind === 'notebook') {
        try {
          const document = await apiRef.current.readNotebook(path)
          const { cells, meta } = cellsFromDoc(document)
          dispatch({ type: 'loadNotebook', path, cells, meta })
        } catch (error) {
          if (apiMode === 'demo') {
            const { cells, meta } = cellsFromDoc({
              path,
              notebook: {
                cells: demoNotebookCells().map((cell) => ({
                  cell_type: cell.cellType,
                  execution_count: cell.executionCount,
                  metadata: {},
                  outputs: cell.outputs,
                  source: cell.source,
                })),
                metadata: {},
                nbformat: 4,
                nbformat_minor: 5,
              },
            })
            dispatch({ type: 'loadNotebook', path, cells, meta })
          } else {
            notify(`读取 Notebook 失败: ${errorMessage(error)}`)
          }
        }
      } else if (kind === 'text') {
        try {
          const content = await apiRef.current.readFile(path)
          dispatch({ type: 'setText', path, content: content.content })
        } catch (error) {
          notify(`读取文件失败: ${errorMessage(error)}`)
        }
      }
    },
    [apiMode, notify],
  )

  const saveDoc = useCallback(
    async (path: string) => {
      const kind = stateRef.current.openDocs.find((doc) => doc.path === path)?.kind
      try {
        if (kind === 'notebook') {
          const cells = stateRef.current.notebooks[path]
          const meta = stateRef.current.notebookDoc[path]
          if (!cells) return
          await apiRef.current.writeNotebook(path, docFromCells(path, cells, meta).notebook)
        } else if (kind === 'text') {
          const content = stateRef.current.texts[path]
          if (content === undefined) return
          await apiRef.current.writeFile(path, content)
        } else {
          return
        }
        dispatch({ type: 'setDirty', path, dirty: false })
        notify(`已保存 ${path}`)
      } catch (error) {
        notify(`保存失败: ${errorMessage(error)}`)
      }
    },
    [notify],
  )

  const updateCell = useCallback(
    (path: string, index: number, patch: Partial<CellModel>) => {
      const cells = stateRef.current.notebooks[path]
      if (!cells) return
      const next = cells.map((cell, i) => (i === index ? { ...cell, ...patch } : cell))
      dispatch({ type: 'patchCells', path, cells: next })
      dispatch({ type: 'setDirty', path, dirty: true })
    },
    [],
  )

  const insertCell = useCallback(
    (path: string, index: number, cellType: 'code' | 'markdown', source = '') => {
      const cells = stateRef.current.notebooks[path]
      if (!cells) return
      const cell: CellModel = { id: newCellId(), cellType, source, executionCount: null, outputs: [] }
      const next = [...cells.slice(0, index), cell, ...cells.slice(index)]
      dispatch({ type: 'patchCells', path, cells: next })
      dispatch({ type: 'setDirty', path, dirty: true })
    },
    [],
  )

  const deleteCell = useCallback(
    (path: string, index: number) => {
      const cells = stateRef.current.notebooks[path]
      if (!cells) return
      const next = cells.filter((_, i) => i !== index)
      dispatch({ type: 'patchCells', path, cells: next })
      dispatch({ type: 'setDirty', path, dirty: true })
    },
    [],
  )

  const duplicateCell = useCallback(
    (path: string, index: number) => {
      const cells = stateRef.current.notebooks[path]
      if (!cells) return
      const source = cells[index]
      const copy: CellModel = { ...source, id: newCellId(), outputs: source.outputs.map((output) => ({ ...output, data: { ...output.data } })) }
      const next = [...cells.slice(0, index + 1), copy, ...cells.slice(index + 1)]
      dispatch({ type: 'patchCells', path, cells: next })
      dispatch({ type: 'setDirty', path, dirty: true })
    },
    [],
  )

  const moveCell = useCallback(
    (path: string, index: number, delta: number) => {
      const cells = stateRef.current.notebooks[path]
      if (!cells) return
      const target = index + delta
      if (target < 0 || target >= cells.length) return
      const next = [...cells]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      dispatch({ type: 'patchCells', path, cells: next })
      dispatch({ type: 'setDirty', path, dirty: true })
    },
    [],
  )

  const clearCellOutputs = useCallback(
    (path: string, index: number) => {
      const cells = stateRef.current.notebooks[path]
      if (!cells) return
      const next = cells.map((cell, i) => (i === index ? { ...cell, outputs: [] } : cell))
      dispatch({ type: 'patchCells', path, cells: next })
    },
    [],
  )

  const runCell = useCallback(
    async (path: string, index: number) => {
      const cells = stateRef.current.notebooks[path]
      const cell = cells?.[index]
      if (!cell || cell.cellType !== 'code' || stateRef.current.busy) return
      dispatch({ type: 'setBusy', busy: true, cell: { path, index } })
      try {
        const kernelId = await ensureKernel()
        const result = await apiRef.current.execute(kernelId, cell.source)
        dispatch({ type: 'applyExecute', path, index, result })
      } catch (error) {
        notify(`执行失败: ${errorMessage(error)}`)
      } finally {
        dispatch({ type: 'setBusy', busy: false })
        await refreshKernels()
      }
    },
    [ensureKernel, notify, refreshKernels],
  )

  const runAll = useCallback(
    async (path: string) => {
      const cells = stateRef.current.notebooks[path]
      if (!cells || stateRef.current.busy) return
      const kernelId = await ensureKernel()
      for (let index = 0; index < cells.length; index += 1) {
        const cell = stateRef.current.notebooks[path]?.[index]
        if (!cell || cell.cellType !== 'code') continue
        dispatch({ type: 'setBusy', busy: true, cell: { path, index } })
        try {
          const result = await apiRef.current.execute(kernelId, cell.source)
          dispatch({ type: 'applyExecute', path, index, result })
        } catch (error) {
          notify(`执行失败 (cell ${index + 1}): ${errorMessage(error)}`)
          break
        } finally {
          dispatch({ type: 'setBusy', busy: false })
        }
      }
      await refreshKernels()
    },
    [ensureKernel, notify, refreshKernels],
  )

  const refreshRunning = useCallback(async () => {
    try {
      const running = await apiRef.current.running()
      dispatch({ type: 'setRunning', running })
    } catch {
      /* keep last known running state */
    }
  }, [])

  const chooseKernel = useCallback(
    async (specName: string) => {
      if (stateRef.current.busy) {
        notify('Kernel 忙，请先中断或等待执行完成')
        return
      }
      const current = stateRef.current.kernelId
      if (current) {
        try {
          await apiRef.current.shutdown(current)
        } catch {
          /* kernel may already be gone */
        }
      }
      try {
        const summary = await apiRef.current.startKernel(specName)
        dispatch({ type: 'setKernel', kernelId: summary.id })
        const spec = stateRef.current.kernelSpecs.find((item) => item.name === specName)
        notify(`已切换到 Kernel ${spec?.display_name ?? summary.name}`)
      } catch (error) {
        notify(`启动 Kernel 失败: ${errorMessage(error)}`)
      }
      await refreshKernels()
      await refreshRunning()
    },
    [notify, refreshKernels, refreshRunning],
  )

  const downloadPath = useCallback((path: string) => {
    const name = path.split('/').pop() ?? 'download'
    const anchor = document.createElement('a')
    anchor.href = apiRef.current.downloadUrl(path)
    anchor.download = name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }, [])

  const startKernel = useCallback(async () => {
    try {
      const summary = await apiRef.current.startKernel()
      dispatch({ type: 'setKernel', kernelId: summary.id })
      notify(`Kernel ${summary.name} 已启动`)
    } catch (error) {
      notify(`启动 Kernel 失败: ${errorMessage(error)}`)
    }
    await refreshKernels()
    await refreshRunning()
  }, [notify, refreshKernels, refreshRunning])

  const interruptKernel = useCallback(async () => {
    const kernelId = stateRef.current.kernelId
    if (!kernelId) {
      notify('没有活动 Kernel')
      return
    }
    try {
      await apiRef.current.interrupt(kernelId)
      dispatch({ type: 'setBusy', busy: false })
      notify('已发送中断')
    } catch (error) {
      notify(`中断失败: ${errorMessage(error)}`)
    }
    await refreshKernels()
  }, [notify, refreshKernels])

  const restartKernel = useCallback(async () => {
    const kernelId = stateRef.current.kernelId
    if (!kernelId) {
      notify('没有活动 Kernel')
      return
    }
    try {
      await apiRef.current.restart(kernelId)
      notify('Kernel 已重启')
    } catch (error) {
      notify(`重启失败: ${errorMessage(error)}`)
    }
    await refreshKernels()
    await refreshRunning()
  }, [notify, refreshKernels])

  const shutdownKernel = useCallback(
    async (kernelId: string) => {
      try {
        await apiRef.current.shutdown(kernelId)
        if (stateRef.current.kernelId === kernelId) dispatch({ type: 'setKernel', kernelId: null })
        notify('Kernel 已关闭')
      } catch (error) {
        notify(`关闭失败: ${errorMessage(error)}`)
      }
      await refreshKernels()
      await refreshRunning()
    },
    [notify, refreshKernels],
  )

  const newFile = useCallback(
    async (dir: string, name: string) => {
      const path = dir ? `${dir}/${name}` : name
      const isNotebook = name.toLowerCase().endsWith('.ipynb')
      try {
        if (isNotebook) {
          await apiRef.current.writeNotebook(path, {
            cells: [],
            metadata: {},
            nbformat: 4,
            nbformat_minor: 5,
          })
        } else {
          await apiRef.current.writeFile(path, '')
        }
        notify(`已创建 ${path}`)
        await refreshTree()
        await openDoc(path, isNotebook ? 'notebook' : 'text')
      } catch (error) {
        notify(`创建失败: ${errorMessage(error)}`)
      }
    },
    [notify, refreshTree, openDoc],
  )

  const newFolder = useCallback(
    async (dir: string, name: string) => {
      const path = dir ? `${dir}/${name}` : name
      try {
        await apiRef.current.createDirectory(path)
        notify(`已创建目录 ${path}`)
        await refreshTree()
      } catch (error) {
        notify(`创建失败: ${errorMessage(error)}`)
      }
    },
    [notify, refreshTree],
  )

  const renamePath = useCallback(
    async (path: string, newName: string) => {
      if (!newName || newName === path) return
      const separator = path.lastIndexOf('/')
      const parent = separator >= 0 ? path.slice(0, separator) : ''
      const newPath = parent ? `${parent}/${newName}` : newName
      if (newPath === path) return
      const kind = stateRef.current.openDocs.find((doc) => doc.path === path)?.kind
      try {
        if (kind === 'notebook') {
          const cells = stateRef.current.notebooks[path]
          const meta = stateRef.current.notebookDoc[path]
          if (cells) {
            await apiRef.current.writeNotebook(newPath, docFromCells(newPath, cells, meta).notebook)
          }
        } else {
          const content = stateRef.current.texts[path] ?? (await apiRef.current.readFile(path)).content
          await apiRef.current.writeFile(newPath, content)
        }
        await apiRef.current.deletePath(path)
        if (stateRef.current.openDocs.some((doc) => doc.path === path)) {
          dispatch({ type: 'replaceDocPath', oldPath: path, newPath })
        }
        notify(`已重命名为 ${newName}`)
      } catch (error) {
        notify(`重命名失败: ${errorMessage(error)}`)
      }
      await refreshTree()
    },
    [notify, refreshTree],
  )

  const deletePath = useCallback(
    async (path: string) => {
      try {
        await apiRef.current.deletePath(path)
        if (stateRef.current.openDocs.some((doc) => doc.path === path)) {
          dispatch({ type: 'closeDoc', path })
        }
        notify(`已删除 ${path}`)
      } catch (error) {
        notify(`删除失败: ${errorMessage(error)}`)
      }
      await refreshTree()
    },
    [notify, refreshTree],
  )

  const uploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      if (apiMode === 'demo') {
        notify('演示模式不支持上传')
        return
      }
      const dir = stateRef.current.cwd
      for (const file of Array.from(files)) {
        if (file.type && file.type.startsWith('image/')) {
          notify(`跳过二进制文件 ${file.name}（v0.1 仅支持文本上传）`)
          continue
        }
        try {
          const content = await file.text()
          const path = dir ? `${dir}/${file.name}` : file.name
          await apiRef.current.writeFile(path, content)
          notify(`已上传 ${file.name}`)
        } catch (error) {
          notify(`上传 ${file.name} 失败: ${errorMessage(error)}`)
        }
      }
      await refreshTree()
    },
    [apiMode, notify, refreshTree],
  )


  const actions = useMemo<WorkspaceActions>(
    () => ({
      reconnect,
      refreshTree,
      listFiles: async (path: string) => {
        try {
          return await apiRef.current.listFiles(path)
        } catch {
          return []
        }
      },
      setCwd: (cwd) => {
        if (stateRef.current.cwd === cwd) return
        dispatch({ type: 'setCwd', cwd })
      },
      setFilter: (filter) => dispatch({ type: 'setFilter', filter }),
      openDoc,
      closeDoc: (path) => dispatch({ type: 'closeDoc', path }),
      closeAll: () => dispatch({ type: 'closeAllDocs' }),
      setActive: (path) => dispatch({ type: 'setActive', path }),
      saveDoc,
      setText: (path, content) => dispatch({ type: 'setText', path, content }),
      markDirty: (path) => dispatch({ type: 'setDirty', path, dirty: true }),
      imageUrl: (path) => apiRef.current.imageUrl(path),
      updateCell,
      insertCell,
      deleteCell,
      duplicateCell,
      moveCell,
      clearCellOutputs,
      runCell,
      runAll,
      startKernel,
      chooseKernel,
      downloadPath,
      updateKeymap: (actionId, combo) =>
        dispatch({ type: 'setKeymap', keymap: { ...stateRef.current.keymap, [actionId]: combo } }),
      resetKeymap: () => dispatch({ type: 'setKeymap', keymap: { ...defaultKeymap } }),
      interruptKernel,
      restartKernel,
      shutdownKernel,
      refreshRunning,
      newFile,
      newFolder,
      renamePath,
      deletePath,
      uploadFiles,
      setLeftTab: (tab) => dispatch({ type: 'setLeftTab', tab }),
      setLeftOpen: (open) => dispatch({ type: 'setLeftOpen', open }),
      setBottomOpen: (open) => dispatch({ type: 'setBottomOpen', open }),
      showConfirm: (title, message, onConfirm, danger) =>
        dispatch({ type: 'setDialog', dialog: { kind: 'confirm', title, message, onConfirm, danger } }),
      showPrompt: (title, label, initial, onSubmit) =>
        dispatch({ type: 'setDialog', dialog: { kind: 'prompt', title, label, initial, onSubmit } }),
      showAbout: () => dispatch({ type: 'setDialog', dialog: { kind: 'about' } }),
      showSettings: () => dispatch({ type: 'setDialog', dialog: { kind: 'settings' } }),
      showKernels: () => dispatch({ type: 'setDialog', dialog: { kind: 'kernels' } }),
      closeDialog: () => dispatch({ type: 'setDialog', dialog: null }),
      showToast: notify,
    }),
    [
      reconnect,
      refreshTree,
      openDoc,
      saveDoc,
      updateCell,
      insertCell,
      deleteCell,
      duplicateCell,
      moveCell,
      clearCellOutputs,
      runCell,
      runAll,
      startKernel,
      chooseKernel,
      downloadPath,
      interruptKernel,
      restartKernel,
      shutdownKernel,
      refreshRunning,
      newFile,
      newFolder,
      renamePath,
      deletePath,
      uploadFiles,
      notify,
    ],
  )

  const value = useMemo(() => ({ state, actions }), [state, actions])
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return context
}
