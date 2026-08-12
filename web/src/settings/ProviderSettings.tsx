import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRuntime } from '../runtime/RuntimeProvider'
import { createSettingsApi, type PigentConfigResponse } from './api'

const fieldStyle = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5 } as const
const buttonStyle = { padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' } as const

export function ProviderSettings() {
  const { target } = useRuntime()
  const api = useMemo(() => createSettingsApi(target.apiBase), [target.apiBase])
  const [config, setConfig] = useState<PigentConfigResponse | null>(null)
  const [providerId, setProviderId] = useState('')
  const [modelId, setModelId] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const secureTransport = window.isSecureContext

  const refresh = useCallback(async () => {
    try {
      const value = await api.config()
      setConfig(value)
      const currentProvider = typeof value.settings.defaultProvider === 'string' ? value.settings.defaultProvider : ''
      const currentModel = typeof value.settings.defaultModel === 'string' ? value.settings.defaultModel : ''
      setProviderId((existing) => existing || currentProvider)
      setModelId((existing) => existing || currentModel)
      setMessage('')
    } catch (error) {
      setConfig(null)
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }, [api])

  useEffect(() => { void refresh() }, [refresh])

  const save = async () => {
    if (!config || !providerId.trim() || !modelId.trim()) return
    setBusy(true); setMessage('')
    try {
      if (baseUrl.trim() || apiKey.trim()) {
        const body: Record<string, unknown> = {
          type: 'api_key',
          revision: config.auth_revision,
        }
        if (baseUrl.trim()) body.baseUrl = baseUrl.trim()
        if (apiKey.trim()) body.key = apiKey.trim()
        await api.saveProvider(providerId.trim(), body)
      }
      await api.setModel(providerId.trim(), modelId.trim(), config.settings_revision)
      setApiKey('')
      await refresh()
      setMessage('Saved on the selected compute Runtime. Stored secrets remain write-only.')
    } catch (error) {
      const failure = error instanceof Error ? error.message : String(error)
      await refresh()
      setMessage(failure)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm(`Remove Provider credentials for “${id}”?`)) return
    setBusy(true)
    try { await api.removeProvider(id); await refresh() }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  return (
    <>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>AI Providers</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 12 }}>
        Settings are written on {target.node.name} · {target.workspace.name}. Provider traffic originates from that Runtime.
      </div>
      {!secureTransport && <div style={{ padding: '9px 11px', borderRadius: 6, background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 12, marginBottom: 16 }}>HTTP compatibility mode: Provider keys can be saved, but the browser → Pi5 segment is not encrypted. Pi5 → AutoDL remains HTTPS. Use https://192.168.3.250:8443 when transport confidentiality is required.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <label><div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 5 }}>Provider ID</div><input style={fieldStyle} value={providerId} onChange={(event) => setProviderId(event.target.value)} placeholder="openai" /></label>
        <label><div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 5 }}>Default model</div><input style={fieldStyle} value={modelId} onChange={(event) => setModelId(event.target.value)} placeholder="gpt-5" /></label>
      </div>
      <label style={{ display: 'block', marginBottom: 12 }}><div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 5 }}>API base URL (optional)</div><input style={fieldStyle} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" /></label>
      <label style={{ display: 'block', marginBottom: 12 }}><div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 5 }}>API key / environment reference</div><input type="password" autoComplete="off" style={fieldStyle} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Write-only; leave blank to preserve the current secret" /></label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 22 }}>
        <button type="button" style={{ ...buttonStyle, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }} disabled={busy || !config} onClick={() => void save()}>{busy ? 'Saving…' : 'Save Provider & model'}</button>
        <button type="button" style={buttonStyle} disabled={busy} onClick={() => void refresh()}>Refresh</button>
      </div>
      {message && <div style={{ padding: '9px 11px', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 12, marginBottom: 16 }}>{message}</div>}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Configured Providers</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        {(config?.providers ?? []).length === 0 && <div style={{ padding: 14, color: 'var(--text-3)', fontSize: 12 }}>No Provider credentials configured.</div>}
        {(config?.providers ?? []).map((provider, index, providers) => (
          <div key={provider.provider_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderBottom: index < providers.length - 1 ? '1px solid var(--border)' : undefined }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{provider.provider_id}</div><div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{provider.credential_type ?? 'unknown'} · {provider.base_url_configured ? 'custom endpoint' : 'built-in endpoint'}</div></div>
            <span style={{ fontSize: 11, color: provider.configured ? '#3F7A3B' : 'var(--text-2)' }}>{provider.configured ? 'Configured' : 'No secret'}</span>
            <button type="button" style={{ ...buttonStyle, color: 'var(--danger)' }} disabled={busy} onClick={() => void remove(provider.provider_id)}>Remove</button>
          </div>
        ))}
      </div>
      {config && <div style={{ marginTop: 12, fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'var(--mono)', lineHeight: 1.6 }}>settings: {config.settings_path}<br />auth: {config.auth_path}</div>}
    </>
  )
}
