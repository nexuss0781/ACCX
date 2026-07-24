import { useState, useMemo } from 'react';
import { useStore } from '../store';
import Header from '../components/layout/Header';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import { Plus, StickyNote, Edit3, Trash2, Pin, Check } from 'lucide-react';
import { NOTE_COLORS } from '../types';
import type { Note, NoteColor } from '../types';
import { timeAgo, cn } from '../utils';

function NoteCard({ note, onEdit, onDelete, onTogglePin }: {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  return (
    <div
      className="rounded-2xl border border-border/50 p-5 card-hover group animate-fade-in relative"
      style={{ backgroundColor: note.color }}
    >
      {note.pinned && (
        <div className="absolute top-3 right-3">
          <Pin className="w-3.5 h-3.5 text-text-secondary fill-text-secondary" />
        </div>
      )}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-text-primary pr-6">{note.title}</h3>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-3">
          {!note.pinned && (
            <button onClick={onTogglePin} className="p-1 rounded-lg hover:bg-bg-overlay/50 transition-colors text-text-muted hover:text-text-primary">
              <Pin className="w-3.5 h-3.5" />
            </button>
          )}
          {note.pinned && (
            <button onClick={onTogglePin} className="p-1 rounded-lg hover:bg-bg-overlay/50 transition-colors text-text-muted hover:text-text-primary">
              <Pin className="w-3.5 h-3.5 rotate-45" />
            </button>
          )}
          <button onClick={onEdit} className="p-1 rounded-lg hover:bg-bg-overlay/50 transition-colors text-text-muted hover:text-text-primary">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1 rounded-lg hover:bg-bg-overlay/50 transition-colors text-text-muted hover:text-danger-theme">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <p className="text-xs text-text-secondary whitespace-pre-wrap line-clamp-6 mb-3">{note.content}</p>
      <p className="text-[10px] text-text-muted/70">{timeAgo(note.updatedAt)}</p>
    </div>
  );
}

function NoteForm({ note, onClose }: { note?: Note; onClose: () => void }) {
  const { addNote, updateNote } = useStore();
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [color, setColor] = useState<NoteColor>(note?.color as NoteColor || NOTE_COLORS[0].value);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    if (note) {
      updateNote(note.id, { title, content, color });
    } else {
      addNote(title, content, color);
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Note title" required />
      <div>
        <label className="text-sm font-medium text-text-primary block mb-1.5">Content</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write your note here..."
          rows={6}
          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border-theme bg-bg-surface text-text-primary placeholder:text-text-muted transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-text-primary block mb-2">Color</label>
        <div className="flex flex-wrap gap-2">
          {NOTE_COLORS.map(nc => (
            <button
              key={nc.value}
              type="button"
              onClick={() => setColor(nc.value)}
              className={cn(
                'w-8 h-8 rounded-lg transition-all duration-150 flex items-center justify-center border',
                color === nc.value ? 'ring-2 ring-offset-2 ring-accent scale-110 border-accent' : 'border-transparent hover:scale-105'
              )}
              style={{ backgroundColor: nc.value }}
              title={nc.name}
            >
              {color === nc.value && <Check className="w-4 h-4 text-text-primary" />}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit">{note ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  );
}

export default function NotesPage() {
  const { notes, deleteNote, togglePinNote } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);

  const filtered = useMemo(() => {
    const result = notes.filter(note => {
      const matchesSearch = !searchQuery ||
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesColor = !filterColor || note.color === filterColor;
      return matchesSearch && matchesColor;
    });
    return [...result.filter(n => n.pinned), ...result.filter(n => !n.pinned)];
  }, [notes, searchQuery, filterColor]);

  const hasFilters = searchQuery || filterColor;

  return (
    <div>
      <Header
        title="Notes"
        subtitle={`${notes.length} notes`}
        onSearch={setSearchQuery}
        searchPlaceholder="Search notes..."
      >
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>
          New Note
        </Button>
      </Header>

      <div className="flex items-center gap-3 mb-6 animate-fade-in">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterColor('')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
              !filterColor ? 'bg-accent-subtle text-accent-hover' : 'bg-bg-raised text-text-secondary hover:bg-accent-subtle'
            )}
          >
            All
          </button>
          {NOTE_COLORS.map(nc => (
            <button
              key={nc.value}
              onClick={() => setFilterColor(filterColor === nc.value ? '' : nc.value)}
              className={cn(
                'w-6 h-6 rounded-full transition-all duration-150 border-2',
                filterColor === nc.value ? 'border-accent scale-110' : 'border-transparent hover:scale-105'
              )}
              style={{ backgroundColor: nc.value }}
              title={nc.name}
            />
          ))}
        </div>
        {hasFilters && (
          <button
            onClick={() => { setSearchQuery(''); setFilterColor(''); }}
            className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-text-muted ml-auto">{filtered.length} results</span>
      </div>

      {filtered.length > 0 ? (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
          {filtered.map(note => (
            <div key={note.id} className="break-inside-avoid">
              <NoteCard
                note={note}
                onEdit={() => setEditingNote(note)}
                onDelete={() => setDeletingNote(note)}
                onTogglePin={() => togglePinNote(note.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<StickyNote className="w-7 h-7" />}
          title={hasFilters ? 'No matching notes' : 'No notes yet'}
          description={hasFilters ? 'Try adjusting your search or filters' : 'Create your first note to get started'}
          action={!hasFilters ? <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>New Note</Button> : undefined}
        />
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Note">
        <NoteForm onClose={() => setShowForm(false)} />
      </Modal>

      <Modal isOpen={!!editingNote} onClose={() => setEditingNote(null)} title="Edit Note">
        {editingNote && <NoteForm note={editingNote} onClose={() => setEditingNote(null)} />}
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingNote}
        onClose={() => setDeletingNote(null)}
        onConfirm={() => { if (deletingNote) { deleteNote(deletingNote.id); setDeletingNote(null); } }}
        title="Delete Note"
        message={`Are you sure you want to delete "${deletingNote?.title}"? This action cannot be undone.`}
      />
    </div>
  );
}
