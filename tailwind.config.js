
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
        // "Carbon" Palette based on Zinc/Neutral
        zinc: {
          750: '#27272a', // Lighter Carbon
          800: '#27272a', // Card bg
          850: '#1f1f22', // Deep Card
          900: '#18181b', // Sidebar/Main
          950: '#09090b', // App Background
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
        "background-100": "var(--ds-background-100)"
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
