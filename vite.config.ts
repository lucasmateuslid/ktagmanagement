
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// List of exact match dependencies to externalize
const exactExternals = [
  'react',
  'react-dom',
  'react-dom/client',
  'react-router-dom',
  'framer-motion',
  'lucide-react',
  'recharts',
  'leaflet',
  'react-leaflet',
  'jspdf',
  'jspdf-autotable',
  'xlsx',
  '@google/genai'
];

// List of prefixes to externalize (e.g., firebase/app, firebase/firestore)
const prefixExternals = [
  'firebase'
];

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'force-external',
      enforce: 'pre',
      resolveId(id) {
        // Check exact matches
        if (exactExternals.includes(id)) {
          return { id, external: true };
        }
        // Check prefixes
        for (const prefix of prefixExternals) {
          if (id.startsWith(prefix)) {
            return { id, external: true };
          }
        }
        return null;
      }
    }
  ],
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: (id) => {
        if (exactExternals.includes(id)) return true;
        for (const prefix of prefixExternals) {
          if (id.startsWith(prefix)) return true;
        }
        return false;
      }
    }
  },
  optimizeDeps: {
    exclude: [...exactExternals, ...prefixExternals]
  },
  define: {
    'process.env': JSON.stringify(process.env || {})
  }
});
