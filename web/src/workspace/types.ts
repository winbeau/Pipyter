import type {
  FileEntry,
  KernelOutput,
  KernelSpecSummary,
  KernelSummary,
  RunningResponse,
  WorkspaceSummary,
} from '../../../packages/protocol/src/index'
import type { Keymap } from './keymap'

export type { FileEntry, KernelOutput, KernelSummary, RunningResponse, WorkspaceSummary }

export type Mode = 'connecting' | 'api' | 'demo'
export type DocKind = 'notebook' | 'text' | 'image'
export type LeftTab = 'files' | 'running' | 'outline'

export type OpenDoc = {
  path: string
  kind: DocKind
}

export type CellModel = {
  id: string
  cellType: 'code' | 'markdown'
  source: string
  executionCount: number | null
  outputs: KernelOutput[]
}

export type WorkspaceState = {
  mode: Mode
  workspace: WorkspaceSummary | null
  cwd: string
  filter: string
  entries: FileEntry[] | null
  openDocs: OpenDoc[]
  active: string | null
  dirty: Record<string, boolean>
  notebooks: Record<string, CellModel[]>
  notebookDoc: Record<string, { nbformat: number; nbformat_minor: number; metadata: Record<string, unknown> }>
  texts: Record<string, string>
  kernelId: string | null
  kernels: KernelSummary[]
  kernelSpecs: KernelSpecSummary[]
  keymap: Keymap
  running: RunningResponse | null
  busy: boolean
  busyCell: { path: string; index: number } | null
  leftTab: LeftTab
  leftOpen: boolean
  bottomOpen: boolean
  dialog: DialogState | null
  toast: string | null
  lastError: string | null
}

export type DialogState =
  | { kind: 'confirm'; title: string; message: string; danger?: boolean; onConfirm: () => void }
  | { kind: 'prompt'; title: string; label: string; initial: string; placeholder?: string; onSubmit: (value: string) => void }
  | { kind: 'kernels' }
  | { kind: 'settings' }
  | { kind: 'about' }
