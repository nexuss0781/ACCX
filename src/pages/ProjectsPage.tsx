import { useState, useEffect, useCallback } from 'react';
import Header from '../components/layout/Header';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import { Plus, FolderTree, Trash2, Pencil, Boxes } from 'lucide-react';
import { accxApi } from '../lib/accxApi';
import type { CloudProject, EnvironmentLabel } from '../lib/accxApi';

const ENV_LABELS: readonly EnvironmentLabel[] = ['development', 'staging', 'production'];
const ENV_COLORS: Record<EnvironmentLabel, string> = { development: '#10b981', staging: '#f59e0b', production: '#ef4444' };

function ProjectForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await accxApi.createProject(name.trim(), slug.trim() || undefined);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p className="text-sm text-danger-theme">{error}</p>}
      <Input label="Project Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My App" required />
      <Input label="Slug (optional)" value={slug} onChange={e => setSlug(e.target.value)} placeholder="auto-generated from name" />
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading}>Create Project</Button>
      </div>
    </form>
  );
}

function RenameForm({ project, onClose }: { project: CloudProject; onClose: () => void }) {
  const [name, setName] = useState(project.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await accxApi.renameProject(project.id, name.trim());
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to rename project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p className="text-sm text-danger-theme">{error}</p>}
      <Input label="Project Name" value={name} onChange={e => setName(e.target.value)} required />
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading}>Rename</Button>
      </div>
    </form>
  );
}

function AddEnvForm({ project, onClose }: { project: CloudProject; onClose: () => void }) {
  const [label, setLabel] = useState<EnvironmentLabel>('development');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const available = ENV_LABELS.filter(l => !project.environments.includes(l));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await accxApi.addEnvironment(project.id, label);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to add environment.');
    } finally {
      setLoading(false);
    }
  };

  if (available.length === 0) return <p className="text-sm text-text-muted">All three default environments exist.</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p className="text-sm text-danger-theme">{error}</p>}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-primary">Environment</label>
        <div className="flex gap-2">
          {available.map(l => (
            <button
              key={l}
              type="button"
              onClick={() => setLabel(l)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${label === l ? 'bg-accent text-white' : 'bg-bg-raised text-text-secondary hover:bg-bg-surface'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading}>Add</Button>
      </div>
    </form>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [renaming, setRenaming] = useState<CloudProject | null>(null);
  const [addingEnv, setAddingEnv] = useState<CloudProject | null>(null);
  const [deleting, setDeleting] = useState<CloudProject | null>(null);
  const [removingEnv, setRemovingEnv] = useState<{ projectId: string; label: EnvironmentLabel } | null>(null);

  const load = useCallback(async () => {
    try {
      const { projects } = await accxApi.listProjects();
      setProjects(projects);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void accxApi.listProjects().then(({ projects }) => { if (active) { setProjects(projects); setError(''); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Failed to load projects.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await accxApi.deleteProject(deleting.id);
      setDeleting(null);
      void load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to delete project.');
      setDeleting(null);
    }
  };

  const handleRemoveEnv = async () => {
    if (!removingEnv) return;
    try {
      await accxApi.removeEnvironment(removingEnv.projectId, removingEnv.label);
      setRemovingEnv(null);
      void load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to remove environment.');
      setRemovingEnv(null);
    }
  };

  return (
    <div>
      <Header
        title="Projects"
        subtitle={`${projects.length} project${projects.length !== 1 ? 's' : ''}`}
      >
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>New Project</Button>
      </Header>

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-danger-subtle text-danger-theme text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-20 text-text-muted">Loading...</div>
      ) : projects.length > 0 ? (
        <div className="space-y-4">
          {projects.map((project, i) => (
            <div
              key={project.id}
              className="bg-bg-surface rounded-2xl border border-border-theme p-5 card-hover animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-subtle flex items-center justify-center">
                    <FolderTree className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{project.name}</h3>
                    <p className="text-xs text-text-muted">/{project.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setRenaming(project)} className="p-1.5 rounded-lg hover:bg-bg-raised transition-colors text-text-muted hover:text-accent" title="Rename">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleting(project)} className="p-1.5 rounded-lg hover:bg-bg-raised transition-colors text-text-muted hover:text-danger-theme" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {project.environments.map(label => (
                  <Badge key={label} color={ENV_COLORS[label]}>{label}</Badge>
                ))}
              </div>

              <div className="flex gap-2">
                {project.environments.length < 3 && (
                  <Button size="sm" variant="ghost" icon={<Plus className="w-3 h-3" />} onClick={() => setAddingEnv(project)}>Add Environment</Button>
                )}
                {project.environments.length > 1 && (
                  <Button size="sm" variant="ghost" icon={<Trash2 className="w-3 h-3" />} onClick={() => setRemovingEnv({ projectId: project.id, label: project.environments[project.environments.length - 1] })} className="text-danger-theme hover:text-danger-theme">Remove</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Boxes className="w-7 h-7" />}
          title="No projects yet"
          description="Create a project to start organizing your environment variables and secrets."
          action={<Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>New Project</Button>}
        />
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Project">
        <ProjectForm onClose={() => { setShowCreate(false); void load(); }} />
      </Modal>
      <Modal isOpen={!!renaming} onClose={() => setRenaming(null)} title="Rename Project">
        {renaming && <RenameForm project={renaming} onClose={() => { setRenaming(null); void load(); }} />}
      </Modal>
      <Modal isOpen={!!addingEnv} onClose={() => setAddingEnv(null)} title="Add Environment">
        {addingEnv && <AddEnvForm project={addingEnv} onClose={() => { setAddingEnv(null); void load(); }} />}
      </Modal>
      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
        title="Delete Project"
        message={`Permanently delete "${deleting?.name}"? This removes all environment variables in the project.`}
      />
      <ConfirmDialog
        isOpen={!!removingEnv}
        onClose={() => setRemovingEnv(null)}
        onConfirm={() => void handleRemoveEnv()}
        title="Remove Environment"
        message={`Remove the ${removingEnv?.label} environment? All variables in it will be deleted.`}
      />
    </div>
  );
}