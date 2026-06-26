
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
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // "Carbon" Palette based on Zinc/Neutral.
        // zinc-800/900/950 do Tailwind já são #27272a/#18181b/#09090b — não precisam de override.
        // zinc-750 era duplicata exata de 800 (removido). Mantemos só o 850 customizado.
        zinc: {
          850: '#1f1f22', // Deep Card (entre o 800 e o 900 padrão)
        },
        // Accent Color: C6 Yellow Style
        primary: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d', 
          400: '#fbbf24',
          500: '#f59e0b', // Standard C6 Yellow/Orange
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
          // Bright Yellow for Dark Mode highlights
          yellow: '#FFC800' 
        },
        "gray-100": "var(--ds-gray-100)",
        "gray-200": "var(--ds-gray-200)",
        "gray-500": "var(--ds-gray-500)",
        "gray-600": "var(--ds-gray-600)",
        "gray-700": "var(--ds-gray-700)",
        "gray-1000": "var(--ds-gray-1000)",
        "background-100": "var(--ds-background-100)",
        // Tokens semânticos Monitora 360 (preenchimentos sólidos).
        // Respeitam o whitelabel: --accent herda --theme-primary quando o tenant define.
        // Obs.: modificadores de opacidade (bg-accent/10) NÃO funcionam com var() —
        // para tints sutis continue usando primary-*/amber-* (interceptados pelo whitelabel).
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        success: 'var(--success)',
        danger: 'var(--danger)',
        info: 'var(--info)',
        warning: 'var(--warning)',
        'fg-1': 'var(--fg-1)',
        'fg-2': 'var(--fg-2)',
        'fg-3': 'var(--fg-3)',
        'surface': 'var(--bg-surface)',
        'surface-2': 'var(--bg-surface-2)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
      fontSize: {
        // O micro-label onipresente de 10px (assinatura da marca).
        '2xs': ['10px', { lineHeight: '1' }],
      },
      letterSpacing: {
        // Tracking "tático" 0.3em dos eyebrows.
        mega: '0.3em',
      },
      boxShadow: {
        'glow-amber': 'var(--shadow-glow-amber)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
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
