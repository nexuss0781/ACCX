import type { ParadConnection } from "parad";

export function ensureSchema(db: ParadConnection): void {
  db.execute(`CREATE TABLE IF NOT EXISTS control_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  db.execute(`CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)`);
  db.execute(`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(workspace_id, slug))`);
  db.execute(`CREATE TABLE IF NOT EXISTS environments (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, label TEXT NOT NULL CHECK(label IN ('development','staging','production')), created_at TEXT NOT NULL, UNIQUE(project_id, label))`);
  db.execute(`CREATE TABLE IF NOT EXISTS workspace_members (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, subject_id TEXT NOT NULL, subject_type TEXT NOT NULL CHECK(subject_type IN ('human','service')), scopes_json TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(workspace_id, subject_id, subject_type))`);
  db.execute(`CREATE TABLE IF NOT EXISTS secrets (id TEXT PRIMARY KEY, environment_id TEXT NOT NULL, provider TEXT NOT NULL, display_name TEXT NOT NULL, reference TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','active','revoked')), active_version INTEGER NOT NULL DEFAULT 0, rotation_state TEXT NOT NULL CHECK(rotation_state IN ('stable','rotation_required','rotating')), expires_at TEXT, last_used_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(environment_id, reference))`);
  db.execute(`CREATE TABLE IF NOT EXISTS secret_versions (id TEXT PRIMARY KEY, secret_id TEXT NOT NULL, version INTEGER NOT NULL, encrypted_data_key_json TEXT NOT NULL, encrypted_secret_json TEXT NOT NULL, algorithm TEXT NOT NULL, created_at TEXT NOT NULL, activated_at TEXT, revoked_at TEXT, UNIQUE(secret_id, version))`);
  db.execute(`CREATE TABLE IF NOT EXISTS secret_leases (id TEXT PRIMARY KEY, secret_version_id TEXT NOT NULL, service_identity_id TEXT NOT NULL, action TEXT NOT NULL, scopes_json TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL)`);
  db.execute(`CREATE TABLE IF NOT EXISTS service_identities (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, scopes_json TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','revoked')), created_at TEXT NOT NULL, revoked_at TEXT, UNIQUE(project_id, name))`);
  db.execute(`CREATE TABLE IF NOT EXISTS workload_tokens (id TEXT PRIMARY KEY, service_identity_id TEXT NOT NULL, token_digest TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL)`);
  db.execute(`CREATE TABLE IF NOT EXISTS orchestration_jobs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, service_identity_id TEXT NOT NULL, action TEXT NOT NULL, secret_references_json TEXT NOT NULL, required_scopes_json TEXT NOT NULL, input_json TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL, result_json TEXT, created_at TEXT NOT NULL, completed_at TEXT)`);
  db.execute(`CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, project_id TEXT, environment_id TEXT, actor_type TEXT NOT NULL, actor_id TEXT NOT NULL, event_type TEXT NOT NULL, reference TEXT, secret_version INTEGER, metadata_json TEXT NOT NULL, created_at TEXT NOT NULL)`);
  db.execute(`CREATE INDEX IF NOT EXISTS idx_secrets_reference ON secrets(reference)`);
  db.execute(`CREATE INDEX IF NOT EXISTS idx_audit_workspace_created ON audit_events(workspace_id, created_at)`);
  db.execute(`CREATE INDEX IF NOT EXISTS idx_leases_expiry ON secret_leases(expires_at)`);
}
