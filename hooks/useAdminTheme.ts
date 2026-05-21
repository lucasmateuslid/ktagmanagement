import * as React from 'react';

export type AdminTheme = 'light' | 'dark';

const KEY = 'ktag-admin-theme';

function readInitial(): AdminTheme {
  if (typeof window === 'undefined') return 'light';
  const v = localStorage.getItem(KEY);
  return v === 'dark' ? 'dark' : 'light';
}

/**
 * Tema do painel admin. Persiste em localStorage e aplica:
 *  - `.admin-light` no <body> (ativa overrides CSS escopados em index.css)
 *  - retorna a className do container raiz com as utilidades base (`admin-light` ou `dark`)
 *
 * O tenant não é afetado: o efeito limpa as classes ao desmontar.
 */
export function useAdminTheme() {
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

  return { theme, setTheme, toggle, rootClass };
}
