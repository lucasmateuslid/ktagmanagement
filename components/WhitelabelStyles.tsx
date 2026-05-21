import React, { useEffect, useState } from 'react';
import { storage } from '../services/storage';
import type { PublicSettings } from '../services/storage';

// Defesa em profundidade contra CSS injection: só permite #RGB, #RRGGBB
// ou #RRGGBBAA (com ou sem #). Qualquer outra forma — incluindo `red; }
// body { ... } /*` — vira undefined e a cor cai pro default abaixo.
// Só admin do tenant pode editar themeColors via UI, mas se um doc
// adulterado chegar (Firestore comprometido, migração antiga, etc.),
// ainda assim não há quebra do <style>.
const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
function safeHex(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  if (!HEX_RE.test(trimmed)) return undefined;
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

// Helper para escurecer/clarear cor hex (usada em hover variants).
function shadeHex(hex: string, percent: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const num = parseInt(h, 16);
  const r = (num >> 16) + Math.round(255 * percent);
  const g = ((num >> 8) & 0x00ff) + Math.round(255 * percent);
  const b = (num & 0x0000ff) + Math.round(255 * percent);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return '#' + (clamp(r) * 0x10000 + clamp(g) * 0x100 + clamp(b)).toString(16).padStart(6, '0');
}

export const WhitelabelStyles: React.FC = () => {
    const [settings, setSettings] = useState<PublicSettings | null>(null);

    useEffect(() => {
        // public_settings é legível sem auth — Login e telas pré-login podem
        // pintar o tema. Apenas uma leitura no mount; saveSettings atualiza
        // o doc espelho, então não precisamos polling.
        storage.getPublicSettings().then(setSettings).catch(() => {});
    }, []);

    if (!settings || !settings.themeColors) return null;

    // Cada valor passa por safeHex — qualquer coisa fora de #hex vira undefined
    // e o template literal aborta a regra correspondente, mantendo o <style>
    // bem-formado.
    const primaryColor    = safeHex(settings.themeColors.primaryColor);
    const buttonTextColor = safeHex(settings.themeColors.buttonTextColor);
    const titleColorLight = safeHex(settings.themeColors.titleColorLight);
    const titleColorDark  = safeHex(settings.themeColors.titleColorDark);
    const cardBgLight     = safeHex(settings.themeColors.cardBgLight);
    const cardBgDark      = safeHex(settings.themeColors.cardBgDark);
    const pageBgLight     = safeHex(settings.themeColors.pageBgLight);
    const pageBgDark      = safeHex(settings.themeColors.pageBgDark);

    const chartColorsSafe = (settings.themeColors.chartColors || '')
      .split(',')
      .map(c => safeHex(c.trim()))
      .filter((c): c is string => !!c);

    const primaryHover = primaryColor ? shadeHex(primaryColor, -0.08) : undefined;

    return (
        <style>{`
            :root {
                ${primaryColor ? `--theme-primary: ${primaryColor};` : '--theme-primary: #f59e0b;'}
                ${primaryHover ? `--theme-primary-hover: ${primaryHover};` : ''}
                ${buttonTextColor ? `--theme-button-text: ${buttonTextColor};` : '--theme-button-text: #ffffff;'}
                ${titleColorLight ? `--theme-title-light: ${titleColorLight};` : '--theme-title-light: #18181b;'}
                ${titleColorDark ? `--theme-title-dark: ${titleColorDark};` : '--theme-title-dark: #ffffff;'}
                ${cardBgLight ? `--theme-card-light: ${cardBgLight};` : '--theme-card-light: #ffffff;'}
                ${cardBgDark ? `--theme-card-dark: ${cardBgDark};` : '--theme-card-dark: #18181b;'}
                ${chartColorsSafe.map((c, i) => `--theme-chart-${i}: ${c};`).join('\n')}
            }

            ${primaryColor ? `
                /* Background utilities */
                .bg-primary-400, .bg-primary-500, .bg-primary-600, .bg-primary-700,
                .bg-indigo-500, .bg-indigo-600,
                .bg-blue-500, .bg-blue-600,
                .bg-amber-500, .bg-amber-600 { background-color: ${primaryColor} !important; }

                /* Hover variants */
                .hover\\:bg-primary-400:hover, .hover\\:bg-primary-500:hover, .hover\\:bg-primary-600:hover,
                .hover\\:bg-indigo-600:hover, .hover\\:bg-blue-600:hover { background-color: ${primaryHover} !important; }

                /* Text utilities */
                .text-primary-400, .text-primary-500, .text-primary-600,
                .text-indigo-500, .text-blue-500 { color: ${primaryColor} !important; }

                /* Border / ring */
                .border-primary-500, .border-indigo-500, .border-blue-500 { border-color: ${primaryColor} !important; }
                .ring-primary-500, .ring-indigo-500, .ring-blue-500 { --tw-ring-color: ${primaryColor} !important; }
                .focus\\:border-primary-500:focus, .focus\\:border-indigo-500:focus, .focus\\:border-blue-500:focus { border-color: ${primaryColor} !important; }

                /* Translucent backgrounds (with /10, /20 etc) — Tailwind compõe estes em runtime,
                   então pintamos manualmente os mais comuns. */
                .bg-primary-500\\/10, .bg-indigo-500\\/10 { background-color: ${primaryColor}1a !important; }
                .bg-primary-500\\/20, .bg-indigo-500\\/20 { background-color: ${primaryColor}33 !important; }
            ` : ''}

            ${buttonTextColor ? `
                button.bg-primary-400, button.bg-primary-500, button.bg-primary-600,
                button.bg-indigo-500, button.bg-blue-500 { color: ${buttonTextColor} !important; }
            ` : ''}

            ${titleColorLight ? `
                html:not(.dark) h1, html:not(.dark) h2, html:not(.dark) h3, html:not(.dark) .font-display { color: ${titleColorLight} !important; }
            ` : ''}

            ${titleColorDark ? `
                html.dark h1, html.dark h2, html.dark h3, html.dark .font-display { color: ${titleColorDark} !important; }
            ` : ''}

            ${pageBgLight ? `
                html:not(.dark) body, html:not(.dark) #root, html:not(.dark) .bg-zinc-50, html:not(.dark) .bg-zinc-100, html:not(.dark) .bg-gray-50 { background-color: ${pageBgLight} !important; }
            ` : ''}

            ${pageBgDark ? `
                html.dark body, html.dark #root, html.dark .bg-black, html.dark .bg-zinc-950 { background-color: ${pageBgDark} !important; }
            ` : ''}

            ${cardBgLight ? `
                html:not(.dark) .bg-white { background-color: ${cardBgLight} !important; }
            ` : ''}

            ${cardBgDark ? `
                html.dark .bg-zinc-900 { background-color: ${cardBgDark} !important; }
            ` : ''}
        `}</style>
    );
};
