import { create } from 'zustand';
import type { User, Account, Category, Folder, Note, Activity } from '../types';
import type { Theme } from '../utils/theme';
import { applyTheme } from '../utils/theme';

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const defaultCategories: Category[] = [{ id: 'cat-1', name: 'Social Media', color: '#6366f1', icon: 'Globe', createdAt: now() }, { id: 'cat-2', name: 'Work', color: '#3b82f6', icon: 'Briefcase', createdAt: now() }];
const defaultFolders: Folder[] = [{ id: 'fold-1', name: 'Personal', description: 'Personal accounts', color: '#6366f1', createdAt: now(), updatedAt: now() }, { id: 'fold-2', name: 'Work', description: 'Work-related accounts', color: '#3b82f6', createdAt: now(), updatedAt: now() }];

interface AppState {
  user: User | null; accounts: Account[]; categories: Category[]; folders: Folder[]; notes: Note[]; activities: Activity[]; sidebarCollapsed: boolean; theme: Theme;
  setUser: (user: User | null) => void; logout: () => void; toggleSidebar: () => void; toggleTheme: () => void;
  setCloudAccounts: (accounts: Account[]) => void; addAccount: (account: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'favorite'>) => string; updateAccount: (id: string, data: Partial<Account>) => void; deleteAccount: (id: string) => void; toggleFavorite: (id: string) => void;
  addCategory: (name: string, color: string, icon: string) => string; updateCategory: (id: string, data: Partial<Category>) => void; deleteCategory: (id: string) => void;
  addFolder: (name: string, description?: string, color?: string) => string; updateFolder: (id: string, data: Partial<Folder>) => void; deleteFolder: (id: string) => void;
  addNote: (title: string, content: string, color: string) => string; updateNote: (id: string, data: Partial<Note>) => void; deleteNote: (id: string) => void; togglePinNote: (id: string) => void;
  addActivity: (type: Activity['type'], entity: Activity['entity'], entityId: string, entityName: string) => void;
}

export const useStore = create<AppState>()((set, get) => ({
  user: null, accounts: [], categories: defaultCategories, folders: defaultFolders, notes: [], activities: [], sidebarCollapsed: false, theme: 'dark',
  setUser: user => set({ user }), logout: () => set({ user: null, accounts: [], activities: [] }), toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleTheme: () => { const theme = get().theme === 'light' ? 'dark' : 'light'; applyTheme(theme); set({ theme }); },
  setCloudAccounts: accounts => set({ accounts }),
  addAccount: data => { const id = uid(); set(s => ({ accounts: [{ ...data, id, favorite: false, createdAt: now(), updatedAt: now() }, ...s.accounts] })); return id; },
  updateAccount: (id, data) => set(s => ({ accounts: s.accounts.map(a => a.id === id ? { ...a, ...data, updatedAt: now() } : a) })),
  deleteAccount: id => set(s => ({ accounts: s.accounts.filter(a => a.id !== id) })), toggleFavorite: id => set(s => ({ accounts: s.accounts.map(a => a.id === id ? { ...a, favorite: !a.favorite } : a) })),
  addCategory: (name, color, icon) => { const id = uid(); set(s => ({ categories: [...s.categories, { id, name, color, icon, createdAt: now() }] })); return id; }, updateCategory: (id, data) => set(s => ({ categories: s.categories.map(c => c.id === id ? { ...c, ...data } : c) })), deleteCategory: id => set(s => ({ categories: s.categories.filter(c => c.id !== id) })),
  addFolder: (name, description, color) => { const id = uid(); set(s => ({ folders: [...s.folders, { id, name, description, color: color || '#6366f1', createdAt: now(), updatedAt: now() }] })); return id; }, updateFolder: (id, data) => set(s => ({ folders: s.folders.map(f => f.id === id ? { ...f, ...data, updatedAt: now() } : f) })), deleteFolder: id => set(s => ({ folders: s.folders.filter(f => f.id !== id) })),
  addNote: (title, content, color) => { const id = uid(); set(s => ({ notes: [{ id, title, content, color, pinned: false, createdAt: now(), updatedAt: now() }, ...s.notes] })); return id; }, updateNote: (id, data) => set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, ...data, updatedAt: now() } : n) })), deleteNote: id => set(s => ({ notes: s.notes.filter(n => n.id !== id) })), togglePinNote: id => set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n) })),
  addActivity: (type, entity, entityId, entityName) => set(s => ({ activities: [{ id: uid(), type, entity, entityId, entityName, timestamp: now() }, ...s.activities].slice(0, 50) })),
}));
