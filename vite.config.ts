
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
      external: ['@google/genai']
    }
  },
  optimizeDeps: {
    exclude: ['@google/genai']
  },
  define: {
    'process.env': process.env
  }
});
