export type CloudSecret = { id: string; provider: string; displayName: string; reference: string; environment: 'development' | 'staging' | 'production'; status: 'pending' | 'active' | 'revoked'; activeVersion: number; rotationState: 'stable' | 'rotation_required' | 'rotating'; expiresAt: string | null; lastUsedAt: string | null; fieldKind: 'password' | 'api_token' | 'refresh_token' | 'client_secret' | 'recovery_code' | 'cookie' | 'ssh_key' | 'custom'; tags: string[]; aliases: string[]; healthStatus: 'unknown' | 'healthy' | 'attention' | 'failed'; lastRotatedAt: string | null; deletedAt: string | null; purgeAfter: string | null };
export type CloudAuditEvent = { id: string; eventType: string; actorType: string; actorId: string; reference: string | null; secretVersion: number | null; createdAt: string };
export type Environment = { id: string; label: 'development' | 'staging' | 'production'; project_id: string; project_name: string };
export type AppBootstrap = { user: { id: string; email: string; name: string; createdAt: string }; workspaceId: string; environments: Environment[]; secrets: CloudSecret[]; audit: CloudAuditEvent[] };

export type CloudProject = { id: string; name: string; slug: string; createdAt: string; environments: EnvironmentLabel[] };
export type EnvironmentLabel = 'development' | 'staging' | 'production';
export type CloudEnvVar = { key: string; projectId: string; projectName: string; environmentId: string; environment: EnvironmentLabel; updatedAt: string | null; createdBy: string };
export type CloudPat = { id: string; name: string; scopes: string[]; expiresAt: string | null; lastUsedAt: string | null; createdAt: string; revokedAt: string | null };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase();
  const mutationHeaders = method === 'GET' ? {} : { 'X-ACCX-Request-Timestamp': String(Date.now()), 'X-ACCX-Request-Nonce': crypto.randomUUID().replace(/-/g, '') };
  const response = await fetch(path, { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...mutationHeaders, ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { error?: string }).error || 'Cloud request failed');
  return payload as T;
}
export const accxApi = {
  session: () => request<{ user: AppBootstrap['user'] | null }>('/api/v1/auth?command=session'),
  nexussStart: (provider: 'google' | 'github', next = '/') => request<{ authorizationUrl: string }>(`/api/v1/auth?command=nexuss_start&provider=${encodeURIComponent(provider)}&next=${encodeURIComponent(next)}`),
  login: (email: string, password: string) => request<{ user: AppBootstrap['user'] }>('/api/v1/auth', { method: 'POST', body: JSON.stringify({ command: 'login', email, password }) }),
  register: (name: string, email: string, password: string) => request<{ user: AppBootstrap['user'] }>('/api/v1/auth', { method: 'POST', body: JSON.stringify({ command: 'register', name, email, password }) }),
  logout: () => request<{ ok: boolean }>('/api/v1/auth', { method: 'POST', body: JSON.stringify({ command: 'logout' }) }),
  bootstrap: () => request<AppBootstrap>('/api/v1/app?command=bootstrap'),
  createMetadata: (input: { environmentId: string; provider: string; displayName: string; reference: string; fieldKind: CloudSecret['fieldKind']; tags: string[]; aliases: string[] }) => request<{ secret: CloudSecret }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'create_secret_metadata', ...input }) }),
  updateMetadata: (input: { secretId: string; tags: string[]; aliases: string[]; healthStatus: CloudSecret['healthStatus']; expiresAt: string | null }) => request<{ updated: boolean }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'update_secret_metadata', operation: 'metadata', ...input }) }),
  stepUpTotp: (code: string) => request<{ verified: boolean }>('/api/v1/auth', { method: 'POST', body: JSON.stringify({ command: 'step_up', method: 'totp', code }) }),
  revokeMetadata: (secretId: string, reason: string) => request<{ revoked: boolean }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'revoke_secret', operation: 'revoke', secretId, reason }) }),
  exportVault: (workspaceId: string) => request<{ bundle: unknown }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'export_vault', workspaceId }) }),
  importVault: (workspaceId: string, bundle: unknown) => request<{ imported: number }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'import_vault', workspaceId, bundle }) }),
  listProjects: () => request<{ projects: CloudProject[] }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'list_projects', operation: 'list' }) }),
  createProject: (name: string, slug?: string) => request<{ project: CloudProject }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'create_project', operation: 'create', name, slug }) }),
  renameProject: (projectId: string, name: string) => request<{ renamed: boolean }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'rename_project', operation: 'rename', projectId, name }) }),
  deleteProject: (projectId: string) => request<{ deleted: boolean }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'delete_project', operation: 'delete', projectId }) }),
  addEnvironment: (projectId: string, label: EnvironmentLabel) => request<{ added: boolean }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'add_environment', operation: 'add_environment', projectId, label }) }),
  removeEnvironment: (projectId: string, label: EnvironmentLabel) => request<{ removed: boolean }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'remove_environment', operation: 'remove_environment', projectId, label }) }),
  listEnvironmentVariables: () => request<{ variables: CloudEnvVar[] }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'list_environment_variables', operation: 'list' }) }),
  setEnvironmentVariable: (environmentId: string, key: string, value: string) => request<{ variable: { key: string; updated: boolean } }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'set_environment_variable', operation: 'set', environmentId, key, value }) }),
  deleteEnvironmentVariable: (environmentId: string, key: string) => request<{ deleted: boolean }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'delete_environment_variable', operation: 'delete', environmentId, key }) }),
  listPats: () => request<{ tokens: CloudPat[] }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'list_pats', operation: 'list' }) }),
  createPat: (name: string) => request<{ token: { tokenId: string; token: string; prefix: string; expiresAt: string } }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'create_pat', operation: 'create', name }) }),
  revokePat: (tokenId: string) => request<{ revoked: boolean }>('/api/v1/app', { method: 'POST', body: JSON.stringify({ command: 'revoke_pat', operation: 'revoke', tokenId }) }),
};
