import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dependências que podem ser externalizadas SOMENTE no build,
 * e APENAS se futuramente você mudar para:
 * - microfrontend
 * - build via CDN
 *
 * ⚠️ NÃO coloque react / react-dom aqui
 */
const BUILD_EXTERNALS = [
  // Exemplo de libs pesadas que podem virar CDN no futuro
  // 'xlsx',
  // 'jspdf',
  // 'firebase/app',
];

/**
 * Prefixos que podem ser tratados como externos no build
 */
const BUILD_EXTERNAL_PREFIXES = [
  // 'firebase'
];

export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente conforme modo (dev / prod)
  // Use '.' instead of process.cwd() to resolve type error
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [
      react(),
    ],

    server: {
      port: 3000,
      strictPort: true,
    },

    preview: {
      port: 4173,
      strictPort: true,
    },

    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',

      rollupOptions: {
        /**
         * ⚠️ Externalização controlada
         * Somente aplicada se você realmente precisar
         */
        external: (id: string) => {
          if (BUILD_EXTERNALS.includes(id)) return true;
          return BUILD_EXTERNAL_PREFIXES.some(prefix => id.startsWith(prefix));
        },
      },
    },

    optimizeDeps: {
      /**
       * Garante que React SEMPRE seja otimizado corretamente
       */
      include: ['react', 'react-dom'],
    },

    define: {
      /**
       * Compatibilidade com libs que usam process.env
       */
      'process.env': env,
    },

    resolve: {
      /**
       * Estrutura escalável de aliases
       */
      alias: {
        '@': '/src',
        '@components': '/src/components',
        '@pages': '/src/pages',
        '@hooks': '/src/hooks',
        '@services': '/src/services',
        '@utils': '/src/utils',
        '@assets': '/src/assets',
        '@styles': '/src/styles',
      },
    },

    css: {
      /**
       * Pronto para crescer com preprocessadores
       */
      preprocessorOptions: {
        scss: {
          additionalData: `@use "@/styles/variables.scss" as *;`,
        },
      },
    },
  };
});