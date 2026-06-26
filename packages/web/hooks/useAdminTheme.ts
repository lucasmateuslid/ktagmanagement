import * as React from 'react';

export type AdminTheme = 'light' | 'dark';

const KEY = 'ktag-admin-theme';

function readInitial(): AdminTheme {
  if (typeof window === 'undefined') return 'light';
  const v = localStorage.getItem(KEY);
  return v === 'dark' ? 'dark' : 'light';
}

function applyThemeToDom(theme: AdminTheme) {
  const html = document.documentElement;
  const body = document.body;
  html.setAttribute('data-theme', theme);
  if (theme === 'light') {
    html.classList.remove('dark');
    body.classList.add('admin-light');
    body.classList.remove('admin-dark');
  } else {
    html.classList.add('dark');
    body.classList.remove('admin-light');
    body.classList.add('admin-dark');
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface AdminThemeCtx {
  theme: AdminTheme;
  toggle: () => void;
  setTheme: (t: AdminTheme) => void;
  rootClass: string;
}

const AdminThemeContext = React.createContext<AdminThemeCtx | null>(null);

/**
 * Provider único que gerencia tema, persiste em localStorage e aplica no DOM.
 * Deve ficar acima de todo o painel admin (AdminApp) para que todas as páginas
 * compartilhem o mesmo estado — evita múltiplas instâncias de estado que
 * brigam pelo DOM e causam dessincronismo entre abas.
 */
export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<AdminTheme>(readInitial);

  const setTheme = React.useCallback((next: AdminTheme) => {
    setThemeState(next);
    try { localStorage.setItem(KEY, next); } catch (_) { /* noop */ }
  }, []);

  const toggle = React.useCallback(() => {
    setThemeState(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(KEY, next); } catch (_) { /* noop */ }
      return next;
    });
  }, []);

  // Único useEffect que toca o DOM — roda só quando o tema muda no Provider.
  React.useEffect(() => {
    applyThemeToDom(theme);
    return () => {
      // Restaura tenant default (dark) ao desmontar o painel admin.
      document.body.classList.remove('admin-light', 'admin-dark');
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    };
  }, [theme]);

  const rootClass = theme === 'light'
    ? 'admin-light bg-surface text-content'
    : 'dark bg-surface text-content';

  const ctx = React.useMemo(
    () => ({ theme, toggle, setTheme, rootClass }),
    [theme, toggle, setTheme, rootClass],
  );

  return React.createElement(AdminThemeContext.Provider, { value: ctx }, children);
}

/**
 * Hook consumidor — lê do contexto compartilhado.
 * Deve ser usado dentro de <AdminThemeProvider>.
 */
export function useAdminTheme(): AdminThemeCtx {
  const ctx = React.useContext(AdminThemeContext);
  if (!ctx) throw new Error('useAdminTheme must be used inside AdminThemeProvider');
  return ctx;
}
