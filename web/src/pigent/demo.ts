import type { PigentEvent, PigentSession, TasksSnapshot } from './types'

const now = new Date().toISOString()
export const demoTasks: TasksSnapshot = {
  revision: 'demo-1',
  root: {
    id: 'root', title: '修复稀疏度骤降渲染', status: 'running', children: [
      { id: '1', title: '定位骤降层区间', status: 'done' },
      { id: '2', title: '读取 compute_sparsity.py', status: 'done' },
      { id: '3', title: '调整滑动窗口并重新运行', status: 'running' },
      { id: '4', title: '验证相邻层稀疏度一致性', status: 'pending' },
    ],
  },
}

export const demoSession: PigentSession = {
  id: 'demo-pigent-session', account_id: 'demo', project_id: 'demo', workspace_id: 'demo', node_id: 'local',
  mode: 'auto', approval_preference: 'automatic', status: 'active', title: '修复稀疏度骤降渲染',
  created_at: now, last_activity_at: now, model: { provider: 'configured provider', model: 'active model' }, tasks_snapshot: demoTasks,
}

export const demoEvents: PigentEvent[] = [
  { version: 1, event_id: 1, session_id: demoSession.id, type: 'session.created', timestamp: now, payload: { session: demoSession } },
  { version: 1, event_id: 2, session_id: demoSession.id, type: 'tasks.snapshot', timestamp: now, payload: { snapshot: demoTasks } },
  { version: 1, event_id: 3, session_id: demoSession.id, type: 'tool.start', timestamp: now, payload: { tool_call_id: 'demo-read', tool: 'read', summary: '读取 compute_sparsity.py' } },
  { version: 1, event_id: 4, session_id: demoSession.id, type: 'tool.end', timestamp: now, payload: { tool_call_id: 'demo-update', tool: 'update', summary: '将 window 从 4 更新为 8', diff: '- window=4\n+ window=8' } },
  { version: 1, event_id: 5, session_id: demoSession.id, type: 'kernel.updated', timestamp: now, payload: { summary: '重新计算 layer 12–20', output: 'layer 12  0.71\nlayer 18  0.66' } },
  { version: 1, event_id: 6, session_id: demoSession.id, type: 'assistant.text', timestamp: now, payload: { text: '已定位到滑动窗口过小造成的视觉骤降，正在验证相邻层一致性。' } },
]
