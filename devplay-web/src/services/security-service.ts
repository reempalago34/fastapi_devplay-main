/**
 * Servicio de Seguridad
 */

const API_BASE = '/api/devplay'

async function fetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    credentials: 'include',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Error de red' }))
    throw new Error(data.error || `Error ${res.status}`)
  }
  return res.json()
}

export const securityService = {
  changePassword: (currentPassword: string, newPassword: string) =>
    fetchJson('/api/devplay/security/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  block: (blockedId: string) =>
    fetchJson('/api/devplay/security/block', {
      method: 'POST',
      body: JSON.stringify({ blockedId }),
    }),

  unblock: (blockedId: string) =>
    fetchJson(`/api/devplay/security/block?blockedId=${blockedId}`, { method: 'DELETE' }),

  getBlocked: () =>
    fetchJson<{ blocked: any[] }>('/api/devplay/security/block/list'),

  report: (data: { type: string; entityId: string; reason: string; description?: string }) =>
    fetchJson('/api/devplay/security/report', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  requestDeleteCode: () =>
    fetchJson<{ ok: boolean; email: string; expiresAt: string; devCode?: string }>('/api/devplay/security/account', {
      method: 'POST',
      body: JSON.stringify({ action: 'request-code' }),
    }),

  verifyDeleteCode: (code: string) =>
    fetchJson('/api/devplay/security/account', {
      method: 'POST',
      body: JSON.stringify({ action: 'verify-code', code }),
    }),

  confirmDeleteAccount: (code: string, password: string, confirm: string) =>
    fetchJson('/api/devplay/security/account', {
      method: 'POST',
      body: JSON.stringify({ action: 'confirm', code, password, confirm }),
    }),

  setPrivacy: (isPrivate: boolean) =>
    fetchJson('/api/devplay/security/privacy', {
      method: 'PATCH',
      body: JSON.stringify({ isPrivate }),
    }),

  getLoginEvents: () =>
    fetchJson<{ events: any[] }>('/api/devplay/security/login-events'),
}
