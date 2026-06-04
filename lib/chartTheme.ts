/**
 * Tema único para Recharts/Leaflet/SVG embeds.
 *
 * Lê CSS vars `--brand-*` em runtime — então respeita whitelabel sem
 * precisar prop-drilling. Use em qualquer chart no lugar de hex hardcoded.
 *
 * Os fallbacks são para SSR / build time onde `document` não existe.
 */

const FALLBACK = {
  brand: '#f59e0b',
  brand400: '#fbbf24',
  surface: '#18181b',
  surfaceMuted: '#27272a',
  border: '#3f3f46',
  content: '#fafafa',
  contentMuted: '#a1a1aa',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
};

/** Lê uma var CSS `--name` (formato `R G B`) e retorna `rgb(R, G, B)`. */
function readRgbVar(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  try {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    if (!raw) return fallback;
    return `rgb(${raw.replace(/\s+/g, ', ')})`;
  } catch {
    return fallback;
  }
}

/** Snapshot do tema — chame em cada render que dependa de chart. */
export function getChartTheme() {
  return {
    brand:        readRgbVar('--brand-500', FALLBACK.brand),
    brand400:     readRgbVar('--brand-400', FALLBACK.brand400),
    surface:      readRgbVar('--surface-raised', FALLBACK.surface),
    surfaceMuted: readRgbVar('--surface-sunken', FALLBACK.surfaceMuted),
    border:       readRgbVar('--border-strong', FALLBACK.border),
    content:      readRgbVar('--content', FALLBACK.content),
    contentMuted: readRgbVar('--content-muted', FALLBACK.contentMuted),
    success:      readRgbVar('--success', FALLBACK.success),
    warning:      readRgbVar('--warning', FALLBACK.warning),
    danger:       readRgbVar('--danger', FALLBACK.danger),
    info:         readRgbVar('--info', FALLBACK.info),
  };
}

/**
 * Paleta categórica monocromática (brand + neutros), usada em pie/bar
 * com muitas séries onde cores semânticas não fazem sentido.
 */
export function getChartPalette(): string[] {
  const t = getChartTheme();
  return [t.brand, '#52525b', '#71717a', '#a1a1aa', '#d4d4d8', t.brand400];
}

/** Estilo padrão para `<Tooltip contentStyle={...}>` do Recharts. */
export function getTooltipStyle(): React.CSSProperties {
  const t = getChartTheme();
  return {
    backgroundColor: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 12,
    fontSize: 12,
    color: t.content,
    padding: '8px 12px',
    boxShadow: '0 12px 32px -8px rgb(0 0 0 / 0.4)',
  };
}

export function getTooltipItemStyle(): React.CSSProperties {
  return { color: getChartTheme().contentMuted };
}
