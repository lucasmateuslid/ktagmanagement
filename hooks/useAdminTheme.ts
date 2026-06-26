import * as React from 'react';

export type AdminTheme = 'light' | 'dark';

const KEY = 'ktag-admin-theme';

function readInitial(): AdminTheme {
  if (typeof window === 'undefined') return 'light';
  const v = localStorage.getItem(KEY);
  return v === 'dark' ? 'dark' : 'light';
}

interface AdminThemeValue {
  theme: AdminTheme;
  setTheme: (next: AdminTheme) => void;
  toggle: () => void;
  rootClass: string;
}

const AdminThemeContext = React.createContext<AdminThemeValue | null>(null);

/**
 * Fonte única de verdade do tema do painel admin. Precisa envolver toda a
 * árvore do admin (login + layout autenticado) uma única vez, senão páginas
 * que chamam useAdminTheme() de forma independente voltam a dessincronizar.
 */
export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<AdminTheme>(readInitial);

  const setTheme = React.useCallback((next: AdminTheme) => {
    setThemeState(next);
    try { localStorage.setItem(KEY, next); } catch (_) { /* noop */ }
  }, []);

  const toggle = React.useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  React.useEffect(() => {
    const body = document.body;
    if (theme === 'light') {
      body.classList.add('admin-light');
      body.classList.remove('admin-dark');
    } else {
      body.classList.remove('admin-light');
      body.classList.add('admin-dark');
    }
    return () => {
      body.classList.remove('admin-light');
      body.classList.remove('admin-dark');
    };
  }, [theme]);

  const rootClass = theme === 'light'
    ? 'admin-light bg-slate-50 text-slate-900'
    : 'dark bg-zinc-950 text-white';

  const value = React.useMemo(
    () => ({ theme, setTheme, toggle, rootClass }),
    [theme, setTheme, toggle, rootClass],
  );

  return React.createElement(AdminThemeContext.Provider, { value }, children);
}

export function useAdminTheme(): AdminThemeValue {
  const ctx = React.useContext(AdminThemeContext);
  if (!ctx) {
    throw new Error('useAdminTheme() deve ser usado dentro de <AdminThemeProvider>');
  }
  return ctx;
}
