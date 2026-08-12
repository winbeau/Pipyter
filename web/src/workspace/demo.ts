import type { FileEntry, KernelOutput } from '../../../packages/protocol/src/index'

/** Deterministic in-browser fallback data used when the Runtime API is unreachable. */

export const demoWorkspace = {
  protocol_version: '0.1' as const,
  node_id: 'demo',
  workspace_id: 'demo-workspace',
  project_id: 'demo-project',
  name: 'LingBot-VA',
  root_name: 'lingbot-va',
  kernel_status: 'idle' as const,
  connection_status: 'disconnected' as const,
  open_documents: [],
}

export const demoNotebookPath = 'notebooks/attention_sparsity/sparsity_curve_analysis.ipynb'

const demoTree: Record<string, string[]> = {
  '': ['notebooks', 'figures', 'data', 'scripts'],
  notebooks: ['attention_sparsity'],
  'notebooks/attention_sparsity': ['sparsity_curve_analysis.ipynb', 'compute_sparsity.py'],
  figures: ['layer_sparsity_curve.png'],
  data: ['sparsity_logs.csv'],
  scripts: [],
}

const demoStat: Record<string, { size?: number; modified?: number }> = {
  'notebooks/attention_sparsity/sparsity_curve_analysis.ipynb': { size: 4820, modified: 1786326000 },
  'notebooks/attention_sparsity/compute_sparsity.py': { size: 2140, modified: 1786325400 },
  'figures/layer_sparsity_curve.png': { size: 96400, modified: 1786324000 },
  'data/sparsity_logs.csv': { size: 15320, modified: 1786323000 },
}

export function demoListFiles(path: string): FileEntry[] {
  const children = demoTree[path] ?? []
  return children.map((name) => {
    const full = path ? `${path}/${name}` : name
    const isDir = demoTree[full] !== undefined
    const stat = demoStat[full]
    return {
      path: full,
      name,
      type: isDir ? 'directory' : name.endsWith('.ipynb') ? 'notebook' : name.endsWith('.png') ? 'image' : 'file',
      size: stat?.size,
      modified: stat?.modified,
      running: false,
    }
  })
}

export function demoReadText(path: string): string {
  if (path.endsWith('compute_sparsity.py')) {
    return [
      '"""Layer-wise attention sparsity estimation for LingBot-VA."""',
      'import numpy as np',
      '',
      '',
      'def layer_sparsity(logs, window=4):',
      '    """Smooth per-layer sparsity with a sliding window."""',
      '    curve = np.convolve(logs, np.ones(window) / window, mode="same")',
      '    return curve',
      '',
      '',
      'if __name__ == "__main__":',
      '    logs = np.loadtxt("data/sparsity_logs.csv", delimiter=",")',
      '    curve = layer_sparsity(logs, window=8)',
      '    print(f"drop region mean: {curve[12:20].mean():.3f}")',
      '',
    ].join('\n')
  }
  if (path.endsWith('.csv')) {
    return 'layer,sparsity\n0,0.81\n4,0.77\n8,0.72\n12,0.61\n16,0.58\n20,0.64\n24,0.71\n28,0.78\n'
  }
  return 'demo file content'
}

export const demoImageDataUrl =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="280" viewBox="0 0 640 280">
      <rect width="640" height="280" fill="#faf7f2"/>
      <g stroke="#e3ddce" stroke-width="1">
        ${Array.from({ length: 7 }, (_, i) => `<line x1="48" y1="${24 + i * 36}" x2="600" y2="${24 + i * 36}"/>`).join('')}
        ${Array.from({ length: 9 }, (_, i) => `<line x1="${48 + i * 62}" y1="20" x2="${48 + i * 62}" y2="240"/>`).join('')}
      </g>
      <polyline fill="none" stroke="#c1622c" stroke-width="2.5" points="48,66 110,60 172,52 234,118 296,138 358,108 420,88 482,74 544,64 600,58"/>
      <circle cx="234" cy="118" r="4" fill="#c1622c"/>
      <circle cx="296" cy="138" r="4" fill="#c1622c"/>
      <text x="48" y="262" font-family="monospace" font-size="11" fill="#a79c89">layer 0</text>
      <text x="556" y="262" font-family="monospace" font-size="11" fill="#a79c89">layer 31</text>
      <text x="48" y="18" font-family="monospace" font-size="12" fill="#6e6656">layer-wise attention sparsity (window=8)</text>
      <rect x="352" y="120" width="248" height="104" fill="none" stroke="#e3ddce" stroke-dasharray="4 3"/>
      <text x="360" y="138" font-family="monospace" font-size="11" fill="#96481c">drop region: layer 12-20</text>
      <text x="360" y="154" font-family="monospace" font-size="11" fill="#96481c">mean sparsity 0.612</text>
    </svg>`,
  )

function demoFigureOutput(): KernelOutput[] {
  return [
    {
      type: 'display_data',
      text: '<matplotlib.figure.Figure at 0x7f6a2c>',
      data: { 'text/plain': '<matplotlib.figure.Figure at 0x7f6a2c>', 'image/svg+xml': demoImageDataUrl },
      name: null,
      traceback: [],
    },
  ]
}

export function demoNotebookCells(): {
  id: string
  cellType: 'code' | 'markdown'
  source: string
  executionCount: number | null
  outputs: KernelOutput[]
}[] {
  return [
    {
      id: 'demo-md-1',
      cellType: 'markdown' as const,
      source:
        '本 Notebook 分析 LingBot-VA 各层注意力头的稀疏度分布，重点关注 **layer 12–20** 区间出现的稀疏度骤降现象。',
      executionCount: null,
      outputs: [],
    },
    {
      id: 'demo-code-1',
      cellType: 'code' as const,
      source: 'import numpy as np\nfrom compute_sparsity import layer_sparsity\n\nlogs = np.loadtxt("data/sparsity_logs.csv", delimiter=",")\ncurve = layer_sparsity(logs, window=8)',
      executionCount: 1,
      outputs: demoFigureOutput(),
    },
    {
      id: 'demo-code-2',
      cellType: 'code' as const,
      source: 'print(f"drop region mean: {curve[12:20].mean():.3f}")',
      executionCount: 2,
      outputs: [{ type: 'stream', text: 'drop region mean: 0.612\n', data: {}, name: 'stdout', traceback: [] }],
    },
  ]
}

/** Deterministic demo kernel: same input always produces the same output. */
export function demoExecute(code: string, executionCount: number): KernelOutput[] {
  const trimmed = code.trim()
  if (/raise\s+\w+/.test(trimmed)) {
    return [
      {
        type: 'error',
        text: "ValueError: demo failure",
        data: {},
        name: null,
        traceback: ['ValueError: demo failure'],
      },
    ]
  }
  if (/layer_sparsity\(logs, window=/.test(trimmed)) {
    return demoFigureOutput()
  }
  if (/curve\[12:20\]\.mean/.test(trimmed)) {
    return [{ type: 'stream', text: 'drop region mean: 0.612\n', data: {}, name: 'stdout', traceback: [] }]
  }
  const sumMatch = trimmed.match(/^(\d+)\s*\+\s*(\d+)$/)
  if (sumMatch) {
    const value = String(Number(sumMatch[1]) + Number(sumMatch[2]))
    return [{ type: 'execute_result', text: value, data: { 'text/plain': value }, name: null, traceback: [] }]
  }
  if (trimmed.startsWith('print(') || trimmed.startsWith('print (')) {
    return [
      {
        type: 'stream',
        text: `${trimmed.replace(/^print\s*\(\s*["']?/, '').replace(/["']?\s*\)\s*$/, '')}\n`,
        data: {},
        name: 'stdout',
        traceback: [],
      },
    ]
  }
  return []
}

export function demoTerminal(command: string): { stdout: string; stderr: string; exitCode: number } {
  const trimmed = command.trim()
  if (trimmed.startsWith('echo ')) return { stdout: trimmed.slice(5) + '\n', stderr: '', exitCode: 0 }
  if (trimmed === 'pwd') return { stdout: '/home/user/lingbot-va\n', stderr: '', exitCode: 0 }
  if (trimmed === 'ls' || trimmed === 'ls -la') {
    return {
      stdout: 'data/  figures/  notebooks/  scripts/\n',
      stderr: '',
      exitCode: 0,
    }
  }
  if (trimmed === 'python3 --version') return { stdout: 'Python 3.11.9\n', stderr: '', exitCode: 0 }
  if (trimmed === 'help') {
    return {
      stdout: 'demo terminal supports: echo, pwd, ls, python3 --version, help\n',
      stderr: '',
      exitCode: 0,
    }
  }
  return { stdout: '', stderr: `demo: unknown command '${trimmed.split(/\s+/)[0]}'\n`, exitCode: 1 }
}
