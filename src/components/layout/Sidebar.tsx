import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useStore } from '../../store';
import {
  LayoutDashboard, KeyRound, FolderOpen, Tag, StickyNote,
  ChevronLeft, ChevronRight, LogOut, Settings, Shield
} from 'lucide-react';
import { cn } from '../../utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/accounts', icon: KeyRound, label: 'Accounts' },
  { to: '/folders', icon: FolderOpen, label: 'Folders' },
  { to: '/categories', icon: Tag, label: 'Categories' },
  { to: '/notes', icon: StickyNote, label: 'Notes' },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, logout, user } = useStore();
  const location = useLocation();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-bg-surface border-r border-border-theme z-40 transition-all duration-300 ease-in-out flex flex-col',
        sidebarCollapsed ? 'w-[68px]' : 'w-[260px]'
      )}
    >
      <div className={cn(
        'flex items-center h-16 border-b border-border-theme px-4',
        sidebarCollapsed ? 'justify-center' : 'justify-between'
      )}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2.5 animate-fade-in">
            <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-text-primary">ACCX</span>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
            <Shield className="w-4.5 h-4.5 text-white" />
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className={cn(
            'p-1.5 rounded-lg hover:bg-bg-raised transition-colors text-text-muted hover:text-text-primary',
            sidebarCollapsed && 'hidden'
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              onMouseEnter={() => setHoveredItem(to)}
              onMouseLeave={() => setHoveredItem(null)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 relative group',
                isActive
                  ? 'bg-accent-subtle text-accent-hover font-medium'
                  : 'text-text-secondary hover:bg-bg-raised hover:text-text-primary',
                sidebarCollapsed && 'justify-center px-0'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-r-full" />
              )}
              <Icon className={cn('w-5 h-5 shrink-0', isActive ? 'text-accent' : '')} />
              {!sidebarCollapsed && <span className="text-sm">{label}</span>}
              {sidebarCollapsed && hoveredItem === to && (
                <div className="absolute left-full ml-2 px-2.5 py-1 bg-text-primary text-white text-xs rounded-lg whitespace-nowrap z-50 animate-scale-in">
                  {label}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-border-theme p-3 space-y-1">
        {!sidebarCollapsed && user && (
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-accent-subtle flex items-center justify-center text-accent-hover text-sm font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
              <p className="text-xs text-text-muted truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors',
            sidebarCollapsed && 'justify-center px-0'
          )}
        >
          <Settings className="w-5 h-5 shrink-0" />
          {!sidebarCollapsed && <span className="text-sm">Settings</span>}
        </button>
        <button
          onClick={logout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-danger-theme hover:bg-danger-subtle transition-colors',
            sidebarCollapsed && 'justify-center px-0'
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!sidebarCollapsed && <span className="text-sm">Sign Out</span>}
        </button>
        {sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-full px-0 py-2.5 rounded-xl text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
