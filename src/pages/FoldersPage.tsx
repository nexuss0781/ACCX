import { useState, useMemo } from 'react';
import { useStore } from '../store';
import Header from '../components/layout/Header';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import { Plus, FolderOpen, Edit3, Trash2, Check, Folder } from 'lucide-react';
import { FOLDER_COLORS } from '../types';
import type { Folder as FolderType } from '../types';
import { timeAgo, cn } from '../utils';

function FolderForm({ folder, onClose }: { folder?: FolderType; onClose: () => void }) {
  const { addFolder, updateFolder } = useStore();
  const [name, setName] = useState(folder?.name || '');
  const [description, setDescription] = useState(folder?.description || '');
  const [color, setColor] = useState(folder?.color || FOLDER_COLORS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    if (folder) {
      updateFolder(folder.id, { name, description, color });
    } else {
      addFolder(name, description, color);
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input label="Folder Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Personal" required />
      <div>
        <label className="text-sm font-medium text-text-primary block mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border-theme bg-bg-surface text-text-primary placeholder:text-text-muted transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-text-primary block mb-2">Color</label>
        <div className="flex flex-wrap gap-2">
          {FOLDER_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                'w-8 h-8 rounded-lg transition-all duration-150 flex items-center justify-center',
                color === c ? 'ring-2 ring-offset-2 ring-brand-500 scale-110' : 'hover:scale-105'
              )}
              style={{ backgroundColor: c }}
            >
              {color === c && <Check className="w-4 h-4 text-white" />}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit">{folder ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  );
}

export default function FoldersPage() {
  const { folders, deleteFolder, accounts } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<FolderType | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery) return folders;
    return folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [folders, searchQuery]);

  const getFolderCount = (id: string) => accounts.filter(a => a.folderId === id).length;

  return (
    <div>
      <Header
        title="Folders"
        subtitle={`${folders.length} folders`}
        onSearch={setSearchQuery}
        searchPlaceholder="Search folders..."
      >
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>
          New Folder
        </Button>
      </Header>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((fold, i) => (
            <div
              key={fold.id}
              className="bg-bg-surface rounded-2xl border border-border-theme p-5 card-hover group animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${fold.color}15` }}>
                    <FolderOpen className="w-5 h-5" style={{ color: fold.color }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{fold.name}</h3>
                    <p className="text-xs text-text-muted">{getFolderCount(fold.id)} accounts</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingFolder(fold)} className="p-1.5 rounded-lg hover:bg-bg-raised transition-colors text-text-muted hover:text-accent">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeletingFolder(fold)} className="p-1.5 rounded-lg hover:bg-bg-raised transition-colors text-text-muted hover:text-danger-theme">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {fold.description && (
                <p className="text-xs text-text-secondary mb-3 line-clamp-2">{fold.description}</p>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-border-theme">
                <div className="flex items-center gap-1.5">
                  <Folder className="w-3 h-3" style={{ color: fold.color }} />
                  <span className="text-[10px] text-text-muted">Updated {timeAgo(fold.updatedAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FolderOpen className="w-7 h-7" />}
          title={searchQuery ? 'No matching folders' : 'No folders yet'}
          description={searchQuery ? 'Try a different search term' : 'Create folders to organize your accounts'}
          action={!searchQuery ? <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>New Folder</Button> : undefined}
        />
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Folder">
        <FolderForm onClose={() => setShowForm(false)} />
      </Modal>

      <Modal isOpen={!!editingFolder} onClose={() => setEditingFolder(null)} title="Edit Folder">
        {editingFolder && <FolderForm folder={editingFolder} onClose={() => setEditingFolder(null)} />}
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingFolder}
        onClose={() => setDeletingFolder(null)}
        onConfirm={() => { if (deletingFolder) { deleteFolder(deletingFolder.id); setDeletingFolder(null); } }}
        title="Delete Folder"
        message={`Are you sure you want to delete "${deletingFolder?.name}"? Accounts in this folder will become unorganized.`}
      />
    </div>
  );
}
