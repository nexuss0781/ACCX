export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
}

export interface Category { id: string; name: string; color: string; icon: string; createdAt: string; }
export interface Folder { id: string; name: string; description?: string; color: string; createdAt: string; updatedAt: string; }

/** Browser-visible account metadata only. Secret values and custom secret fields are never represented here. */
export interface Account {
  id: string;
  title: string;
  provider?: string;
  reference?: string;
  environment?: 'development' | 'staging' | 'production';
  status?: 'pending' | 'active' | 'revoked';
  activeVersion?: number;
  rotationState?: 'stable' | 'rotation_required' | 'rotating';
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  fieldKind?: 'password' | 'api_token' | 'refresh_token' | 'client_secret' | 'recovery_code' | 'cookie' | 'ssh_key' | 'custom';
  tags?: string[];
  aliases?: string[];
  healthStatus?: 'unknown' | 'healthy' | 'attention' | 'failed';
  lastRotatedAt?: string | null;
  username?: string;
  email?: string;
  description?: string;
  url?: string;
  categoryId?: string;
  folderId?: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Note { id: string; title: string; content: string; color: string; pinned: boolean; createdAt: string; updatedAt: string; }
export interface Activity { id: string; type: 'create' | 'update' | 'delete'; entity: 'account' | 'note' | 'category' | 'folder'; entityId: string; entityName: string; timestamp: string; }
export type NoteColor = '#fef3c7' | '#dbeafe' | '#dcfce7' | '#fce7f3' | '#f3e8ff' | '#fed7aa' | '#e0e7ff' | '#ccfbf1';
export const NOTE_COLORS: { value: NoteColor; name: string }[] = [{ value: '#fef3c7', name: 'Amber' }, { value: '#dbeafe', name: 'Blue' }, { value: '#dcfce7', name: 'Green' }, { value: '#fce7f3', name: 'Pink' }, { value: '#f3e8ff', name: 'Purple' }, { value: '#fed7aa', name: 'Orange' }, { value: '#e0e7ff', name: 'Indigo' }, { value: '#ccfbf1', name: 'Teal' }];
export const CATEGORY_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899'];
export const FOLDER_COLORS = ['#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];
export const CATEGORY_ICONS = ['Globe', 'Shield', 'CreditCard', 'Mail', 'Briefcase', 'ShoppingCart', 'Code', 'Heart', 'Star', 'Bookmark', 'Zap', 'Lock', 'Key', 'Database', 'Cloud', 'Monitor'];
