export type CloudSecret = { id: string; provider: string; displayName: string; reference: string; environment: 'development' | 'staging' | 'production'; status: 'pending' | 'active' | 'revoked'; activeVersion: number; rotationState: 'stable' | 'rotation_required' | 'rotating'; expiresAt: string | null; lastUsedAt: string | null; fieldKind: 'password' | 'api_token' | 'refresh_token' | 'client_secret' | 'recovery_code' | 'cookie' | 'ssh_key' | 'custom'; tags: string[]; aliases: string[]; healthStatus: 'unknown' | 'healthy' | 'attention' | 'failed'; lastRotatedAt: string | null; deletedAt: string | null; purgeAfter: string | null };
export type CloudAuditEvent = { id: string; eventType: string; actorType: string; actorId: string; reference: string | null; secretVersion: number | null; createdAt: string };
export type Environment = { id: string; label: 'development' | 'staging' | 'production'; project_id: string; project_name: string };
export type AppBootstrap = { user: { id: string; email: string; name: string; createdAt: string }; workspaceId: string; environments: Environment[]; secrets: CloudSecret[]; audit: CloudAuditEvent[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase();
  const mutationHeaders = method === 'GET' ? {} : { 'X-ACCX-Request-Timestamp': String(Date.now()), 'X-ACCX-Request-Nonce': crypto.randomUUID().replace(/-/g, '') };
  const response = await fetch(path, { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...mutationHeaders, ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { error?: string }).error || 'Cloud request failed');
  return payload as T;
}
export const accxApi = {
  session: () => request<{ user: AppBootstrap['user'] | null }>('/api/v1/auth/session'),
  login: (email: string, password: string) => request<{ user: AppBootstrap['user'] }>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) => request<{ user: AppBootstrap['user'] }>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  logout: () => request<{ ok: boolean }>('/api/v1/auth/logout', { method: 'POST' }),
  bootstrap: () => request<AppBootstrap>('/api/v1/app/bootstrap'),
  createMetadata: (input: { environmentId: string; provider: string; displayName: string; reference: string; fieldKind: CloudSecret['fieldKind']; tags: string[]; aliases: string[] }) => request<{ secret: CloudSecret }>('/api/v1/app/secrets', { method: 'POST', body: JSON.stringify(input) }),
  updateMetadata: (input: { secretId: string; tags: string[]; aliases: string[]; healthStatus: CloudSecret['healthStatus']; expiresAt: string | null }) => request<{ updated: boolean }>('/api/v1/app/secrets/lifecycle', { method: 'POST', body: JSON.stringify({ operation: 'metadata', ...input }) }),
  stepUpTotp: (code: string) => request<{ verified: boolean }>('/api/v1/auth/step-up', { method: 'POST', body: JSON.stringify({ method: 'totp', code }) }),
  revokeMetadata: (secretId: string, reason: string) => request<{ revoked: boolean }>('/api/v1/app/secrets/lifecycle', { method: 'POST', body: JSON.stringify({ operation: 'revoke', secretId, reason }) }),
  exportVault: (workspaceId: string) => request<{ bundle: unknown }>('/api/v1/app/vault/export', { method: 'POST', body: JSON.stringify({ workspaceId }) }),
  importVault: (workspaceId: string, bundle: unknown) => request<{ imported: number }>('/api/v1/app/vault/import', { method: 'POST', body: JSON.stringify({ workspaceId, bundle }) }),
};
