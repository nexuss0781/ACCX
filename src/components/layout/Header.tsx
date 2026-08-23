import { useState } from 'react';
import { Search, Bell, X } from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
}

export default function Header({ title, subtitle, onSearch, searchPlaceholder = 'Search...', children }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  const clearSearch = () => {
    setSearchQuery('');
    onSearch?.('');
    setSearchOpen(false);
  };

  return (
    <div className="flex items-center justify-between mb-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {onSearch && (
          <div className="relative">
            {searchOpen ? (
              <div className="flex items-center bg-bg-surface border border-border-theme rounded-xl overflow-hidden animate-scale-in">
                <Search className="w-4 h-4 text-text-muted ml-3" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-64 px-2 py-2.5 text-sm outline-none bg-transparent"
                />
                <button onClick={clearSearch} className="p-2.5 hover:bg-bg-raised transition-colors">
                  <X className="w-4 h-4 text-text-muted" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2.5 rounded-xl border border-border-theme bg-bg-surface hover:bg-bg-raised transition-colors text-text-secondary hover:text-text-primary"
              >
                <Search className="w-4.5 h-4.5" />
              </button>
            )}
          </div>
        )}
        <ThemeToggle />
        <button className="p-2.5 rounded-xl border border-border-theme bg-bg-surface hover:bg-bg-raised transition-colors text-text-secondary hover:text-text-primary relative">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
        </button>
      </div>
    </div>
  );
}
