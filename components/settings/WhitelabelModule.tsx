import React from 'react';
import { AppSettings } from '../../types';
import { Palette, Upload, Image as ImageIcon } from 'lucide-react';

interface Props {
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  isAdmin: boolean;
}

export const WhitelabelModule: React.FC<Props> = ({ settings, setSettings, isAdmin }) => {
  const updateTheme = (field: keyof NonNullable<AppSettings['themeColors']>, value: string) => {
    setSettings({
      ...settings,
      themeColors: {
        ...(settings.themeColors || {}),
        [field]: value
      }
    });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
      <div className="flex items-center gap-3 text-indigo-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
        <Palette size={24} />
        <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-tight">Whitelabel & Temas</h2>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Nome do Sistema</label>
            <input 
              type="text" 
              disabled={!isAdmin}
              value={settings.customAppName || ''} 
              onChange={e => setSettings({...settings, customAppName: e.target.value})} 
              className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 transition-colors disabled:opacity-50" 
              placeholder="Ex: Manager PRO"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">CNPJ da Empresa</label>
            <input 
              type="text" 
              disabled={!isAdmin}
              value={settings.companyCnpj || ''} 
              onChange={e => setSettings({...settings, companyCnpj: e.target.value})} 
              className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 transition-colors disabled:opacity-50" 
              placeholder="Ex: 00.000.000/0001-00"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">URL da Logo (Modo Claro)</label>
              <div className="flex gap-2">
                  <div className="relative flex-1">
                      <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                      <input 
                        type="text" 
                        disabled={!isAdmin}
                        value={settings.customLogoUrlLight || ''} 
                        onChange={e => setSettings({...settings, customLogoUrlLight: e.target.value})} 
                        className="w-full pl-12 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 transition-colors disabled:opacity-50" 
                        placeholder="https://exemplo.com/logo-light.svg"
                      />
                  </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">URL da Logo (Modo Escuro)</label>
              <div className="flex gap-2">
                  <div className="relative flex-1">
                      <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                      <input 
                        type="text" 
                        disabled={!isAdmin}
                        value={settings.customLogoUrlDark || ''} 
                        onChange={e => setSettings({...settings, customLogoUrlDark: e.target.value})} 
                        className="w-full pl-12 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 transition-colors disabled:opacity-50" 
                        placeholder="https://exemplo.com/logo-dark.svg"
                      />
                  </div>
              </div>
            </div>
        </div>

        <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-200 mb-4">Cores do Sistema</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Cor Primária (Botões, etc)</label>
                    <input type="color" disabled={!isAdmin} value={settings.themeColors?.primaryColor || '#6366f1'} onChange={e => updateTheme('primaryColor', e.target.value)} className="w-full h-12 rounded cursor-pointer disabled:opacity-50" />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Texto de Botões</label>
                    <input type="color" disabled={!isAdmin} value={settings.themeColors?.buttonTextColor || '#ffffff'} onChange={e => updateTheme('buttonTextColor', e.target.value)} className="w-full h-12 rounded cursor-pointer disabled:opacity-50" />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Títulos (Claro)</label>
                    <input type="color" disabled={!isAdmin} value={settings.themeColors?.titleColorLight || '#18181b'} onChange={e => updateTheme('titleColorLight', e.target.value)} className="w-full h-12 rounded cursor-pointer disabled:opacity-50" />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Títulos (Escuro)</label>
                    <input type="color" disabled={!isAdmin} value={settings.themeColors?.titleColorDark || '#ffffff'} onChange={e => updateTheme('titleColorDark', e.target.value)} className="w-full h-12 rounded cursor-pointer disabled:opacity-50" />
                </div>
                
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Cards (Claro)</label>
                    <input type="color" disabled={!isAdmin} value={settings.themeColors?.cardBgLight || '#ffffff'} onChange={e => updateTheme('cardBgLight', e.target.value)} className="w-full h-12 rounded cursor-pointer disabled:opacity-50" />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Cards (Escuro)</label>
                    <input type="color" disabled={!isAdmin} value={settings.themeColors?.cardBgDark || '#18181b'} onChange={e => updateTheme('cardBgDark', e.target.value)} className="w-full h-12 rounded cursor-pointer disabled:opacity-50" />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Fundo (Claro)</label>
                    <input type="color" disabled={!isAdmin} value={settings.themeColors?.pageBgLight || '#f4f4f5'} onChange={e => updateTheme('pageBgLight', e.target.value)} className="w-full h-12 rounded cursor-pointer disabled:opacity-50" />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Fundo (Escuro)</label>
                    <input type="color" disabled={!isAdmin} value={settings.themeColors?.pageBgDark || '#09090b'} onChange={e => updateTheme('pageBgDark', e.target.value)} className="w-full h-12 rounded cursor-pointer disabled:opacity-50" />
                </div>
            </div>
            
            <div className="mt-4 space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Cores de Gráficos (Separadas por vírgula)</label>
                <input 
                    type="text" 
                    disabled={!isAdmin}
                    value={settings.themeColors?.chartColors || '#6366f1, #3b82f6, #10b981, #f59e0b, #ef4444'} 
                    onChange={e => updateTheme('chartColors', e.target.value)} 
                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 transition-colors disabled:opacity-50" 
                    placeholder="#6366f1, #3b82f6..."
                />
            </div>
            <div className="mt-4 flex items-center justify-end">
                 <button onClick={() => setSettings({...settings, themeColors: undefined})} className="text-[10px] font-black uppercase text-red-500 tracking-wider hover:underline">Restaurar Cores Padrões</button>
            </div>
        </div>

      </div>
    </div>
  );
};
