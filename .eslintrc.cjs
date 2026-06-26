/**
 * ESLint mínimo focado em padronização visual.
 *
 * Filosofia: warn-first. Não trava CI até a base estar limpa.
 * Regras estritas (errors) ficam só para anti-patterns críticos.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  env: { browser: true, es2022: true, node: true },
  settings: {
    react: { version: 'detect' },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'jsx-a11y'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  ignorePatterns: [
    'dist/**',
    'node_modules/**',
    'functions/**',
    'scripts/**',
    '*.cjs',
    '*.js',
    'public/**',
  ],
  rules: {
    /* React */
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',

    /* TS — relaxado p/ não bloquear, já que a base é grande */
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/ban-ts-comment': 'warn',

    /* A11y — base */
    'jsx-a11y/alt-text': 'warn',
    'jsx-a11y/anchor-is-valid': 'warn',
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/no-static-element-interactions': 'warn',
    'jsx-a11y/label-has-associated-control': 'warn',

    /* ────────── Padronização visual ──────────
     * Regras customizadas via no-restricted-syntax: bloqueia padrões
     * Tailwind arbitrários típicos.
     *
     * Detecta uso de classes do tipo `text-[Npx]`, `rounded-[Npx]`,
     * cores hex em className e abusos de !important.
     */
    'no-restricted-syntax': [
      'warn',
      {
        // text-[Npx] em string literals (className)
        selector: 'Literal[value=/text-\\[[0-9]+px\\]/]',
        message:
          "Não use text-[Npx]. Use 'text-label-xs', 'text-label-sm', 'text-caption' ou um tamanho da escala Tailwind (text-xs/sm/base/...). Veja tailwind.config.js.",
      },
      {
        selector: 'Literal[value=/rounded-\\[[0-9]+px\\]/]',
        message:
          "Não use rounded-[Npx]. Use 'rounded-card', 'rounded-card-lg', 'rounded-pill' ou um raio da escala (rounded-md/lg/xl/2xl).",
      },
      {
        // bg-amber-500 (deve usar bg-brand-500 pra respeitar whitelabel)
        selector: 'Literal[value=/\\b(bg|text|border|ring|from|to|via)-amber-[0-9]+/]',
        message:
          "Use 'brand-*' em vez de 'amber-*' para respeitar whitelabel. Ex: bg-brand-500.",
      },
      {
        // z-[N] fora dos tokens (qualquer número que não seja 10/20/30/...)
        selector: 'Literal[value=/z-\\[[0-9]+\\]/]',
        message:
          "Não use z-[N] hardcoded. Use 'z-dropdown', 'z-overlay', 'z-modal', 'z-popover', 'z-toast' (theme.zIndex).",
      },
    ],
  },
  overrides: [
    {
      // Não policiar utility/glue
      files: ['vite.config.ts', 'tailwind.config.js', 'postcss.config.js', 'polyfill-fix.ts'],
      rules: { 'no-restricted-syntax': 'off' },
    },
  ],
};
