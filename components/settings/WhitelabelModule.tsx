import React, { useRef, useState } from 'react';
import { AppSettings } from '../../types';
import {
  Palette, Upload, Image as ImageIcon, Trash2, Link as LinkIcon,
  Sun, Moon, AlertTriangle
} from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { readImageAsBase64, MAX_BASE64_BYTES, MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES as ACCEPTED_TYPES } from '../../lib/imageUpload';

interface Props {
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  isAdmin: boolean;
  embedded?: boolean;
}

const LogoUploader: React.FC<{
  label: string;
  variant: 'light' | 'dark';
  urlValue?: string;
  base64Value?: string;
  onUrlChange: (v: string) => void;
  onBase64Change: (v: string | undefined) => void;
  isAdmin: boolean;
}> = ({ label, variant, urlValue, base64Value, onUrlChange, onBase64Change, isAdmin }) => {
  const { addNotification } = useNotification();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const activeSrc = base64Value || urlValue;
  const previewBg = variant === 'dark' ? 'bg-zinc-900' : 'bg-zinc-50';
  const previewBorder = variant === 'dark' ? 'border-zinc-800' : 'border-zinc-200';

  const handleFile = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      addNotification('error', 'Arquivo inválido', 'Use PNG, JPG, SVG ou WebP.');
      return;
    }
    // Hard cap: bloqueia upload >2MB pra evitar OOM/DoS no FileReader+canvas.
    // Raster acima disso passa por resize, mas SVG entra cru — não vale o risco.
    if (file.size > MAX_UPLOAD_BYTES) {
      addNotification('error', 'Arquivo muito grande', 'Tamanho máximo: 2MB. Reduza a imagem antes de enviar.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      const base64 = await readImageAsBase64(file);
      if (base64.length > MAX_BASE64_BYTES) {
        addNotification('error', 'Imagem muito pesada', 'Mesmo após otimização ficou acima de 360KB. Use uma imagem menor.');
        return;
      }
      onBase64Change(base64);
      addNotification('success', 'Logo carregada', 'Salve as configurações para aplicar.');
    } catch (e: any) {
      addNotification('error', 'Erro', e?.message || 'Falha ao processar imagem.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-2">
          {variant === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
          {label}
        </label>
        {base64Value && isAdmin && (
          <button
            type="button"
            onClick={() => onBase64Change(undefined)}
            className="text-[9px] font-black uppercase text-red-500 tracking-wider hover:underline flex items-center gap-1"
          >
            <Trash2 size={10} /> Remover upload
          </button>
        )}
      </div>

      {/* Preview */}
      <div className={`flex items-center justify-center h-24 rounded-2xl border-2 border-dashed ${previewBorder} ${previewBg} overflow-hidden`}>
        {activeSrc ? (
          <img src={activeSrc} alt="Preview" className="max-h-20 max-w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-zinc-400">
            <ImageIcon size={20} />
            <span className="text-[9px] font-bold uppercase tracking-widest">Sem logo</span>
          </div>
        )}
      </div>

      {/* Upload */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!isAdmin || uploading}
          onClick={() => inputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-50"
        >
          <Upload size={14} />
          {uploading ? 'Processando...' : (base64Value ? 'Trocar Arquivo' : 'Enviar PNG / SVG')}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {/* Fallback URL */}
      <div className="space-y-1">
        <label className="text-[9px] font-bold uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
          <LinkIcon size={10} /> Ou URL externa (fallback)
        </label>
        <input
          type="text"
          disabled={!isAdmin}
          value={urlValue || ''}
          onChange={e => onUrlChange(e.target.value)}
          className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono text-[11px] outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
          placeholder={`https://exemplo.com/logo-${variant}.svg`}
        />
        {base64Value && urlValue && (
          <p className="text-[9px] text-amber-500 font-bold uppercase mt-1 flex items-center gap-1">
            <AlertTriangle size={10} /> Upload tem prioridade sobre URL
          </p>
        )}
      </div>
    </div>
  );
};

const ColorField: React.FC<{
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}> = ({ label, hint, value, onChange, disabled }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">{label}</label>
    <div className="flex gap-2 items-center">
      <input type="color" disabled={disabled} value={value} onChange={e => onChange(e.target.value)} className="w-14 h-12 rounded-lg cursor-pointer disabled:opacity-50 shrink-0 border-0" />
      <input type="text" disabled={disabled} value={value} onChange={e => onChange(e.target.value)} className="flex-1 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono text-[10px] outline-none focus:border-indigo-500 disabled:opacity-50 uppercase" />
    </div>
    {hint && <p className="text-[9px] text-zinc-400 ml-1">{hint}</p>}
  </div>
);

export const WhitelabelModule: React.FC<Props> = ({ settings, setSettings, isAdmin, embedded = false }) => {
  const updateTheme = (field: keyof NonNullable<AppSettings['themeColors']>, value: string) => {
    setSettings({
      ...settings,
      themeColors: {
        ...(settings.themeColors || {}),
        [field]: value
      }
    });
  };

  const colors = settings.themeColors || {};
  const primary = colors.primaryColor || '#f59e0b';

  const body = (
    <div className="space-y-8">

      {/* IDENTIDADE */}
      <section className="space-y-6">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">Identidade</h3>
          <p className="text-[11px] text-zinc-500 mt-1">Nome do sistema e logos exibidos no header, login e tela inicial.</p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Nome do Sistema</label>
          <input
            type="text"
            disabled={!isAdmin}
            value={settings.customAppName || ''}
            onChange={e => setSettings({ ...settings, customAppName: e.target.value })}
            className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
            placeholder="Ex: Manager PRO"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <LogoUploader
            label="Logo (Modo Claro)"
            variant="light"
            urlValue={settings.customLogoUrlLight}
            base64Value={settings.customLogoBase64Light}
            onUrlChange={v => setSettings({ ...settings, customLogoUrlLight: v })}
            onBase64Change={v => setSettings({ ...settings, customLogoBase64Light: v })}
            isAdmin={isAdmin}
          />
          <LogoUploader
            label="Logo (Modo Escuro)"
            variant="dark"
            urlValue={settings.customLogoUrlDark}
            base64Value={settings.customLogoBase64Dark}
            onUrlChange={v => setSettings({ ...settings, customLogoUrlDark: v })}
            onBase64Change={v => setSettings({ ...settings, customLogoBase64Dark: v })}
            isAdmin={isAdmin}
          />
        </div>
      </section>

      {/* PALETA */}
      <section className="space-y-6 border-t border-zinc-100 dark:border-zinc-800 pt-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">Paleta de Cores</h3>
            <p className="text-[11px] text-zinc-500 mt-1">Aplica-se em botões, títulos, cards e fundo — modo claro e escuro.</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setSettings({ ...settings, themeColors: undefined })}
              className="text-[10px] font-black uppercase text-red-500 tracking-widest hover:underline"
            >
              Restaurar Padrão
            </button>
          )}
        </div>

        {/* Preview ao vivo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="bg-zinc-50 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-500 border-b border-zinc-200">Preview — Claro</div>
            <div className="p-4 flex items-center gap-3" style={{ backgroundColor: colors.pageBgLight || '#f4f4f5' }}>
              <div className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: primary, color: colors.buttonTextColor || '#ffffff' }}>
                Botão
              </div>
              <div className="flex-1 px-3 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: colors.cardBgLight || '#ffffff', color: colors.titleColorLight || '#18181b' }}>
                Título do card
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="bg-zinc-900 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-800">Preview — Escuro</div>
            <div className="p-4 flex items-center gap-3" style={{ backgroundColor: colors.pageBgDark || '#09090b' }}>
              <div className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: primary, color: colors.buttonTextColor || '#ffffff' }}>
                Botão
              </div>
              <div className="flex-1 px-3 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: colors.cardBgDark || '#18181b', color: colors.titleColorDark || '#ffffff' }}>
                Título do card
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ColorField label="Cor Primária" hint="Botões e acentos" value={primary} onChange={v => updateTheme('primaryColor', v)} disabled={!isAdmin} />
          <ColorField label="Texto de Botões" hint="Contraste com primária" value={colors.buttonTextColor || '#ffffff'} onChange={v => updateTheme('buttonTextColor', v)} disabled={!isAdmin} />
          <ColorField label="Títulos (Claro)" value={colors.titleColorLight || '#18181b'} onChange={v => updateTheme('titleColorLight', v)} disabled={!isAdmin} />
          <ColorField label="Títulos (Escuro)" value={colors.titleColorDark || '#ffffff'} onChange={v => updateTheme('titleColorDark', v)} disabled={!isAdmin} />
          <ColorField label="Cards (Claro)" value={colors.cardBgLight || '#ffffff'} onChange={v => updateTheme('cardBgLight', v)} disabled={!isAdmin} />
          <ColorField label="Cards (Escuro)" value={colors.cardBgDark || '#18181b'} onChange={v => updateTheme('cardBgDark', v)} disabled={!isAdmin} />
          <ColorField label="Fundo (Claro)" value={colors.pageBgLight || '#f4f4f5'} onChange={v => updateTheme('pageBgLight', v)} disabled={!isAdmin} />
          <ColorField label="Fundo (Escuro)" value={colors.pageBgDark || '#09090b'} onChange={v => updateTheme('pageBgDark', v)} disabled={!isAdmin} />
        </div>

        <div className="space-y-2 pt-2">
          <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Cores de Gráficos (separadas por vírgula)</label>
          <input
            type="text"
            disabled={!isAdmin}
            value={colors.chartColors || '#6366f1, #3b82f6, #10b981, #f59e0b, #ef4444'}
            onChange={e => updateTheme('chartColors', e.target.value)}
            className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-xs outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
            placeholder="#6366f1, #3b82f6..."
          />
        </div>
      </section>
    </div>
  );

  if (embedded) return body;

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm">
      <div className="flex items-center gap-3 text-indigo-500 border-b border-zinc-100 dark:border-zinc-800 pb-6 mb-8">
        <Palette size={24} />
        <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-tight">Whitelabel & Temas</h2>
      </div>
      {body}
    </div>
  );
};
