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
 *  - `data-theme="light"`/`"dark"` em <html> — fonte semântica nova,
 *    ativa CSS vars (`--surface`, `--content`, etc.) em qualquer
 *    componente que use tokens (Button/Input/Modal/Field).
 *  - `.admin-light` em <body> — overrides legados em index.css que
 *    cobrem páginas admin ainda escritas com classes Tailwind dark
 *    hardcoded (bg-zinc-900, text-white...). Será removido após
 *    migração das pages para tokens semânticos.
 *  - `class="dark"` em <html> quando admin theme === dark, para
 *    manter `dark:` modifiers funcionando.
 *
 * O efeito reseta os atributos ao desmontar, então o tenant não é
 * afetado.
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
    const html = document.documentElement;
    const body = document.body;

    // Salva estado anterior para restaurar
    const prevHtmlDark = html.classList.contains('dark');
    const prevDataTheme = html.getAttribute('data-theme');

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

    return () => {
      body.classList.remove('admin-light');
      body.classList.remove('admin-dark');
      // tenant default é dark — restaura
      if (prevHtmlDark) html.classList.add('dark');
      else html.classList.remove('dark');
      if (prevDataTheme) html.setAttribute('data-theme', prevDataTheme);
      else html.removeAttribute('data-theme');
    };
  }, [theme]);

  const rootClass = theme === 'light'
    ? 'admin-light bg-surface text-content'
    : 'dark bg-surface text-content';

  return { theme, setTheme, toggle, rootClass };
}
