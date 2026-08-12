import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPigentApi } from './api'

describe('Pigent API URLs', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps artifact requests on the selected Runtime base', () => {
    const api = createPigentApi('https://runtime.example/base/')
    expect(api.artifactUrl('a/b')).toBe('https://runtime.example/base/api/v1/pigent/artifacts/a%2Fb')
    expect(api.artifactUrl('a/b', true)).toBe('https://runtime.example/base/api/v1/pigent/artifacts/a%2Fb?download=true')
  })

  it('loads project defaults and posts the project session contract', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init })
      if (url.endsWith('/api/v1/workspace')) return new Response(JSON.stringify({ root: '/srv/lab' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      if (url.endsWith('/api/v1/kernels/specs')) return new Response(JSON.stringify([{ name: 'python3', display_name: 'Python 3', language: 'python' }]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify({ id: 'session-project', mode: 'auto' }), { status: 201, headers: { 'Content-Type': 'application/json' } })
    }))
    const api = createPigentApi('')

    await expect(api.projectCreationOptions()).resolves.toEqual({ defaultWorkspace: '/srv/lab', kernels: [{ name: 'python3', display_name: 'Python 3', language: 'python' }] })
    await api.createProjectSession('auto', { workspace: '/srv/project', kernelName: null })
    const create = requests.find((item) => item.url.endsWith('/api/v1/pigent/projects/sessions'))
    expect(JSON.parse(String(create?.init?.body))).toEqual({ mode: 'auto', workspace: '/srv/project', kernel_name: null, approval_preference: 'automatic' })
  })
})
