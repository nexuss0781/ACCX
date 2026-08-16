export type CloudSecret = { id: string; provider: string; displayName: string; reference: string; environment: 'development' | 'staging' | 'production'; status: 'pending' | 'active' | 'revoked'; activeVersion: number; rotationState: 'stable' | 'rotation_required' | 'rotating'; expiresAt: string | null; lastUsedAt: string | null };
export type Environment = { id: string; label: 'development' | 'staging' | 'production'; project_id: string; project_name: string };
export type AppBootstrap = { user: { id: string; email: string; name: string; createdAt: string }; workspaceId: string; environments: Environment[]; secrets: CloudSecret[]; audit: unknown[] };

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
  createMetadata: (input: { environmentId: string; provider: string; displayName: string; reference: string }) => request<{ secret: CloudSecret }>('/api/v1/app/secrets', { method: 'POST', body: JSON.stringify(input) }),
};
