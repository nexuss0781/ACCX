import { useState, useEffect, useCallback } from 'react';
import Header from '../components/layout/Header';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import { Plus, Key, Trash2, Check, Server, Copy } from 'lucide-react';
import { accxApi } from '../lib/accxApi';
import type { CloudEnvVar, EnvironmentLabel } from '../lib/accxApi';

const ENV_COLORS: Record<EnvironmentLabel, string> = { development: '#10b981', staging: '#f59e0b', production: '#ef4444' };

function SetVarForm({ environments, onClose, onCreated, defaultEnvironmentId }: {
  environments: { id: string; label: EnvironmentLabel; project_name: string }[];
  onClose: () => void;
  onCreated: () => void;
  defaultEnvironmentId?: string;
}) {
  const [environmentId, setEnvironmentId] = useState(defaultEnvironmentId ?? (environments[0]?.id ?? ''));
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !value || !environmentId) return;
    setLoading(true);
    try {
      await accxApi.setEnvironmentVariable(environmentId, key.trim(), value);
      onCreated();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to set variable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p className="text-sm text-danger-theme">{error}</p>}
      <Select
        label="Environment"
        value={environmentId}
        onChange={e => setEnvironmentId(e.target.value)}
        options={environments.map(env => ({ value: env.id, label: `${env.project_name} · ${env.label}` }))}
      />
      <Input label="Variable Name" value={key} onChange={e => setKey(e.target.value)} placeholder="GEMINI_KEY" required />
      <div>
        <label className="text-sm font-medium text-text-primary block mb-1.5">Value</label>
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="sk-..."
          required
          rows={3}
          className="w-full rounded-xl border border-border-theme bg-bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading} icon={<Check className="w-4 h-4" />}>Set Variable</Button>
      </div>
    </form>
  );
}

export default function EnvironmentPage() {
  const [variables, setVariables] = useState<CloudEnvVar[]>([]);
  const [environments, setEnvironments] = useState<{ id: string; label: EnvironmentLabel; project_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [defaultEnvId, setDefaultEnvId] = useState<string | undefined>(undefined);
  const [deleting, setDeleting] = useState<{ envId: string; key: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [varsResult, bootstrap] = await Promise.all([accxApi.listEnvironmentVariables(), accxApi.bootstrap()]);
      setVariables(varsResult.variables);
      setEnvironments(bootstrap.environments.map(env => ({ id: env.id, label: env.label, project_name: env.project_name })));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load variables.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([accxApi.listEnvironmentVariables(), accxApi.bootstrap()]).then(([varsResult, bootstrap]) => {
      if (!active) return;
      setVariables(varsResult.variables);
      setEnvironments(bootstrap.environments.map(env => ({ id: env.id, label: env.label, project_name: env.project_name })));
      setError('');
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Failed to load variables.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await accxApi.deleteEnvironmentVariable(deleting.envId, deleting.key);
      setDeleting(null);
      void load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to delete variable.');
      setDeleting(null);
    }
  };

  const openSetForm = (envId?: string) => {
    setDefaultEnvId(envId);
    setShowForm(true);
  };

  const grouped = new Map<string, Map<string, CloudEnvVar[]>>();
  for (const v of variables) {
    if (!grouped.has(v.projectName)) grouped.set(v.projectName, new Map());
    const envMap = grouped.get(v.projectName)!;
    if (!envMap.has(v.environment)) envMap.set(v.environment, []);
    envMap.get(v.environment)!.push(v);
  }

  return (
    <div>
      <Header
        title="Environment Variables"
        subtitle={`${variables.length} variable${variables.length !== 1 ? 's' : ''}`}
      >
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => openSetForm()}>Set Variable</Button>
      </Header>

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-danger-subtle text-danger-theme text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-20 text-text-muted">Loading...</div>
      ) : variables.length > 0 ? (
        <div className="space-y-6">
          {[...grouped.entries()].map(([projectName, envMap]) => (
            <div key={projectName} className="bg-bg-surface rounded-2xl border border-border-theme p-5 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-text-primary">{projectName}</h3>
                <Button size="sm" variant="ghost" icon={<Plus className="w-3 h-3" />} onClick={() => openSetForm()}>Add Variable</Button>
              </div>
              <div className="space-y-4">
                {[...envMap.entries()].map(([env, vars]) => {
                  const envId = vars[0]?.environmentId;
                  return (
                    <div key={env}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge color={ENV_COLORS[env as EnvironmentLabel]}>{env}</Badge>
                        <span className="text-xs text-text-muted">{vars.length} variable{vars.length !== 1 ? 's' : ''}</span>
                        {envId && (
                          <Button size="sm" variant="ghost" icon={<Plus className="w-3 h-3" />} className="ml-auto" onClick={() => openSetForm(envId)}>Set</Button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {vars.map(v => (
                          <div key={v.key} className="flex items-center justify-between px-3 py-2 rounded-xl bg-bg-raised group">
                            <div className="flex items-center gap-3 min-w-0">
                              <Key className="w-4 h-4 text-text-muted shrink-0" />
                              <code className="text-sm font-mono text-text-primary truncate">{v.key}</code>
                              <span className="text-xs text-text-muted truncate hidden sm:inline">· set by {v.createdBy}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => void navigator.clipboard?.writeText(`accx://${v.projectName.toLowerCase().replace(/\s+/g, '-')}/${v.environment}:${v.key}`)}
                                className="p-1.5 rounded-lg hover:bg-bg-surface transition-colors text-text-muted hover:text-accent opacity-0 group-hover:opacity-100"
                                title="Copy accx:// reference"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={<Trash2 className="w-3 h-3" />}
                                onClick={() => setDeleting({ envId: v.environmentId, key: v.key })}
                                className="text-danger-theme hover:text-danger-theme opacity-0 group-hover:opacity-100"
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Server className="w-7 h-7" />}
          title={environments.length ? 'No environment variables' : 'No environments yet'}
          description={environments.length ? 'Set your first environment variable. Values are encrypted at rest.' : 'Create a project on the Projects page to get environments.'}
          action={environments.length ? <Button icon={<Plus className="w-4 h-4" />} onClick={() => openSetForm()}>Set Variable</Button> : undefined}
        />
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Set Environment Variable">
        {environments.length > 0 && (
          <SetVarForm
            environments={environments}
            defaultEnvironmentId={defaultEnvId}
            onClose={() => setShowForm(false)}
            onCreated={() => void load()}
          />
        )}
      </Modal>
      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
        title="Delete Variable"
        message={`Delete variable "${deleting?.key}"? This cannot be undone.`}
      />
    </div>
  );
}