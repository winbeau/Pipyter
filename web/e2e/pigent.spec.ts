import { expect, test, type Page, type Route } from '@playwright/test'

const viewports = [
  { width: 1440, height: 900 },
  { width: 1360, height: 860 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
]

const now = '2026-08-12T12:00:00.000Z'
const session = (id: string, title: string, status: 'active' | 'completed' | 'failed' | 'interrupted' | 'waiting_for_user' = 'active') => ({
  id, account_id: 'local', project_id: 'project', workspace_id: 'workspace', node_id: 'local', mode: 'ask',
  approval_preference: 'automatic', status, title, created_at: now, last_activity_at: now,
  model: { provider: 'faux', model: 'deterministic' },
})
const capabilities = {
  protocol_version: '0.2',
  tools: ['read', 'view', 'write', 'update', 'bash', 'notebook', 'kernel', 'inspect', 'tasks', 'delegate'],
  modes: {
    ask: ['read', 'view', 'notebook', 'kernel', 'inspect', 'delegate'],
    plan: ['read', 'view', 'notebook', 'kernel', 'inspect', 'delegate', 'tasks'],
    auto: ['read', 'view', 'write', 'update', 'bash', 'notebook', 'kernel', 'inspect', 'tasks', 'delegate'],
  },
  capabilities: [], event_types: [], model: { provider: 'faux', model: 'deterministic' },
  models: [
    { id: 'deepseek:deepseek-v4-flash', provider: 'deepseek', model: 'deepseek-v4-flash', label: 'deepseek-v4-flash', configured: true },
    { id: 'deepseek:deepseek-v4-pro', provider: 'deepseek', model: 'deepseek-v4-pro', label: 'deepseek-v4-pro', configured: true },
    { id: 'faux:deterministic', provider: 'faux', model: 'deterministic', label: 'Deterministic', configured: true },
  ], settings_revision: 'sha256:test',
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

async function installMockRuntime(page: Page) {
  const state = {
    sessions: [session('session-1', 'Existing session'), session('session-older', 'Archived analysis', 'completed')],
    created: 1,
    run: 0,
    projectBodies: [] as Record<string, unknown>[],
    decisionBodies: [] as Record<string, unknown>[],
    aborts: 0,
  }
  await page.addInitScript(() => {
    class MockWebSocket {
      static OPEN = 1
      readyState = 1
      url: string
      onopen: ((event: Event) => void) | null = null
      onmessage: ((event: MessageEvent) => void) | null = null
      onerror: ((event: Event) => void) | null = null
      onclose: ((event: CloseEvent) => void) | null = null
      constructor(url: string | URL) {
        this.url = String(url)
        const id = /\/sessions\/([^/]+)\/stream/.exec(this.url)?.[1] ?? 'session-1'
        const sockets = ((window as unknown as { __mockPigentSockets?: MockWebSocket[] }).__mockPigentSockets ??= [])
        sockets.push(this)
        queueMicrotask(() => {
          this.onopen?.(new Event('open'))
          this.onmessage?.(new MessageEvent('message', { data: JSON.stringify({
            version: 1, event_id: null, session_id: id, type: 'reconnect.cursor', timestamp: '2026-08-12T12:00:00.000Z',
            payload: { session: { id, account_id: 'local', project_id: 'project', workspace_id: 'workspace', node_id: 'local', mode: 'ask', approval_preference: 'automatic', status: 'active', title: id === 'session-1' ? 'Existing session' : 'New session', created_at: '2026-08-12T12:00:00.000Z', last_activity_at: '2026-08-12T12:00:00.000Z', model: { provider: 'faux', model: 'deterministic' } }, tasks: null, active_calls: [], run_active: false, after_event_id: 0 },
          }) }))
        })
      }
      close() { this.readyState = 3 }
      testDisconnect() { this.readyState = 3; this.onclose?.(new CloseEvent('close')) }
      send() {}
      addEventListener() {}
      removeEventListener() {}
    }
    Object.defineProperty(window, 'WebSocket', { value: MockWebSocket, configurable: true })
  })
  await page.route('**/api/v1/terminals**', async (route) => json(route, []))
  await page.route('**/api/v1/workspace', async (route) => json(route, {
    root: '/home/winbeau/Projects/Pipyter',
    workspace_id: 'workspace',
    project_id: 'project',
  }))
  await page.route('**/api/v1/kernels/specs', async (route) => json(route, [
    { name: 'python3', display_name: 'Python 3', language: 'python' },
    { name: 'julia-1.11', display_name: 'Julia 1.11', language: 'julia' },
  ]))
  await page.route('**/api/v1/pigent/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    if (path === '/api/v1/pigent/capabilities') return json(route, capabilities)
    if (path === '/api/v1/pigent/sessions' && method === 'GET') {
      const query = (url.searchParams.get('query') ?? '').toLowerCase()
      return json(route, state.sessions.filter((item) => !query || item.title.toLowerCase().includes(query)))
    }
    if (path === '/api/v1/pigent/sessions' && method === 'POST') {
      const created = session(`session-new-${state.created++}`, 'New session')
      state.sessions.unshift(created)
      return json(route, created, 201)
    }
    if (path === '/api/v1/pigent/projects/sessions' && method === 'POST') {
      state.projectBodies.push(request.postDataJSON() as Record<string, unknown>)
      const created = session(`session-project-${state.created++}`, 'New session')
      state.sessions.unshift(created)
      return json(route, created, 201)
    }
    const sessionMatch = /^\/api\/v1\/pigent\/sessions\/([^/]+)$/.exec(path)
    if (sessionMatch && method === 'PATCH') {
      const body = request.postDataJSON() as { title: string }
      const item = state.sessions.find((candidate) => candidate.id === sessionMatch[1])!
      item.title = body.title
      return json(route, item)
    }
    if (sessionMatch && method === 'DELETE') {
      state.sessions = state.sessions.filter((candidate) => candidate.id !== sessionMatch[1])
      return route.fulfill({ status: 204 })
    }
    const historyMatch = /^\/api\/v1\/pigent\/sessions\/([^/]+)\/events$/.exec(path)
    if (historyMatch) return json(route, { events: [], has_more: false, before_event_id: null })
    const messageMatch = /^\/api\/v1\/pigent\/sessions\/([^/]+)\/messages$/.exec(path)
    if (messageMatch && method === 'POST') {
      const body = request.postDataJSON() as { client_message_id: string }
      const current = ++state.run
      return json(route, { accepted: true, client_message_id: body.client_message_id, run_id: `run-${current}`, turn_id: `turn-${current}` }, 202)
    }
    const abortMatch = /^\/api\/v1\/pigent\/sessions\/([^/]+)\/abort$/.exec(path)
    if (abortMatch && method === 'POST') { state.aborts += 1; return json(route, { accepted: true, already_settled: false }, 202) }
    const interactionMatch = /^\/api\/v1\/pigent\/interactions\/([^/]+)$/.exec(path)
    if (interactionMatch && method === 'POST') {
      state.decisionBodies.push(request.postDataJSON() as Record<string, unknown>)
      return json(route, { receipt: { outcome: 'success', summary: 'Approved once' } })
    }
    return json(route, { detail: `Unhandled mock route: ${method} ${path}` }, 500)
  })
  return state
}

for (const viewport of viewports) {
  test(`Pigent shell is responsive at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await installMockRuntime(page)
    await page.setViewportSize(viewport)
    await page.goto('/#/pigent')
    await expect(page.getByText('Pigent', { exact: true }).first()).toBeVisible()
    await expect(page.getByLabel('Message Pigent')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Pigent mode', exact: true })).toContainText('Ask')
    await expect(page.getByRole('button', { name: '新建对话' })).toBeVisible()
    await expect(page.getByRole('button', { name: '新建项目' })).toBeVisible()
    const body = await page.locator('body').evaluate((node) => ({ scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }))
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 2)
  })
}

test('send, stop, interaction, artifact, session CRUD, search, and reconnect are wired', async ({ page }) => {
  const mock = await installMockRuntime(page)
  await page.goto('/#/pigent')
  await page.evaluate(() => {
    ;(window as unknown as { __openedArtifactUrls: string[] }).__openedArtifactUrls = []
    window.open = ((url?: string | URL) => {
      ;(window as unknown as { __openedArtifactUrls: string[] }).__openedArtifactUrls.push(String(url ?? ''))
      return null
    }) as typeof window.open
  })
  await expect(page.getByText('Existing session', { exact: true }).first()).toBeVisible()

  await page.getByLabel('Message Pigent').fill('Run the acceptance flow')
  await page.getByRole('button', { name: '发送消息' }).click()
  await expect(page.locator('.design-live-user').getByText('Run the acceptance flow', { exact: true })).toBeVisible()
  await expect.poll(() => mock.run).toBe(1)
  await expect(page.getByRole('button', { name: '停止运行' })).toBeVisible()
  await page.getByRole('button', { name: '停止运行' }).click()
  await expect.poll(() => mock.aborts).toBe(1)

  const interactionEvent = { version: 1, event_id: 1, session_id: 'session-1', type: 'interaction.required', timestamp: now,
    payload: { revision: 1, interaction: { version: 1, interaction_id: 'interaction-1', session_id: 'session-1', tool_call_id: 'tool-1', kind: 'review_request', summary: 'Approve the operation?', choices: ['allow_once', 'reject'] } } }
  const artifactEvent = { version: 1, event_id: 2, session_id: 'session-1', type: 'artifact.created', timestamp: now,
    payload: { artifact: { id: 'artifact-1', kind: 'file', mime: 'text/plain', size: 12, created_at: now, hash: 'sha256:test' } } }
  await page.evaluate(({ interaction, artifact }) => {
    const sockets = (window as unknown as { __mockPigentSockets?: Array<{ onmessage: ((event: MessageEvent) => void) | null }> }).__mockPigentSockets ?? []
    for (const socket of sockets) {
      socket.onmessage?.(new MessageEvent('message', { data: JSON.stringify(interaction) }))
      socket.onmessage?.(new MessageEvent('message', { data: JSON.stringify(artifact) }))
    }
  }, { interaction: interactionEvent, artifact: artifactEvent })
  await expect(page.getByText('Approve the operation?', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '允许一次' }).click()
  await expect.poll(() => mock.decisionBodies.length).toBe(1)
  expect(mock.decisionBodies[0]).toMatchObject({ revision: 1, action_id: 'allow_once' })
  expect(String(mock.decisionBodies[0].decision_id)).toMatch(/^decision_/)
  await page.getByRole('button', { name: 'Open' }).click()
  await page.getByRole('button', { name: 'Download' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __openedArtifactUrls: string[] }).__openedArtifactUrls)).toEqual([
    expect.stringMatching(/\/api\/v1\/pigent\/artifacts\/artifact-1$/),
    expect.stringMatching(/artifact-1\?download=true$/),
  ])

  await page.getByRole('button', { name: '新建对话' }).click()
  await expect(page.locator('.design-session-select').first()).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept('Renamed session'))
  await page.locator('.design-session-select').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: '重命名' }).click()
  await expect(page.getByText('Renamed session', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Archived analysis', { exact: true })).toBeVisible()
  await expect(page.getByText('Renamed session', { exact: true }).first()).toBeVisible()
  await page.getByLabel('Message Pigent').fill('Keep using the active session')
  await page.getByRole('button', { name: '发送消息' }).click()
  await expect(page.getByRole('paragraph').filter({ hasText: 'Keep using the active session' })).toBeVisible()
  expect(mock.created).toBe(2)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Renamed session', exact: true }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: '删除' }).click()
  await expect(page.getByText('Renamed session', { exact: true })).toHaveCount(0)
  const socketsBefore = await page.evaluate(() => (window as unknown as { __mockPigentSockets?: unknown[] }).__mockPigentSockets?.length ?? 0)
  await page.evaluate(() => {
    const sockets = (window as unknown as { __mockPigentSockets?: Array<{ testDisconnect(): void }> }).__mockPigentSockets ?? []
    sockets.at(-1)?.testDisconnect()
  })
  await expect.poll(() => page.evaluate(() => (window as unknown as { __mockPigentSockets?: unknown[] }).__mockPigentSockets?.length ?? 0), { timeout: 3000 }).toBeGreaterThan(socketsBefore)
  await expect(page.getByRole('button', { name: '发送消息' })).toBeVisible()
})

test('Design route uses real sessions and projects live semantic tool aliases', async ({ page }) => {
  await installMockRuntime(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/#/pigent')
  await expect(page.getByRole('heading', { name: 'Existing session' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建对话' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建项目' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Existing session', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: 'Existing session', exact: true }).click({ button: 'right' })
  await expect(page.getByRole('menu', { name: '管理 Existing session' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '打开方式' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '删除' })).toHaveCSS('color', 'rgb(176, 68, 62)')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Pigent model' })).toContainText('Deterministic')

  const events = [
    { version: 1, event_id: 11, session_id: 'session-1', type: 'tool.start', timestamp: now, payload: { tool_call_id: 'notebook-1', tool: 'notebook', arguments: { action: 'update_cell', path: 'analysis.ipynb', cell_id: 'cell-4' } } },
    { version: 1, event_id: 12, session_id: 'session-1', type: 'tool.end', timestamp: now, payload: { tool_call_id: 'notebook-1', tool: 'notebook', status: 'completed', result: { details: { ok: true, summary: 'Notebook update_cell completed', data: { path: 'analysis.ipynb', diff: '@@ -1 +1 @@\n-score = 0.7\n+score = 0.9\n', cell: { index: 3, cell_id: 'cell-4', source: 'score = 0.9' } } } } } },
    { version: 1, event_id: 13, session_id: 'session-1', type: 'tool.start', timestamp: now, payload: { tool_call_id: 'bash-1', tool: 'bash', arguments: { command: 'pnpm test' } } },
    { version: 1, event_id: 14, session_id: 'session-1', type: 'tool.end', timestamp: now, payload: { tool_call_id: 'bash-1', tool: 'bash', status: 'completed', result: { details: { ok: true, summary: 'Command exited with code 0', data: { command: 'pnpm test', stdout: '43 passed', stderr: '', exit_code: 0 } } } } },
    { version: 1, event_id: 15, session_id: 'session-1', type: 'tool.start', timestamp: now, payload: { tool_call_id: 'agent-1', tool: 'delegate', arguments: { profile: 'analysis', task: '检查性能异常' } } },
    { version: 1, event_id: 16, session_id: 'session-1', type: 'tool.end', timestamp: now, payload: { tool_call_id: 'agent-1', tool: 'delegate', status: 'completed', result: { details: { ok: true, summary: 'Analysis complete', data: { result: { status: 'completed', summary: '定位到缓存失效' } } } } } },
    { version: 1, event_id: 17, session_id: 'session-1', type: 'tool.start', timestamp: now, payload: { tool_call_id: 'tasks-1', tool: 'tasks', arguments: { action: 'patch' } } },
    { version: 1, event_id: 18, session_id: 'session-1', type: 'tasks.snapshot', timestamp: now, payload: { snapshot: { revision: '2', root: { id: 'root', title: '实现真实 Agent', status: 'running', children: [{ id: 't1', title: '接入工具流', status: 'running' }] } } } },
    { version: 1, event_id: 19, session_id: 'session-1', type: 'tool.end', timestamp: now, payload: { tool_call_id: 'tasks-1', tool: 'tasks', status: 'completed', result: { details: { ok: true, summary: 'Tasks accepted' } } } },
    { version: 1, event_id: 20, session_id: 'session-1', type: 'settled', timestamp: now, payload: { status: 'completed' } },
  ]
  await page.evaluate((incoming) => {
    const sockets = (window as unknown as { __mockPigentSockets?: Array<{ onmessage: ((event: MessageEvent) => void) | null }> }).__mockPigentSockets ?? []
    for (const event of incoming) sockets.at(-1)?.onmessage?.(new MessageEvent('message', { data: JSON.stringify(event) }))
  }, events)
  const notebook = page.locator('.design-live-tool.is-notebook')
  await expect(notebook.getByRole('button')).toContainText('NotebookUpdateanalysis.ipynb · Cell 4')
  await notebook.getByRole('button').click()
  await expect(notebook.getByText('score = 0.9')).toBeVisible()
  const passive = page.locator('.design-read-group')
  await expect(passive).toContainText('Bash×1')
  await expect(passive).toContainText('43 passed')
  await expect(passive).not.toContainText('pnpm test')
  await expect(passive.getByRole('button')).toHaveCount(0)
  await expect(passive.locator('.design-tool-call-chevron')).toHaveCount(0)
  const agent = page.locator('.design-live-tool.is-agent')
  await expect(agent.getByRole('button')).toContainText('AgentAnalyzer检查性能异常')
  await expect(page.locator('[data-tool="tasks"]')).toHaveCount(0)
  await expect(page.locator('.design-persistent-tasks')).toContainText('接入工具流')

  await page.getByRole('button', { name: 'Pigent model' }).click()
  await expect(page.getByText('deepseek-v4-pro', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
})

test('Design new project loads workspace and kernels and creates a project session', async ({ page }) => {
  const mock = await installMockRuntime(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/#/pigent')

  await page.getByRole('button', { name: '新建项目' }).click()
  const dialog = page.getByRole('dialog', { name: '新建项目' })
  await expect(dialog).toBeVisible()
  const workspace = dialog.getByLabel('Workspace directory')
  await expect(workspace).toHaveValue('/home/winbeau/Projects/Pipyter')
  await workspace.fill('/home/winbeau/Projects/Pipyter/web')
  await dialog.getByLabel('Kernel').selectOption('python3')
  await dialog.getByRole('button', { name: '创建项目' }).click()

  await expect.poll(() => mock.projectBodies).toEqual([{
    mode: 'ask',
    workspace: '/home/winbeau/Projects/Pipyter/web',
    kernel_name: 'python3',
    approval_preference: 'automatic',
  }])
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'New session' })).toBeVisible()
})
