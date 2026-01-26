import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega env vars baseadas no modo (ex: .env)
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: 3000,
      strictPort: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: false, // Desabilita sourcemaps em produção para dificultar engenharia reversa
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'firebase/app', 'firebase/auth'],
            charts: ['recharts'],
            maps: ['leaflet', 'react-leaflet']
          }
        }
      }
    },
    define: {
      // Injeta variáveis de ambiente de forma segura
      'process.env.FIREBASE_API_KEY': JSON.stringify(env.FIREBASE_API_KEY),
      'process.env.FIREBASE_PROJECT_ID': JSON.stringify(env.FIREBASE_PROJECT_ID),
      'process.env.FIREBASE_APP_ID': JSON.stringify(env.FIREBASE_APP_ID),
      // NUNCA injetar chaves secretas (JWT, SALT) aqui
    }
  };
});