
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
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
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
        }
      }
    },
  },
  plugins: [],
}
