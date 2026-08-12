export const protocolVersion = '0.1' as const

export type KernelStatus = 'idle' | 'busy' | 'restarting' | 'dead'
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'
export type FileKind = 'directory' | 'notebook' | 'file' | 'image'
export type KernelOutputType = 'stream' | 'execute_result' | 'display_data' | 'error'

export type HealthResponse = {
  status: 'ok'
  protocol_version: typeof protocolVersion
  node_id: string
  workspace_id: string
}

export type WorkspaceSummary = {
  protocol_version: typeof protocolVersion
  node_id: string
  workspace_id: string
  project_id: string
  name: string
  root_name: string
  root?: string | null
  kernel_status: KernelStatus
  connection_status: ConnectionStatus
  open_documents: string[]
}

export type FileEntry = {
  path: string
  name: string
  type: FileKind
  size?: number | null
  modified?: number | null
  running?: boolean
}

export type FileContent = {
  path: string
  content: string
  encoding: 'utf-8'
}

export type DirectoryCreateRequest = {
  path: string
}

export type NotebookCell = {
  cell_type: 'code' | 'markdown'
  execution_count?: number | null
  metadata?: Record<string, unknown>
  outputs?: KernelOutput[]
  source: string | string[]
}

export type NotebookDocument = {
  path: string
  notebook: {
    cells: NotebookCell[]
    metadata: Record<string, unknown>
    nbformat: number
    nbformat_minor: number
  }
}

export type KernelSummary = {
  id: string
  name: string
  status: KernelStatus
  execution_count: number
}

export type KernelSpecSummary = {
  name: string
  display_name: string
  language: string
  argv: string[]
}

export type KernelOutput = {
  type: KernelOutputType
  text: string
  data: Record<string, unknown>
  name?: string | null
  traceback: string[]
}

export type ExecuteRequest = {
  code: string
  timeout?: number
}

export type ExecuteResponse = {
  kernel_id: string
  execution_count: number
  status: KernelStatus
  outputs: KernelOutput[]
}

export type TerminalExecuteResponse = {
  session_id: string
  command: string
  cwd: string
  stdout: string
  stderr: string
  exit_code: number
}

export type RunningItem = {
  id: string
  kind: 'kernel' | 'terminal'
  name: string
  path: string
  status: string
}

export type RunningResponse = {
  kernels: RunningItem[]
  terminals: RunningItem[]
}

export type WorkspaceApi = {
  getHealth(): Promise<HealthResponse>
  getWorkspace(): Promise<WorkspaceSummary>
  listFiles(path?: string): Promise<FileEntry[]>
  readFile(path: string): Promise<FileContent>
  writeFile(path: string, content: string): Promise<FileContent>
  createDirectory(path: string): Promise<FileEntry>
  deletePath(path: string): Promise<void>
  readNotebook(path: string): Promise<NotebookDocument>
  writeNotebook(path: string, notebook: NotebookDocument['notebook']): Promise<NotebookDocument>
  listKernels(): Promise<KernelSummary[]>
  listKernelSpecs(): Promise<KernelSpecSummary[]>
  startKernel(kernelName?: string): Promise<KernelSummary>
  execute(kernelId: string, code: string, timeout?: number): Promise<ExecuteResponse>
  interruptKernel(kernelId: string): Promise<KernelSummary>
  restartKernel(kernelId: string): Promise<KernelSummary>
  shutdownKernel(kernelId: string): Promise<void>
  terminalExecute(command: string, cwd?: string, timeout?: number): Promise<TerminalExecuteResponse>
  getRunning(): Promise<RunningResponse>
}

export * from './pigent.ts'
