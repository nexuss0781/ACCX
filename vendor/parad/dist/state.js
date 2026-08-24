import * as fs from 'node:fs';
import * as path from 'node:path';
import { configDir } from './config.js';
// Characters unsafe in a filename segment. Multi-part keys like
// "myproject/mydb" are flattened to "myproject__mydb".
// eslint-disable-next-line no-control-regex -- U+0000–U+001F are intentionally blocked as filename-unsafe
const UNSAFE_STATE_CHARS = /[/\\:*?"<>|\u0000-\u001f]/g;
export function sanitizeStateKey(dbKey) {
    const key = dbKey.replace(UNSAFE_STATE_CHARS, '__').trim().replace(/^\.+|\.+$/g, '');
    if (!key || !/[a-zA-Z0-9]/.test(key)) {
        throw new Error(`db_key must not be empty after sanitizing: ${JSON.stringify(dbKey)}`);
    }
    return key;
}
function defaultState(dbName) {
    return {
        database_name: dbName,
        remote_version: null,
        remote_hash: null,
        last_sync: null,
        last_local_hash: null,
        dirty: false,
        offline: false,
    };
}
function statePath(dbName) {
    return path.join(configDir(), `${sanitizeStateKey(dbName)}.sync.json`);
}
export function loadState(dbName) {
    const p = statePath(dbName);
    try {
        if (fs.existsSync(p)) {
            const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
            return { ...defaultState(dbName), ...parsed };
        }
    }
    catch {
        // corrupt/partial state file -> defaults
    }
    return defaultState(dbName);
}
export function saveState(dbName, state) {
    const p = statePath(dbName);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf-8');
}
export function getRemoteVersion(dbName) {
    const s = loadState(dbName);
    const v = s.remote_version;
    return v === null || v === undefined ? null : Number(v);
}
export function setRemoteVersion(dbName, version, fileHash = '') {
    const s = loadState(dbName);
    s.remote_version = version;
    s.remote_hash = fileHash;
    s.last_sync = new Date().toISOString();
    saveState(dbName, s);
}
export function getLastLocalHash(dbName) {
    return loadState(dbName).last_local_hash;
}
export function setLastLocalHash(dbName, fileHash) {
    const s = loadState(dbName);
    s.last_local_hash = fileHash;
    saveState(dbName, s);
}
export function markDirty(dbKey) {
    const s = loadState(dbKey);
    s.dirty = true;
    saveState(dbKey, s);
}
export function clearDirty(dbKey) {
    const s = loadState(dbKey);
    s.dirty = false;
    saveState(dbKey, s);
}
export function isDirty(dbKey) {
    return Boolean(loadState(dbKey).dirty);
}
export function setOffline(dbKey, offline) {
    const s = loadState(dbKey);
    s.offline = Boolean(offline);
    saveState(dbKey, s);
}
export function isOffline(dbKey) {
    return Boolean(loadState(dbKey).offline);
}
export function getSyncStatus(dbKey) {
    return loadState(dbKey);
}
//# sourceMappingURL=state.js.map