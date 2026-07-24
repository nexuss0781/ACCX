import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Account, Category, Folder, Note, Activity } from '../types';
import type { Theme } from '../utils/theme';
import { applyTheme } from '../utils/theme';

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

interface AppState {
  user: User | null;
  accounts: Account[];
  categories: Category[];
  folders: Folder[];
  notes: Note[];
  activities: Activity[];
  sidebarCollapsed: boolean;
  theme: Theme;

  login: (email: string, password: string) => boolean;
  register: (name: string, email: string, password: string) => boolean;
  logout: () => void;
  toggleSidebar: () => void;
  toggleTheme: () => void;

  addAccount: (account: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'customFields' | 'favorite'> & { customFields?: Account['customFields'] }) => string;
  updateAccount: (id: string, data: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  toggleFavorite: (id: string) => void;

  addCategory: (name: string, color: string, icon: string) => string;
  updateCategory: (id: string, data: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  addFolder: (name: string, description?: string, color?: string) => string;
  updateFolder: (id: string, data: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;

  addNote: (title: string, content: string, color: string) => string;
  updateNote: (id: string, data: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  togglePinNote: (id: string) => void;

  addActivity: (type: Activity['type'], entity: Activity['entity'], entityId: string, entityName: string) => void;
}

const defaultCategories: Category[] = [
  { id: 'cat-1', name: 'Social Media', color: '#6366f1', icon: 'Globe', createdAt: new Date().toISOString() },
  { id: 'cat-2', name: 'Work', color: '#3b82f6', icon: 'Briefcase', createdAt: new Date().toISOString() },
  { id: 'cat-3', name: 'Finance', color: '#22c55e', icon: 'CreditCard', createdAt: new Date().toISOString() },
  { id: 'cat-4', name: 'Shopping', color: '#f59e0b', icon: 'ShoppingCart', createdAt: new Date().toISOString() },
  { id: 'cat-5', name: 'Entertainment', color: '#ec4899', icon: 'Heart', createdAt: new Date().toISOString() },
  { id: 'cat-6', name: 'Development', color: '#14b8a6', icon: 'Code', createdAt: new Date().toISOString() },
];

const defaultFolders: Folder[] = [
  { id: 'fold-1', name: 'Personal', description: 'Personal accounts', color: '#6366f1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'fold-2', name: 'Work', description: 'Work-related accounts', color: '#3b82f6', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'fold-3', name: 'Shared', description: 'Shared with family', color: '#22c55e', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const defaultAccounts: Account[] = [
  { id: 'acc-1', title: 'GitHub', username: 'devuser', email: 'dev@example.com', password: 'gh_pat_xxxx', url: 'https://github.com', categoryId: 'cat-6', folderId: 'fold-2', customFields: [], favorite: true, notes: 'Main dev account', createdAt: new Date(Date.now() - 86400000 * 30).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'acc-2', title: 'Twitter / X', username: 'myhandle', email: 'social@example.com', password: 'tw_pass_xxxx', url: 'https://x.com', categoryId: 'cat-1', folderId: 'fold-1', customFields: [{ id: 'cf-1', label: '2FA Backup', value: 'XXXX-XXXX', type: 'text' }], favorite: false, createdAt: new Date(Date.now() - 86400000 * 60).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: 'acc-3', title: 'Chase Bank', username: 'bankuser', email: 'finance@example.com', password: 'bank_pass_xxxx', url: 'https://chase.com', categoryId: 'cat-3', folderId: 'fold-1', customFields: [{ id: 'cf-2', label: 'Account Number', value: '****4567', type: 'text' }], favorite: true, createdAt: new Date(Date.now() - 86400000 * 90).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 1).toISOString() },
  { id: 'acc-4', title: 'Amazon', username: 'shopper', email: 'shop@example.com', password: 'amz_pass_xxxx', url: 'https://amazon.com', categoryId: 'cat-4', folderId: 'fold-1', customFields: [], favorite: false, createdAt: new Date(Date.now() - 86400000 * 45).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 10).toISOString() },
  { id: 'acc-5', title: 'Slack', username: 'teamuser', email: 'work@company.com', password: 'slack_pass_xxxx', url: 'https://slack.com', categoryId: 'cat-2', folderId: 'fold-2', customFields: [{ id: 'cf-3', label: 'Workspace', value: 'mycompany.slack.com', type: 'url' }], favorite: false, createdAt: new Date(Date.now() - 86400000 * 20).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: 'acc-6', title: 'Netflix', username: 'viewer', email: 'fun@example.com', password: 'nf_pass_xxxx', url: 'https://netflix.com', categoryId: 'cat-5', folderId: 'fold-3', customFields: [], favorite: false, createdAt: new Date(Date.now() - 86400000 * 15).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 7).toISOString() },
];

const defaultNotes: Note[] = [
  { id: 'note-1', title: 'Recovery Codes', content: 'Save these recovery codes in a safe place:\n- CODE1-ABCD\n- CODE2-EFGH\n- CODE3-IJKL', color: '#fef3c7', pinned: true, createdAt: new Date(Date.now() - 86400000 * 10).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 1).toISOString() },
  { id: 'note-2', title: 'Password Policy', content: 'Use at least 16 characters\nInclude uppercase, lowercase, numbers, symbols\nNever reuse passwords\nChange every 90 days', color: '#dbeafe', pinned: false, createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'note-3', title: 'Work Projects', content: '- Q1 Launch: AccountManager v2\n- Security Audit: March\n- New SSO Integration', color: '#dcfce7', pinned: false, createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 1).toISOString() },
  { id: 'note-4', title: 'Security Tips', content: 'Enable 2FA on all accounts\nUse a password manager\nCheck for breaches at haveibeenpwned.com', color: '#fce7f3', pinned: true, createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 0.5).toISOString() },
];

const defaultActivities: Activity[] = [
  { id: 'act-1', type: 'update', entity: 'account', entityId: 'acc-3', entityName: 'Chase Bank', timestamp: new Date(Date.now() - 86400000 * 1).toISOString() },
  { id: 'act-2', type: 'create', entity: 'note', entityId: 'note-4', entityName: 'Security Tips', timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'act-3', type: 'update', entity: 'account', entityId: 'acc-1', entityName: 'GitHub', timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'act-4', type: 'create', entity: 'account', entityId: 'acc-5', entityName: 'Slack', timestamp: new Date(Date.now() - 86400000 * 20).toISOString() },
  { id: 'act-5', type: 'delete', entity: 'note', entityId: 'note-deleted', entityName: 'Old Note', timestamp: new Date(Date.now() - 86400000 * 15).toISOString() },
];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      accounts: defaultAccounts,
      categories: defaultCategories,
      folders: defaultFolders,
      notes: defaultNotes,
      activities: defaultActivities,
      sidebarCollapsed: false,
      theme: 'dark',

      login: (email: string, _password: string) => {
        const users = JSON.parse(localStorage.getItem('accx-users') || '[]') as { email: string; name: string; password: string }[];
        const found = users.find(u => u.email === email);
        if (found) {
          set({ user: { id: uid(), email: found.email, name: found.name, createdAt: new Date().toISOString() } });
          return true;
        }
        if (email === 'demo@accx.io') {
          set({ user: { id: uid(), email, name: 'Demo User', createdAt: new Date().toISOString() } });
          return true;
        }
        return false;
      },

      register: (name: string, email: string, password: string) => {
        const users = JSON.parse(localStorage.getItem('accx-users') || '[]') as { email: string; name: string; password: string }[];
        if (users.find(u => u.email === email)) return false;
        users.push({ email, name, password });
        localStorage.setItem('accx-users', JSON.stringify(users));
        set({ user: { id: uid(), email, name, createdAt: new Date().toISOString() } });
        return true;
      },

      logout: () => set({ user: null }),

      toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      toggleTheme: () => {
        const newTheme: Theme = get().theme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
        set({ theme: newTheme });
      },

      addAccount: (data) => {
        const id = uid();
        const now = new Date().toISOString();
        const account: Account = { ...data, id, customFields: data.customFields || [], favorite: false, createdAt: now, updatedAt: now };
        set(s => ({ accounts: [account, ...s.accounts] }));
        get().addActivity('create', 'account', id, data.title);
        return id;
      },

      updateAccount: (id, data) => {
        set(s => ({
          accounts: s.accounts.map(a => a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a)
        }));
        const acc = get().accounts.find(a => a.id === id);
        if (acc) get().addActivity('update', 'account', id, acc.title);
      },

      deleteAccount: (id) => {
        const acc = get().accounts.find(a => a.id === id);
        set(s => ({ accounts: s.accounts.filter(a => a.id !== id) }));
        if (acc) get().addActivity('delete', 'account', id, acc.title);
      },

      toggleFavorite: (id) => {
        set(s => ({
          accounts: s.accounts.map(a => a.id === id ? { ...a, favorite: !a.favorite } : a)
        }));
      },

      addCategory: (name, color, icon) => {
        const id = uid();
        const category: Category = { id, name, color, icon, createdAt: new Date().toISOString() };
        set(s => ({ categories: [...s.categories, category] }));
        get().addActivity('create', 'category', id, name);
        return id;
      },

      updateCategory: (id, data) => {
        set(s => ({
          categories: s.categories.map(c => c.id === id ? { ...c, ...data } : c)
        }));
      },

      deleteCategory: (id) => {
        const cat = get().categories.find(c => c.id === id);
        set(s => ({ categories: s.categories.filter(c => c.id !== id) }));
        if (cat) get().addActivity('delete', 'category', id, cat.name);
      },

      addFolder: (name, description, color) => {
        const id = uid();
        const now = new Date().toISOString();
        const folder: Folder = { id, name, description, color: color || '#6366f1', createdAt: now, updatedAt: now };
        set(s => ({ folders: [...s.folders, folder] }));
        get().addActivity('create', 'folder', id, name);
        return id;
      },

      updateFolder: (id, data) => {
        set(s => ({
          folders: s.folders.map(f => f.id === id ? { ...f, ...data, updatedAt: new Date().toISOString() } : f)
        }));
      },

      deleteFolder: (id) => {
        const fold = get().folders.find(f => f.id === id);
        set(s => ({ folders: s.folders.filter(f => f.id !== id) }));
        if (fold) get().addActivity('delete', 'folder', id, fold.name);
      },

      addNote: (title, content, color) => {
        const id = uid();
        const now = new Date().toISOString();
        const note: Note = { id, title, content, color, pinned: false, createdAt: now, updatedAt: now };
        set(s => ({ notes: [note, ...s.notes] }));
        get().addActivity('create', 'note', id, title);
        return id;
      },

      updateNote: (id, data) => {
        set(s => ({
          notes: s.notes.map(n => n.id === id ? { ...n, ...data, updatedAt: new Date().toISOString() } : n)
        }));
      },

      deleteNote: (id) => {
        const note = get().notes.find(n => n.id === id);
        set(s => ({ notes: s.notes.filter(n => n.id !== id) }));
        if (note) get().addActivity('delete', 'note', id, note.title);
      },

      togglePinNote: (id) => {
        set(s => ({
          notes: s.notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n)
        }));
      },

      addActivity: (type, entity, entityId, entityName) => {
        const activity: Activity = {
          id: uid(),
          type,
          entity,
          entityId,
          entityName,
          timestamp: new Date().toISOString(),
        };
        set(s => ({ activities: [activity, ...s.activities].slice(0, 50) }));
      },
    }),
    {
      name: 'accx-store',
      partialize: (state) => ({
        user: state.user,
        accounts: state.accounts,
        categories: state.categories,
        folders: state.folders,
        notes: state.notes,
        activities: state.activities,
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
);