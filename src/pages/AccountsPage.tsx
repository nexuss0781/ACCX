import { useEffect, useMemo, useState } from 'react';
import Header from '../components/layout/Header';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { Plus, KeyRound, Star, Globe, Filter, ShieldCheck, RefreshCw } from 'lucide-react';
import { timeAgo, cn } from '../utils';
import { useStore } from '../store';
import type { Account } from '../types';
import { accxApi, type Environment } from '../lib/accxApi';

function AccountCard({ account, onToggleFavorite }: { account: Account; onToggleFavorite: () => void }) {
  const { categories, folders } = useStore();
  const category = categories.find(c => c.id === account.categoryId);
  const folder = folders.find(f => f.id === account.folderId);
  return (
    <div className="bg-bg-surface rounded-2xl border border-border-theme p-5 card-hover group animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm bg-accent">{account.title.charAt(0)}</div>
          <div className="min-w-0"><h3 className="text-sm font-semibold text-text-primary truncate">{account.title}</h3><p className="text-xs text-text-muted truncate">{account.provider || 'Cloud account'}</p></div>
        </div>
        <button onClick={onToggleFavorite} className="p-1.5 rounded-lg hover:bg-bg-raised transition-colors"><Star className={cn('w-4 h-4', account.favorite ? 'text-amber-400 fill-amber-400' : 'text-text-muted')} /></button>
      </div>
      <div className="space-y-2 mb-3 text-xs">
        <div className="flex gap-2 items-center"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /><span className="text-text-secondary">Protected in ACCX Cloud</span></div>
        <div className="flex gap-2"><span className="text-text-muted w-16 shrink-0">Reference</span><code className="text-text-secondary truncate flex-1">{account.reference}</code></div>
        <div className="flex gap-2"><span className="text-text-muted w-16 shrink-0">Version</span><span className="text-text-secondary">v{account.activeVersion || 0} · {account.rotationState || 'stable'}</span></div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
        <div className="flex items-center gap-1.5"><Badge color={account.status === 'active' ? '#10b981' : account.status === 'revoked' ? '#ef4444' : '#f59e0b'}>{account.status || 'pending'}</Badge>{account.environment && <Badge color="#6366f1">{account.environment}</Badge>}{category && <Badge color={category.color}>{category.name}</Badge>}{folder && <Badge color={folder.color}>{folder.name}</Badge>}</div>
        <span className="text-[10px] text-text-muted">{account.lastUsedAt ? `Used ${timeAgo(account.lastUsedAt)}` : 'No plaintext in browser'}</span>
      </div>
    </div>
  );
}

function AccountForm({ environments, onClose, onCreated }: { environments: Environment[]; onClose: () => void; onCreated: () => void }) {
  const [displayName, setDisplayName] = useState(''); const [provider, setProvider] = useState(''); const [reference, setReference] = useState(''); const [environmentId, setEnvironmentId] = useState(environments[0]?.id || ''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(''); setLoading(true); try { await accxApi.createMetadata({ displayName, provider, reference, environmentId }); onCreated(); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Cloud metadata registration failed.'); } finally { setLoading(false); } };
  return <form onSubmit={submit} className="space-y-4"><Input label="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Twitter primary" required /><Input label="Provider" value={provider} onChange={e => setProvider(e.target.value)} placeholder="e.g. twitter" required /><Input label="Stable cloud reference" value={reference} onChange={e => setReference(e.target.value)} placeholder="social.twitter.primary" required /><Select label="Environment" value={environmentId} onChange={e => setEnvironmentId(e.target.value)} options={environments.map(env => ({ value: env.id, label: `${env.project_name} · ${env.label}` }))} required /><p className="text-xs text-text-muted">This registers metadata only. Credential values are provisioned through a trusted server workflow and are never entered, copied, or displayed in this browser.</p>{error && <p className="text-sm text-danger-theme">{error}</p>}<div className="flex justify-end gap-3 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={loading}>Register metadata</Button></div></form>;
}

export default function AccountsPage() {
  const { accounts, setCloudAccounts, toggleFavorite, categories, folders } = useStore();
  const [environments, setEnvironments] = useState<Environment[]>([]); const [searchQuery, setSearchQuery] = useState(''); const [filterCategory, setFilterCategory] = useState(''); const [filterFolder, setFilterFolder] = useState(''); const [showForm, setShowForm] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = async () => { setLoading(true); try { const cloud = await accxApi.bootstrap(); setEnvironments(cloud.environments); setCloudAccounts(cloud.secrets.map(secret => ({ id: secret.id, title: secret.displayName, provider: secret.provider, reference: secret.reference, environment: secret.environment, status: secret.status, activeVersion: secret.activeVersion, rotationState: secret.rotationState, expiresAt: secret.expiresAt, lastUsedAt: secret.lastUsedAt, favorite: false, createdAt: secret.lastUsedAt || new Date().toISOString(), updatedAt: secret.lastUsedAt || new Date().toISOString() }))); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load cloud metadata.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => accounts.filter(account => (!searchQuery || [account.title, account.provider, account.reference, account.environment].filter(Boolean).some(value => String(value).toLowerCase().includes(searchQuery.toLowerCase()))) && (!filterCategory || account.categoryId === filterCategory) && (!filterFolder || account.folderId === filterFolder)), [accounts, searchQuery, filterCategory, filterFolder]);
  const hasFilters = searchQuery || filterCategory || filterFolder;
  return <div><Header title="Accounts" subtitle={`${accounts.length} cloud account references`} onSearch={setSearchQuery} searchPlaceholder="Search cloud references..."><Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>New Account</Button></Header><div className="flex items-center gap-3 mb-6 animate-fade-in"><div className="relative"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" /><select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="pl-9 pr-8 py-2 text-sm rounded-xl border border-border-theme bg-bg-surface appearance-none focus:outline-none"><option value="">All Categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="relative"><select value={filterFolder} onChange={e => setFilterFolder(e.target.value)} className="pl-3.5 pr-8 py-2 text-sm rounded-xl border border-border-theme bg-bg-surface appearance-none focus:outline-none"><option value="">All Folders</option>{folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>{hasFilters && <button onClick={() => { setSearchQuery(''); setFilterCategory(''); setFilterFolder(''); }} className="text-xs font-medium text-accent">Clear filters</button>}<button onClick={() => void load()} className="ml-auto p-2 rounded-lg hover:bg-bg-raised text-text-muted" aria-label="Refresh cloud metadata"><RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /></button><span className="text-xs text-text-muted">{filtered.length} results</span></div>{error && <div className="mb-4 text-sm text-danger-theme">{error}</div>}{loading ? <div className="text-sm text-text-muted">Loading protected cloud metadata…</div> : filtered.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map(account => <AccountCard key={account.id} account={account} onToggleFavorite={() => toggleFavorite(account.id)} />)}</div> : <EmptyState icon={<KeyRound className="w-7 h-7" />} title={hasFilters ? 'No matching cloud references' : 'No cloud account references yet'} description={hasFilters ? 'Try adjusting your search or filters' : 'Register metadata for the first protected cloud account'} action={!hasFilters ? <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>New Account</Button> : undefined} />}<Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Register cloud account metadata" size="lg"><AccountForm environments={environments} onClose={() => setShowForm(false)} onCreated={() => void load()} /></Modal></div>;
}
