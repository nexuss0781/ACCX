import { useState, useMemo } from 'react';
import { useStore } from '../store';
import Header from '../components/layout/Header';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import { Plus, KeyRound, Star, Eye, EyeOff, Copy, Edit3, Trash2, ExternalLink, MoreVertical, X, Globe, Search, Filter } from 'lucide-react';
import { timeAgo, maskPassword, cn } from '../utils';
import type { Account, CustomField } from '../types';

function AccountCard({ account, onEdit, onDelete, onToggleFavorite }: {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { categories, folders } = useStore();

  const category = categories.find(c => c.id === account.categoryId);
  const folder = folders.find(f => f.id === account.folderId);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="bg-bg-surface rounded-2xl border border-border-theme p-5 card-hover group animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: category?.color || '#6366f1' }}>
            {account.title.charAt(0)}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{account.title}</h3>
            <p className="text-xs text-text-muted">{account.username || account.email || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onToggleFavorite} className="p-1.5 rounded-lg hover:bg-bg-raised transition-colors">
            <Star className={cn('w-4 h-4', account.favorite ? 'text-amber-400 fill-amber-400' : 'text-text-muted')} />
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-bg-raised transition-colors text-text-muted hover:text-accent">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-bg-raised transition-colors text-text-muted hover:text-danger-theme">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {account.description && (
        <p className="text-xs text-text-secondary mb-3 line-clamp-2">{account.description}</p>
      )}

      <div className="space-y-2 mb-3">
        {account.email && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted w-16 shrink-0">Email</span>
            <span className="text-text-secondary truncate flex-1">{account.email}</span>
            <button onClick={() => copyToClipboard(account.email!, 'email')} className="p-1 rounded hover:bg-bg-raised transition-colors shrink-0">
              <Copy className={cn('w-3 h-3', copied === 'email' ? 'text-emerald-500' : 'text-text-muted')} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted w-16 shrink-0">Password</span>
          <span className="text-text-secondary font-mono flex-1 truncate">{showPassword ? account.password : maskPassword(account.password)}</span>
          <button onClick={() => setShowPassword(!showPassword)} className="p-1 rounded hover:bg-bg-raised transition-colors shrink-0">
            {showPassword ? <EyeOff className="w-3 h-3 text-text-muted" /> : <Eye className="w-3 h-3 text-text-muted" />}
          </button>
          <button onClick={() => copyToClipboard(account.password, 'password')} className="p-1 rounded hover:bg-bg-raised transition-colors shrink-0">
            <Copy className={cn('w-3 h-3', copied === 'password' ? 'text-emerald-500' : 'text-text-muted')} />
          </button>
        </div>
      </div>

      {account.customFields.length > 0 && (
        <div className="space-y-2 mb-3 pt-2 border-t border-border-subtle">
          {account.customFields.map(cf => (
            <div key={cf.id} className="flex items-center gap-2 text-xs">
              <span className="text-text-muted w-16 shrink-0 truncate">{cf.label}</span>
              <span className="text-text-secondary truncate flex-1">{cf.value}</span>
              <button onClick={() => copyToClipboard(cf.value, cf.id)} className="p-1 rounded hover:bg-bg-raised transition-colors shrink-0">
                <Copy className={cn('w-3 h-3', copied === cf.id ? 'text-emerald-500' : 'text-text-muted')} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
        <div className="flex items-center gap-1.5">
          {category && <Badge color={category.color}>{category.name}</Badge>}
          {folder && <Badge color={folder.color}>{folder.name}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {account.url && (
            <a href={account.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-bg-raised transition-colors text-text-muted hover:text-accent">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <span className="text-[10px] text-text-muted">{timeAgo(account.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}

function AccountForm({ account, onClose }: { account?: Account; onClose: () => void }) {
  const { addAccount, updateAccount, categories, folders } = useStore();
  const [title, setTitle] = useState(account?.title || '');
  const [description, setDescription] = useState(account?.description || '');
  const [username, setUsername] = useState(account?.username || '');
  const [email, setEmail] = useState(account?.email || '');
  const [password, setPassword] = useState(account?.password || '');
  const [url, setUrl] = useState(account?.url || '');
  const [categoryId, setCategoryId] = useState(account?.categoryId || '');
  const [folderId, setFolderId] = useState(account?.folderId || '');
  const [customFields, setCustomFields] = useState<CustomField[]>(account?.customFields || []);
  const [notes, setNotes] = useState(account?.notes || '');

  const addCustomField = () => {
    setCustomFields([...customFields, { id: Date.now().toString(36), label: '', value: '', type: 'text' }]);
  };

  const updateCustomField = (id: string, data: Partial<CustomField>) => {
    setCustomFields(customFields.map(cf => cf.id === id ? { ...cf, ...data } : cf));
  };

  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter(cf => cf.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !password) return;
    const data = { title, description, username, email, password, url, categoryId, folderId, customFields, notes };
    if (account) {
      updateAccount(account.id, data);
    } else {
      addAccount(data);
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. GitHub" required />
        <Input label="URL" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." icon={<Globe className="w-4 h-4" />} />
      </div>
      <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Username" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
        <Input label="Email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" />
      </div>
      <Input label="Password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" required />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Category"
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          options={categories.map(c => ({ value: c.id, label: c.name }))}
          placeholder="Select category"
        />
        <Select
          label="Folder"
          value={folderId}
          onChange={e => setFolderId(e.target.value)}
          options={folders.map(f => ({ value: f.id, label: f.name }))}
          placeholder="Select folder"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-text-primary">Custom Fields</label>
          <button type="button" onClick={addCustomField} className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Field
          </button>
        </div>
        {customFields.length > 0 && (
          <div className="space-y-2">
            {customFields.map(cf => (
              <div key={cf.id} className="flex items-center gap-2 animate-fade-in">
                <Input value={cf.label} onChange={e => updateCustomField(cf.id, { label: e.target.value })} placeholder="Label" className="flex-1" />
                <Input value={cf.value} onChange={e => updateCustomField(cf.id, { value: e.target.value })} placeholder="Value" className="flex-1" />
                <Select
                  value={cf.type}
                  onChange={e => updateCustomField(cf.id, { type: e.target.value as CustomField['type'] })}
                  options={[
                    { value: 'text', label: 'Text' },
                    { value: 'password', label: 'Password' },
                    { value: 'url', label: 'URL' },
                    { value: 'email', label: 'Email' },
                    { value: 'number', label: 'Number' },
                  ]}
                  className="w-28"
                />
                <button type="button" onClick={() => removeCustomField(cf.id)} className="p-2 rounded-lg hover:bg-danger-subtle transition-colors text-text-muted hover:text-danger-theme shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="text-sm font-medium text-text-primary block mb-1.5">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Additional notes..."
          rows={3}
          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border-theme bg-bg-surface text-text-primary placeholder:text-text-muted transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit">{account ? 'Update Account' : 'Create Account'}</Button>
      </div>
    </form>
  );
}

export default function AccountsPage() {
  const { accounts, deleteAccount, toggleFavorite } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFolder, setFilterFolder] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const { categories, folders } = useStore();

  const filtered = useMemo(() => {
    return accounts.filter(acc => {
      const matchesSearch = !searchQuery ||
        acc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !filterCategory || acc.categoryId === filterCategory;
      const matchesFolder = !filterFolder || acc.folderId === filterFolder;
      return matchesSearch && matchesCategory && matchesFolder;
    });
  }, [accounts, searchQuery, filterCategory, filterFolder]);

  const hasFilters = searchQuery || filterCategory || filterFolder;

  return (
    <div>
      <Header
        title="Accounts"
        subtitle={`${accounts.length} total accounts`}
        onSearch={setSearchQuery}
        searchPlaceholder="Search accounts..."
      >
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>
          New Account
        </Button>
      </Header>

      <div className="flex items-center gap-3 mb-6 animate-fade-in">
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="pl-9 pr-8 py-2 text-sm rounded-xl border border-border-theme bg-bg-surface appearance-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="relative">
          <select
            value={filterFolder}
            onChange={e => setFilterFolder(e.target.value)}
            className="pl-3.5 pr-8 py-2 text-sm rounded-xl border border-border-theme bg-bg-surface appearance-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          >
            <option value="">All Folders</option>
            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        {hasFilters && (
          <button
            onClick={() => { setSearchQuery(''); setFilterCategory(''); setFilterFolder(''); }}
            className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-text-muted ml-auto">{filtered.length} results</span>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(acc => (
            <AccountCard
              key={acc.id}
              account={acc}
              onEdit={() => setEditingAccount(acc)}
              onDelete={() => setDeletingAccount(acc)}
              onToggleFavorite={() => toggleFavorite(acc.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<KeyRound className="w-7 h-7" />}
          title={hasFilters ? 'No matching accounts' : 'No accounts yet'}
          description={hasFilters ? 'Try adjusting your search or filters' : 'Create your first account to get started'}
          action={!hasFilters ? <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>New Account</Button> : undefined}
        />
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Account" size="lg">
        <AccountForm onClose={() => setShowForm(false)} />
      </Modal>

      <Modal isOpen={!!editingAccount} onClose={() => setEditingAccount(null)} title="Edit Account" size="lg">
        {editingAccount && <AccountForm account={editingAccount} onClose={() => setEditingAccount(null)} />}
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingAccount}
        onClose={() => setDeletingAccount(null)}
        onConfirm={() => { if (deletingAccount) { deleteAccount(deletingAccount.id); setDeletingAccount(null); } }}
        title="Delete Account"
        message={`Are you sure you want to delete "${deletingAccount?.title}"? This action cannot be undone.`}
      />
    </div>
  );
}
