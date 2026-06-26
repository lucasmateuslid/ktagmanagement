import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '');

  return {
    plugins: [react()],

    envDir: repoRoot,

    server: {
      port: 3005,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
        '/ws': {
          target: 'ws://localhost:4000',
          ws: true,
        },
      },
    },

    preview: {
      port: 4173,
      strictPort: true,
    },

    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
    },

    optimizeDeps: {
      include: ['react', 'react-dom'],
    },

    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY ?? ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? ''),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@components': path.resolve(__dirname, './components'),
        '@pages': path.resolve(__dirname, './pages'),
        '@hooks': path.resolve(__dirname, './hooks'),
        '@services': path.resolve(__dirname, './services'),
        '@utils': path.resolve(__dirname, './utils'),
        '@assets': path.resolve(__dirname, './assets'),
        '@styles': path.resolve(__dirname, './styles'),
      },
    },
  };
});
