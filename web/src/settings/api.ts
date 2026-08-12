import { jsonRequest } from '../api/client'

export type PigentProviderSummary = {
  provider_id: string
  credential_type?: string | null
  configured: boolean
  base_url_configured: boolean
}

export type PigentConfigResponse = {
  settings: Record<string, unknown>
  settings_revision: string
  auth_revision: string
  providers: PigentProviderSummary[]
  config_files: string[]
}

export function createSettingsApi(apiBase: string) {
  return {
    config: () => jsonRequest<PigentConfigResponse>(apiBase, '/api/v1/pigent/config'),
    setModel: (provider: string, model: string, revision: string) =>
      jsonRequest<{ revision: string }>(apiBase, '/api/v1/pigent/config/model', {
        method: 'PUT',
        body: JSON.stringify({ defaultProvider: provider, defaultModel: model, revision }),
      }),
    saveProvider: (providerId: string, body: Record<string, unknown>) =>
      jsonRequest<{ revision: string }>(apiBase, `/api/v1/pigent/auth/${encodeURIComponent(providerId)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    removeProvider: (providerId: string) =>
      jsonRequest<void>(apiBase, `/api/v1/pigent/auth/${encodeURIComponent(providerId)}`, { method: 'DELETE' }),
  }
}
