import type {
  ExecuteResponse,
  FileContent,
  FileEntry,
  HealthResponse,
  KernelSpecSummary,
  KernelSummary,
  NotebookDocument,
  RunningResponse,
  WorkspaceSummary,
} from '../../../packages/protocol/src/index'
import { apiUrl, jsonRequest } from '../api/client'
import { demoExecute, demoImageDataUrl, demoListFiles, demoNotebookCells, demoReadText, demoTerminal, demoWorkspace } from './demo'

/** Thrown when the configured Runtime cannot be reached. */
export class ApiUnavailableError extends Error {
  constructor(message = 'Runtime API unavailable') {
    super(message)
  }
}

export class ApiIdentityError extends Error {}

export type RuntimeProbeOptions = {
  allowDemo?: boolean
  expectedNodeId?: string
  expectedWorkspaceId?: string
}

export const demoKernelId = 'demo-kernel'

export type ApiMode = 'api' | 'demo'

function notebookDocument(path: string): NotebookDocument {
  return {
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
  }
}

export interface WorkspaceApiClient {
  mode: ApiMode
  health(): Promise<HealthResponse>
  workspace(): Promise<WorkspaceSummary>
  listFiles(path?: string): Promise<FileEntry[]>
  readFile(path: string): Promise<FileContent>
  writeFile(path: string, content: string): Promise<FileContent>
  imageUrl(path: string): string
  downloadUrl(path: string): string
  createDirectory(path: string): Promise<FileEntry>
  deletePath(path: string): Promise<void>
  readNotebook(path: string): Promise<NotebookDocument>
  writeNotebook(path: string, notebook: NotebookDocument['notebook']): Promise<void>
  listKernels(): Promise<KernelSummary[]>
  listKernelSpecs(): Promise<KernelSpecSummary[]>
  startKernel(name?: string): Promise<KernelSummary>
  execute(kernelId: string, code: string, timeout?: number): Promise<ExecuteResponse>
  interrupt(kernelId: string): Promise<KernelSummary>
  restart(kernelId: string): Promise<KernelSummary>
  shutdown(kernelId: string): Promise<void>
  terminal(command: string, cwd?: string, timeout?: number): Promise<{ stdout: string; stderr: string; exit_code: number }>
  running(): Promise<RunningResponse>
}

/** Probe the runtime. Demo fallback is explicit and only applies to network failure. */
export async function detectMode(apiBase = '', options: RuntimeProbeOptions = {}): Promise<ApiMode> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 2500)
  let response: Response
  try {
    response = await fetch(apiUrl(apiBase, '/api/v1/health'), { signal: controller.signal })
  } catch (error) {
    if (options.allowDemo) return 'demo'
    throw new ApiUnavailableError(error instanceof Error ? `Runtime API unavailable: ${error.message}` : undefined)
  } finally {
    window.clearTimeout(timer)
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new ApiUnavailableError(`Runtime health failed: ${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`)
  }
  const health = await response.json() as HealthResponse
  if (options.expectedNodeId && health.node_id !== options.expectedNodeId) {
    throw new ApiIdentityError(`Runtime node mismatch: expected ${options.expectedNodeId}, received ${health.node_id}`)
  }
  if (options.expectedWorkspaceId && health.workspace_id !== options.expectedWorkspaceId) {
    throw new ApiIdentityError(`Runtime workspace mismatch: expected ${options.expectedWorkspaceId}, received ${health.workspace_id}`)
  }
  return 'api'
}

export function createApiClient(mode: ApiMode, apiBase = ''): WorkspaceApiClient {
  const request = <T,>(path: string, init?: RequestInit) => jsonRequest<T>(apiBase, path, init)
  if (mode === 'api') {
    return {
      mode,
      health: () => request<HealthResponse>('/api/v1/health'),
      workspace: () => request<WorkspaceSummary>('/api/v1/workspace'),
      listFiles: (path = '.') => request<FileEntry[]>(`/api/v1/files?path=${encodeURIComponent(path)}`),
      readFile: (path) => request<FileContent>(`/api/v1/files/content?path=${encodeURIComponent(path)}`),
      writeFile: (path, content) =>
        request<FileContent>(`/api/v1/files/content?path=${encodeURIComponent(path)}`, {
          method: 'PUT',
          body: JSON.stringify({ content }),
        }),
      imageUrl: (path) => apiUrl(apiBase, `/api/v1/files/image?path=${encodeURIComponent(path)}`),
      downloadUrl: (path) => apiUrl(apiBase, `/api/v1/files/download?path=${encodeURIComponent(path)}`),
      createDirectory: (path) =>
        request<FileEntry>('/api/v1/files/directory', { method: 'POST', body: JSON.stringify({ path }) }),
      deletePath: (path) => request<void>(`/api/v1/files?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),
      readNotebook: (path) => request<NotebookDocument>(`/api/v1/notebooks?path=${encodeURIComponent(path)}`),
      writeNotebook: (path, notebook) =>
        request<void>('/api/v1/notebooks', { method: 'PUT', body: JSON.stringify({ path, notebook }) }),
      listKernels: () => request<KernelSummary[]>('/api/v1/kernels'),
      listKernelSpecs: () => request<KernelSpecSummary[]>('/api/v1/kernels/specs'),
      startKernel: (name = 'python3') =>
        request<KernelSummary>('/api/v1/kernels', { method: 'POST', body: JSON.stringify({ kernel_name: name }) }),
      execute: (kernelId, code, timeout = 60) =>
        request<ExecuteResponse>(`/api/v1/kernels/${kernelId}/execute`, {
          method: 'POST',
          body: JSON.stringify({ code, timeout }),
        }),
      interrupt: (kernelId) => request<KernelSummary>(`/api/v1/kernels/${kernelId}/interrupt`, { method: 'POST' }),
      restart: (kernelId) => request<KernelSummary>(`/api/v1/kernels/${kernelId}/restart`, { method: 'POST' }),
      shutdown: (kernelId) => request<void>(`/api/v1/kernels/${kernelId}`, { method: 'DELETE' }),
      terminal: (command, cwd = '.', timeout = 30) =>
        request<{ stdout: string; stderr: string; exit_code: number }>('/api/v1/terminals/execute', {
          method: 'POST',
          body: JSON.stringify({ command, cwd, timeout }),
        }),
      running: () => request<RunningResponse>('/api/v1/running'),
    }
  }

  let demoCount = 2
  return {
    mode,
    health: async () => ({ status: 'ok', protocol_version: '0.1', node_id: 'demo', workspace_id: demoWorkspace.workspace_id }),
    workspace: async () => ({ ...demoWorkspace }),
    listFiles: async (path = '.') => demoListFiles(path),
    readFile: async (path) => ({ path, content: demoReadText(path), encoding: 'utf-8' }),
    writeFile: async (path, content) => ({ path, content, encoding: 'utf-8' }),
    imageUrl: (path) => (path.endsWith('layer_sparsity_curve.png') ? demoImageDataUrl : demoImageDataUrl),
    downloadUrl: (path) => {
      // Demo mode: data URL so the download button still works in-browser.
      const content = demoReadText(path)
      return `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`
    },
    createDirectory: async () => {
      throw new Error('demo: creating directories is not available in demo mode')
    },
    deletePath: async () => {
      throw new Error('demo: deletion is not available in demo mode')
    },
    readNotebook: async (path) => notebookDocument(path),
    writeNotebook: async () => undefined,
    listKernels: async () => [
      { id: demoKernelId, name: 'python3', status: 'idle', execution_count: demoCount },
    ],
    listKernelSpecs: async () => [
      { name: 'python3', display_name: 'Python 3', language: 'python', argv: ['python3'] },
    ],
    startKernel: async () => ({ id: demoKernelId, name: 'python3', status: 'idle', execution_count: demoCount }),
    execute: async (_kernelId, code) => {
      demoCount += 1
      return {
        kernel_id: demoKernelId,
        execution_count: demoCount,
        status: 'idle',
        outputs: demoExecute(code, demoCount),
      }
    },
    interrupt: async () => ({ id: demoKernelId, name: 'python3', status: 'idle', execution_count: demoCount }),
    restart: async () => ({ id: demoKernelId, name: 'python3', status: 'idle', execution_count: 0 }),
    shutdown: async () => undefined,
    terminal: async (command) => {
      const result = demoTerminal(command)
      return { stdout: result.stdout, stderr: result.stderr, exit_code: result.exitCode }
    },
    running: async () => ({
      kernels: [{ id: demoKernelId, kind: 'kernel', name: 'python3 · demo', path: '.', status: 'idle' }],
      terminals: [],
    }),
  }
}
