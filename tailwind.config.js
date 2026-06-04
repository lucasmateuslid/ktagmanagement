/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./App.tsx",
    "./index.tsx"
  ],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        // "Carbon" Palette based on Zinc/Neutral.
        // zinc-800/900/950 do Tailwind já são #27272a/#18181b/#09090b — não precisam de override.
        // zinc-750 era duplicata exata de 800 (removido). Mantemos só o 850 customizado.
        zinc: {
          850: '#1f1f22', // Deep Card (entre o 800 e o 900 padrão)
        /* ───────── Brand (whitelabel-ready) ─────────
         * Os tokens `brand-*` leem CSS vars `--brand-*` (formato `R G B`),
         * o que permite alpha modifiers tipo `bg-brand-500/20` continuarem
         * funcionando. Customização por tenant: sobrescrever as vars em
         * runtime (vide WhitelabelStyles.tsx). */
        brand: {
          50:  'rgb(var(--brand-50)  / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
          DEFAULT: 'rgb(var(--brand-500) / <alpha-value>)',
        },

        /* ───────── Surfaces (semânticas, trocam por tema) ─────────
         * Use `bg-surface` para fundo da página, `bg-surface-raised` para
         * cards, `bg-surface-sunken` para fundo dentro de card (input, code),
         * `bg-surface-overlay` para hovers/active. */
        surface: {
          DEFAULT: 'rgb(var(--surface)         / <alpha-value>)',
          raised:  'rgb(var(--surface-raised)  / <alpha-value>)',
          sunken:  'rgb(var(--surface-sunken)  / <alpha-value>)',
          overlay: 'rgb(var(--surface-overlay) / <alpha-value>)',
        },

        /* ───────── Texto semântico ─────────
         * `text-content` = primário, `text-content-soft` = secundário,
         * `text-content-muted` = terciário/labels, `text-content-subtle` =
         * disabled/decorativo. */
        content: {
          DEFAULT: 'rgb(var(--content)        / <alpha-value>)',
          soft:    'rgb(var(--content-soft)   / <alpha-value>)',
          muted:   'rgb(var(--content-muted)  / <alpha-value>)',
          subtle:  'rgb(var(--content-subtle) / <alpha-value>)',
          inverse: 'rgb(var(--content-inverse)/ <alpha-value>)',
        },

        /* ───────── Bordas ───────── */
        border: {
          DEFAULT: 'rgb(var(--border)        / <alpha-value>)',
          strong:  'rgb(var(--border-strong) / <alpha-value>)',
          brand:   'rgb(var(--brand-500)     / <alpha-value>)',
        },

        /* ───────── Estado semântico ───────── */
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          soft:    'rgb(var(--success) / 0.1)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          soft:    'rgb(var(--warning) / 0.1)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          soft:    'rgb(var(--danger) / 0.1)',
        },
        info: {
          DEFAULT: 'rgb(var(--info) / <alpha-value>)',
          soft:    'rgb(var(--info) / 0.1)',
        },

        /* ───────── Legados (mantidos p/ compat até codemod) ─────────
         * Não remover até migração concluir. `primary` agora aponta para
         * `--brand-*` para que whitelabel pegue automaticamente. */
        primary: {
          50:  'rgb(var(--brand-50)  / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
          950: '#451a03',
          yellow: '#FFC800',
        },
        zinc: {
          750: '#27272a',
          800: '#27272a',
          850: '#1f1f22',
          900: '#18181b',
          950: '#09090b',
        },
        "gray-100":  "var(--ds-gray-100)",
        "gray-200":  "var(--ds-gray-200)",
        "gray-500":  "var(--ds-gray-500)",
        "gray-600":  "var(--ds-gray-600)",
        "gray-700":  "var(--ds-gray-700)",
        "gray-1000": "var(--ds-gray-1000)",
        "background-100": "var(--ds-background-100)",
      },

      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      fontSize: {
        /* Tipografia "label uppercase" — padrão visual dominante do produto.
         * Substitui `text-[10px] font-black uppercase tracking-widest` etc. */
        'label-xs': ['10px', { lineHeight: '14px', letterSpacing: '0.2em',  fontWeight: '800' }],
        'label-sm': ['11px', { lineHeight: '15px', letterSpacing: '0.16em', fontWeight: '800' }],
        'label':    ['12px', { lineHeight: '16px', letterSpacing: '0.12em', fontWeight: '700' }],
        'caption':  ['12px', { lineHeight: '16px' }],
      },

      borderRadius: {
        'card':    '24px',
        'card-lg': '32px',
        'pill':    '9999px',
      },

      zIndex: {
        dropdown: '100',
        sticky:   '500',
        overlay:  '1000',
        modal:    '2000',
        popover:  '3000',
        toast:    '9000',
      },

      boxShadow: {
        'card':       '0 4px 12px -2px rgb(0 0 0 / 0.08), 0 0 0 1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 12px 24px -8px rgb(0 0 0 / 0.16)',
        'modal':      '0 24px 48px -12px rgb(0 0 0 / 0.50)',
        'glow-brand': '0 0 24px -4px rgb(var(--brand-500) / 0.4)',
      },

      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
      },
      // Escala de z-index semântica (UI-005). Substitui os ~30 valores arbitrários.
      // Regra: overlays/modais ficam ACIMA do chrome (header/drawer); toasts globais no topo.
      zIndex: {
        dropdown: '1000',
        sticky: '1100',
        header: '2000',
        drawer: '3000',   // sidebar
        overlay: '4000',  // backdrop de modal
        modal: '4100',
        popover: '4300',  // selects/menus precisam vencer o modal em que estão
        confirm: '4500',  // diálogos de confirmação abrem POR CIMA de modais
        toast: '9000',
        critical: '9900', // banners críticos / anúncios globais
      },
    },
  },
  plugins: [],
};
