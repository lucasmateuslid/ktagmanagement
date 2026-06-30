import React, { useState } from 'react';
import { X, Share2, Copy, CheckCircle2 } from 'lucide-react';
import { Vehicle } from '../../../types';
import { storage } from '../../../services/storage';

interface ShareLinkModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
}

export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({ vehicle, onClose }) => {
  const [duration, setDuration] = useState<number>(24 * 60 * 60 * 1000); // Default 1 day
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!vehicle) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const linkId = Math.random().toString(36).substring(2, 15);
      
      const shareLink = {
        id: linkId,
        vehicleId: vehicle.id,
        vehiclePlate: vehicle.plate,
        vehicleModel: vehicle.model,
        token,
        createdAt: Date.now(),
        expiresAt: Date.now() + duration,
        createdBy: 'user', // Can be populated with real user if available
      };

      await storage.createSharedLink(shareLink);
      
      const url = `${window.location.origin}/track/${token}`;
      setGeneratedUrl(url);
    } catch (error) {
      console.error('Error creating link', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedUrl) {
      navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[32px] md:rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="px-6 py-6 md:px-8 md:py-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center">
              <Share2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Compartilhar</h2>
              <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mt-1">Acesso Temporário • {vehicle.plate}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
          {!generatedUrl ? (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Duração do Acesso</label>
                <select 
                  value={duration} 
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full h-14 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 font-bold text-sm text-zinc-900 dark:text-white outline-none focus:border-blue-500"
                >
                  <option value={30 * 60 * 1000}>30 Minutos</option>
                  <option value={60 * 60 * 1000}>1 Hora</option>
                  <option value={4 * 60 * 60 * 1000}>4 Horas</option>
                  <option value={12 * 60 * 60 * 1000}>12 Horas</option>
                  <option value={24 * 60 * 60 * 1000}>24 Horas</option>
                  <option value={2 * 24 * 60 * 60 * 1000}>2 Dias</option>
                  <option value={7 * 24 * 60 * 60 * 1000}>7 Dias</option>
                </select>
              </div>

              <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl p-4">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium leading-relaxed">
                  Ao gerar este link, qualquer pessoa com o link poderá ver a localização do veículo <strong>{vehicle.plate}</strong> até o momento da expiração.
                </p>
              </div>

              <button 
                onClick={handleGenerate}
                disabled={loading}
                className="w-full h-14 bg-blue-500 hover:bg-blue-600 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? 'Gerando...' : 'Gerar Link Seguro'}
              </button>
            </>
          ) : (
            <div className="space-y-6">
              <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">Link Gerado!</h3>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1">Expira em {new Date(Date.now() + duration).toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Link de Compartilhamento</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={generatedUrl} 
                    className="flex-1 h-14 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 font-bold text-sm text-zinc-900 dark:text-white outline-none"
                  />
                  <button 
                    onClick={handleCopy}
                    className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-colors ${copied ? 'bg-emerald-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                  >
                    {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                  </button>
                </div>
              </div>

              <button 
                onClick={onClose}
                className="w-full h-14 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-colors"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
