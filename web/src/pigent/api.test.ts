import { describe, expect, it } from 'vitest'
import { createPigentApi } from './api'

describe('Pigent API URLs', () => {
  it('keeps artifact requests on the selected Runtime base', () => {
    const api = createPigentApi('https://runtime.example/base/')
    expect(api.artifactUrl('a/b')).toBe('https://runtime.example/base/api/v1/pigent/artifacts/a%2Fb')
    expect(api.artifactUrl('a/b', true)).toBe('https://runtime.example/base/api/v1/pigent/artifacts/a%2Fb?download=true')
  })
})
