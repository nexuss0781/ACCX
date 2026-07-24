export type Theme = 'light' | 'dark';

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('accx-theme') as Theme | null;
  if (stored === 'light' || stored === 'dark') return stored;
  return getSystemTheme();
}

export function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem('accx-theme', theme);
}

export function toggleTheme(current: Theme): Theme {
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  return next;
}

export function initTheme() {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}