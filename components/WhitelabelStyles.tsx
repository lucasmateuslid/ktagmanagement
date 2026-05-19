import React, { useEffect, useState } from 'react';
import { storage } from '../services/storage';
import type { PublicSettings } from '../services/storage';

export const WhitelabelStyles: React.FC = () => {
    const [settings, setSettings] = useState<PublicSettings | null>(null);

    useEffect(() => {
        // public_settings é legível sem auth — Login e telas pré-login podem
        // pintar o tema. Apenas uma leitura no mount; saveSettings atualiza
        // o doc espelho, então não precisamos polling.
        storage.getPublicSettings().then(setSettings).catch(() => {});
    }, []);

    if (!settings || !settings.themeColors) return null;

    const {
        primaryColor,
        buttonTextColor,
        titleColorLight,
        titleColorDark,
        cardBgLight,
        cardBgDark,
        pageBgLight,
        pageBgDark
    } = settings.themeColors;

    return (
        <style>{`
            :root {
                ${primaryColor ? `--theme-primary: ${primaryColor};` : '--theme-primary: #f59e0b;'}
                ${buttonTextColor ? `--theme-button-text: ${buttonTextColor};` : '--theme-button-text: #ffffff;'}
                ${titleColorLight ? `--theme-title-light: ${titleColorLight};` : '--theme-title-light: #18181b;'}
                ${titleColorDark ? `--theme-title-dark: ${titleColorDark};` : '--theme-title-dark: #ffffff;'}
                ${cardBgLight ? `--theme-card-light: ${cardBgLight};` : '--theme-card-light: #ffffff;'}
                ${cardBgDark ? `--theme-card-dark: ${cardBgDark};` : '--theme-card-dark: #18181b;'}
                ${settings.themeColors.chartColors ? settings.themeColors.chartColors.split(',').map((c, i) => `--theme-chart-${i}: ${c.trim()};`).join('\n') : ''}
            }

            ${primaryColor ? `
                .bg-indigo-500, .bg-blue-500, .bg-primary-500 { background-color: ${primaryColor} !important; }
                .text-indigo-500, .text-blue-500, .text-primary-500 { color: ${primaryColor} !important; }
                .border-indigo-500, .border-blue-500, .border-primary-500 { border-color: ${primaryColor} !important; }
                .ring-indigo-500, .ring-blue-500, .ring-primary-500 { --tw-ring-color: ${primaryColor} !important; }
                .focus\\:border-indigo-500:focus, .focus\\:border-primary-500:focus, .focus\\:border-blue-500:focus { border-color: ${primaryColor} !important; }
            ` : ''}

            ${buttonTextColor ? `
                button.bg-indigo-500, button.bg-primary-500, button.bg-blue-500 { color: ${buttonTextColor} !important; }
            ` : ''}

            ${titleColorLight ? `
                html:not(.dark) h1, html:not(.dark) h2, html:not(.dark) h3, html:not(.dark) .font-display { color: ${titleColorLight} !important; }
            ` : ''}
            
            ${titleColorDark ? `
                html.dark h1, html.dark h2, html.dark h3, html.dark .font-display { color: ${titleColorDark} !important; }
            ` : ''}

            ${pageBgLight ? `
                html:not(.dark) body, html:not(.dark) #root, html:not(.dark) .bg-zinc-50, html:not(.dark) .bg-gray-50 { background-color: ${pageBgLight} !important; }
            ` : ''}
            
            ${pageBgDark ? `
                html.dark body, html.dark #root, html.dark .bg-black, html.dark .bg-zinc-950 { background-color: ${pageBgDark} !important; }
            ` : ''}

            ${cardBgLight ? `
                html:not(.dark) .bg-white { background-color: ${cardBgLight} !important; }
            ` : ''}
            
            ${cardBgDark ? `
                html.dark .bg-zinc-900, html.dark .bg-zinc-800 { background-color: ${cardBgDark} !important; }
            ` : ''}
        `}</style>
    );
};
