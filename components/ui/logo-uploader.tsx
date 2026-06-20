import * as React from 'react';
import { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Trash2, Sun, Moon, Loader2 } from 'lucide-react';
import { readImageAsBase64, ACCEPTED_IMAGE_TYPES, MAX_BASE64_BYTES, MAX_UPLOAD_BYTES } from '../../lib/imageUpload';

interface LogoUploaderProps {
  label: string;
  variant: 'light' | 'dark';
  value?: string;
  onChange: (base64: string | undefined) => void;
  disabled?: boolean;
}

/** Versão admin (tema escuro/amber) do uploader de logo whitelabel — mesma lógica de resize de components/settings/WhitelabelModule.tsx. */
export const LogoUploader: React.FC<LogoUploaderProps> = ({ label, variant, value, onChange, disabled }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    setError('');
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('Use PNG, JPG, SVG ou WebP.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('Tamanho máximo: 2MB.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      const base64 = await readImageAsBase64(file);
      if (base64.length > MAX_BASE64_BYTES) {
        setError('Imagem muito pesada mesmo após otimização. Use uma imagem menor.');
        return;
      }
      onChange(base64);
    } catch (e: any) {
      setError(e?.message || 'Falha ao processar imagem.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-1.5">
          {variant === 'dark' ? <Moon size={11} /> : <Sun size={11} />}
          {label}
        </label>
        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-[9px] font-black uppercase text-red-400 tracking-widest hover:underline flex items-center gap-1"
          >
            <Trash2 size={10} /> Remover
          </button>
        )}
      </div>

      <div className={`flex items-center justify-center h-20 rounded-2xl border-2 border-dashed border-white/10 ${variant === 'dark' ? 'bg-zinc-950' : 'bg-zinc-100'} overflow-hidden`}>
        {value ? (
          <img src={value} alt="Preview" className="max-h-16 max-w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-zinc-500">
            <ImageIcon size={16} />
            <span className="text-[9px] font-bold uppercase tracking-widest">Sem logo</span>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        {uploading ? 'Processando…' : (value ? 'Trocar arquivo' : 'Enviar logo')}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
};
