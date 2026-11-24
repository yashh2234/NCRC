/** Keys and order of the free AI services that read WhatsApp inquiries. */
import { request } from './api'

export interface AiProvider {
  provider: 'gemini' | 'groq' | 'openrouter'
  label: string
  has_key: boolean
  key_end: string
  model: string
  enabled: boolean
  paused_until: string | null
  last_error: string | null
  last_ok_at: string | null
}

export interface AiProviderInput {
  provider: string
  api_key: string
  remove_key: boolean
  model: string
  enabled: boolean
}

export const aiProvidersApi = {
  list: () => request<{ data: AiProvider[] }>('/ai-providers').then((r) => r.data),
  save: (providers: AiProviderInput[]) => request<{ data: AiProvider[] }>('/ai-providers', { method: 'PUT', body: JSON.stringify({ providers }) }).then((r) => r.data),
  test: (provider: string) => request<{ ok: boolean; data: AiProvider }>(`/ai-providers/${provider}/test`, { method: 'POST' }),
}

/** Where a free key is made */
export const KEY_PAGES: Record<AiProvider['provider'], string> = {
  gemini: 'https://aistudio.google.com/apikey',
  groq: 'https://console.groq.com/keys',
  openrouter: 'https://openrouter.ai/settings/keys',
}
