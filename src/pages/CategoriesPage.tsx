import { useState, useMemo } from 'react';
import { useStore } from '../store';
import Header from '../components/layout/Header';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import { Plus, Tag, Edit3, Trash2, Check } from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../types';
import type { Category } from '../types';
import { cn } from '../utils';

function CategoryForm({ category, onClose }: { category?: Category; onClose: () => void }) {
  const { addCategory, updateCategory } = useStore();
  const [name, setName] = useState(category?.name || '');
  const [color, setColor] = useState(category?.color || CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(category?.icon || CATEGORY_ICONS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    if (category) {
      updateCategory(category.id, { name, color, icon });
    } else {
      addCategory(name, color, icon);
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input label="Category Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Social Media" required />

      <div>
        <label className="text-sm font-medium text-text-primary block mb-2">Color</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map(c => (
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

      <div>
        <label className="text-sm font-medium text-text-primary block mb-2">Icon</label>
        <div className="grid grid-cols-8 gap-2">
          {CATEGORY_ICONS.map(ic => (
            <button
              key={ic}
              type="button"
              onClick={() => setIcon(ic)}
              className={cn(
                'w-10 h-10 rounded-xl border text-xs font-medium transition-all duration-150',
                icon === ic ? 'border-accent bg-accent-subtle text-accent-hover' : 'border-border-theme hover:border-accent-muted text-text-secondary'
              )}
            >
              {ic.slice(0, 2)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit">{category ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  );
}

export default function CategoriesPage() {
  const { categories, deleteCategory, accounts } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery) return categories;
    return categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [categories, searchQuery]);

  const getCategoryCount = (id: string) => accounts.filter(a => a.categoryId === id).length;

  return (
    <div>
      <Header
        title="Categories"
        subtitle={`${categories.length} categories`}
        onSearch={setSearchQuery}
        searchPlaceholder="Search categories..."
      >
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>
          New Category
        </Button>
      </Header>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((cat, i) => (
            <div
              key={cat.id}
              className="bg-bg-surface rounded-2xl border border-border-theme p-5 card-hover group animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: cat.color }}>
                    {cat.icon?.slice(0, 2) || 'TG'}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{cat.name}</h3>
                    <p className="text-xs text-text-muted">{getCategoryCount(cat.id)} accounts</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingCategory(cat)} className="p-1.5 rounded-lg hover:bg-bg-raised transition-colors text-text-muted hover:text-accent">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeletingCategory(cat)} className="p-1.5 rounded-lg hover:bg-bg-raised transition-colors text-text-muted hover:text-danger-theme">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="w-full h-1 rounded-full" style={{ backgroundColor: `${cat.color}25` }}>
                <div className="h-full rounded-full" style={{ backgroundColor: cat.color, width: `${Math.min((getCategoryCount(cat.id) / Math.max(accounts.length, 1)) * 100 * 3, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Tag className="w-7 h-7" />}
          title={searchQuery ? 'No matching categories' : 'No categories yet'}
          description={searchQuery ? 'Try a different search term' : 'Create categories to organize your accounts'}
          action={!searchQuery ? <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>New Category</Button> : undefined}
        />
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Category">
        <CategoryForm onClose={() => setShowForm(false)} />
      </Modal>

      <Modal isOpen={!!editingCategory} onClose={() => setEditingCategory(null)} title="Edit Category">
        {editingCategory && <CategoryForm category={editingCategory} onClose={() => setEditingCategory(null)} />}
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        onConfirm={() => { if (deletingCategory) { deleteCategory(deletingCategory.id); setDeletingCategory(null); } }}
        title="Delete Category"
        message={`Are you sure you want to delete "${deletingCategory?.name}"? Accounts using this category will become uncategorized.`}
      />
    </div>
  );
}
