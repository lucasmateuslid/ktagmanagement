/**
 * Fonte única do nome da marca exibido na landing page.
 * Trocar aqui propaga para Navbar, Footer, Hero cinematográfico, etc.
 *
 * O nome é renderizado como: {prefix}{accent}{suffix}, com o `accent`
 * em destaque na cor primária. Para "KTAGFINDER" temos K + TAG + FINDER.
 */
export const BRAND = {
  name: 'KTAGFINDER',
  prefix: 'K',
  accent: 'TAG',
  suffix: 'FINDER',
  initials: 'KT',
  tagline: 'Plataforma Whitelabel',
  domain: 'ktagfinder.app',
  email: 'contato@ktagfinder.app',
  emailLegacy: 'contato@ktagfinder.app',
  primaryColor: '#F5A623',
  primaryColorDark: '#C8841A',
} as const;

export type Brand = typeof BRAND;
