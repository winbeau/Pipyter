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
  models: [{ provider: 'faux', model: 'deterministic', label: 'Deterministic', configured: true }], settings_revision: 'sha256:test',
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

async function installMockRuntime(page: Page) {
  const state = {
    sessions: [session('session-1', 'Existing session'), session('session-older', 'Archived analysis', 'completed')],
    created: 1,
    run: 0,
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
    await expect(page.getByRole('radiogroup', { name: 'Pigent mode' })).toBeVisible()
    if (viewport.width <= 1024) {
      await page.getByRole('button', { name: '打开 Pigent 会话列表' }).click()
      await expect(page.getByText('当前 Workspace').first()).toBeVisible()
      await page.getByRole('button', { name: '关闭 Pigent 会话列表' }).click()
    }
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
  await expect(page.getByText('Run the acceptance flow', { exact: true })).toBeVisible()
  await expect(page.getByText('accepted', { exact: true })).toBeVisible()
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

  await page.getByRole('button', { name: 'New session' }).click()
  await expect(page.getByText('New session', { exact: true }).first()).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept('Renamed session'))
  await page.getByRole('button', { name: 'Manage New session' }).click()
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  await expect(page.getByText('Renamed session', { exact: true }).first()).toBeVisible()
  await page.getByPlaceholder('Search').fill('Archived')
  await expect(page.getByText('Archived analysis', { exact: true })).toBeVisible()
  await expect(page.getByText('Renamed session', { exact: true })).toHaveCount(0)
  await page.getByLabel('Message Pigent').fill('Keep using the active session')
  await page.getByRole('button', { name: '发送消息' }).click()
  await expect(page.getByRole('paragraph').filter({ hasText: 'Keep using the active session' })).toBeVisible()
  expect(mock.created).toBe(2)
  await page.getByPlaceholder('Search').fill('')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Manage Renamed session' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(page.getByText('Renamed session', { exact: true })).toHaveCount(0)
  const socketsBefore = await page.evaluate(() => (window as unknown as { __mockPigentSockets?: unknown[] }).__mockPigentSockets?.length ?? 0)
  await page.evaluate(() => {
    const sockets = (window as unknown as { __mockPigentSockets?: Array<{ testDisconnect(): void }> }).__mockPigentSockets ?? []
    sockets.at(-1)?.testDisconnect()
  })
  await expect(page.getByText('disconnected', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __mockPigentSockets?: unknown[] }).__mockPigentSockets?.length ?? 0), { timeout: 3000 }).toBeGreaterThan(socketsBefore)
  await expect(page.getByText('connected', { exact: true })).toBeVisible()
})
