import { GatewayError } from './errors.js';
export { GatewayError } from './errors.js';
const COLD_START_TIMEOUT_MS = 120_000;
const MAX_REQUEST_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [1_000, 4_000];
function isRetryableNetworkError(err) {
    if (err?.name === 'TimeoutError')
        return true;
    const code = err?.code;
    if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === 'EAI_AGAIN') {
        return true;
    }
    if (err instanceof TypeError && err.message.includes('fetch')) {
        return true;
    }
    return false;
}
/** Network/5xx failures mean offline. 409 is a conflict, not offline. */
export function isConnectivityError(err) {
    if (err instanceof GatewayError) {
        return err.statusCode >= 500 || err.statusCode === 0;
    }
    if (err instanceof TypeError && err.message.includes('fetch')) {
        return true;
    }
    const code = err.code;
    if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === 'EAI_AGAIN') {
        return true;
    }
    return false;
}
export class GatewayClient {
    gatewayUrl;
    apiKey;
    constructor(gatewayUrl, apiKey = '') {
        this.gatewayUrl = gatewayUrl.replace(/\/+$/, '');
        this.apiKey = apiKey;
    }
    headers() {
        const h = { 'Content-Type': 'application/json' };
        if (this.apiKey) {
            h['X-API-Key'] = this.apiKey;
        }
        return h;
    }
    async fetchWithRetry(url, init) {
        let lastErr;
        for (let attempt = 0; attempt < MAX_REQUEST_ATTEMPTS; attempt++) {
            if (attempt > 0) {
                const delay = RETRY_BACKOFF_MS[attempt - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
            try {
                return await fetch(url, { ...init, signal: AbortSignal.timeout(COLD_START_TIMEOUT_MS) });
            }
            catch (err) {
                lastErr = err;
                if (!isRetryableNetworkError(err)) {
                    throw new GatewayError(0, err instanceof Error ? err.message : String(err));
                }
            }
        }
        throw new GatewayError(0, lastErr instanceof Error ? lastErr.message : String(lastErr));
    }
    async request(method, path, params, body) {
        const url = params ? `${this.gatewayUrl}${path}?${params.toString()}` : `${this.gatewayUrl}${path}`;
        const resp = await this.fetchWithRetry(url, {
            method,
            headers: this.headers(),
            body: body !== undefined ? JSON.stringify(body) : undefined,
            redirect: 'follow',
        });
        if (resp.status >= 400) {
            let detail = null;
            try {
                detail = await resp.json();
            }
            catch {
                // non-JSON error body
            }
            const msg = detail?.error ||
                detail?.message ||
                detail?.detail ||
                `HTTP ${resp.status}`;
            throw new GatewayError(resp.status, msg, detail);
        }
        if (resp.status === 204 || (resp.headers.get('content-length') === '0' && !(resp.headers.get('content-type') || '').includes('json'))) {
            return undefined;
        }
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
            return (await resp.json());
        }
        const buf = Buffer.from(await resp.arrayBuffer());
        return buf;
    }
    /** Login issues a fresh cloud API key (the previous key is invalidated). */
    async login(email, password) {
        return this.request('POST', '/auth/login', undefined, { email, password });
    }
    /** Register creates the account and returns the first cloud API key. */
    async registerEmail(email, username, password) {
        return this.request('POST', '/auth/register', undefined, {
            email,
            username,
            password,
        });
    }
    /** Mint a fresh API key for the current user (the old key is invalidated). */
    async mintApiKey() {
        return this.request('POST', '/auth/api-key');
    }
    async authMe() {
        return this.request('GET', '/auth/me');
    }
    async listProjects() {
        return this.request('GET', '/projects');
    }
    async createProject(name, description = '') {
        return this.request('POST', '/projects', undefined, { name, description });
    }
    async listDatabases(projectId) {
        return this.request('GET', `/projects/${encodeURIComponent(projectId)}/databases`);
    }
    async createDatabase(projectId, name, description = '') {
        return this.request('POST', `/projects/${encodeURIComponent(projectId)}/databases`, undefined, { name, description });
    }
    async ensureProject(name, description = '') {
        const projects = (await this.listProjects());
        const existing = projects.find((p) => p.name === name);
        if (existing)
            return existing;
        return this.createProject(name, description);
    }
    async ensureDatabase(projectId, name, description = '') {
        const dbs = (await this.listDatabases(projectId));
        const existing = dbs.find((d) => d.name === name);
        if (existing)
            return existing;
        return this.createDatabase(projectId, name, description);
    }
    async upload(params) {
        const payload = {
            file_data: params.file_bytes.toString('base64'),
            version_type: params.version_type || 'full',
            version: params.version,
        };
        if (params.database_name)
            payload.database_name = params.database_name;
        if (params.database_id)
            payload.database_id = params.database_id;
        if (params.project_id)
            payload.project_id = params.project_id;
        if (params.storage_channel)
            payload.storage_channel = params.storage_channel;
        if (params.log_channel)
            payload.log_channel = params.log_channel;
        return this.request('POST', '/upload', undefined, payload);
    }
    async download(database_name = '', version, database_id = '', project_id = '', storage_channel = '') {
        const params = new URLSearchParams();
        if (database_id)
            params.set('database_id', database_id);
        else if (database_name)
            params.set('database_name', database_name);
        if (project_id)
            params.set('project_id', project_id);
        if (version !== undefined)
            params.set('version', String(version));
        if (storage_channel)
            params.set('storage_channel', storage_channel);
        const url = `${this.gatewayUrl}/download?${params.toString()}`;
        const resp = await this.fetchWithRetry(url, {
            method: 'GET',
            headers: this.headers(),
            redirect: 'follow',
        });
        if (resp.status >= 400) {
            let detail = null;
            try {
                detail = await resp.json();
            }
            catch {
                // ignore
            }
            throw new GatewayError(resp.status, detail?.detail || detail?.error || `HTTP ${resp.status}`, detail);
        }
        const bytes = Buffer.from(await resp.arrayBuffer());
        const versionHeader = resp.headers.get('x-version');
        return {
            bytes,
            version: versionHeader !== null ? Number(versionHeader) || null : null,
            message_id: resp.headers.get('x-message-id'),
        };
    }
    async status() {
        return this.request('GET', '/status');
    }
    async versions(database_name) {
        const params = new URLSearchParams();
        params.set('database_name', database_name);
        return this.request('GET', '/versions', params);
    }
    async rollback(database_name, target_version) {
        return this.request('POST', '/rollback', undefined, {
            database_name,
            target_version,
        });
    }
}
