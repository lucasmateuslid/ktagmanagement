
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      // Externalize dependencies to use the versions from index.html (CDN)
      // This prevents the "Two Reacts" issue causing "useRef of null"
      external: ['react', 'react-dom', 'firebase/app', 'firebase/firestore', '@google/genai']
    }
  },
  optimizeDeps: {
    // Do not bundle these, use the browser-native imports
    exclude: ['react', 'react-dom', 'firebase/app', 'firebase/firestore', '@google/genai']
  },
  define: {
    'process.env': process.env
  }
});
