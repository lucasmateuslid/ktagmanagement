import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Truck, Package, CheckCircle2, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';

interface TrackingEvent {
  date: string;
  time: string;
  location: string;
  status: string;
  description: string;
}

interface ShipmentTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackingCode: string;
  isLoading: boolean;
  error: string | null;
  trackingData: any;
}

export const ShipmentTrackingModal: React.FC<ShipmentTrackingModalProps> = ({
  isOpen,
  onClose,
  trackingCode,
  isLoading,
  error,
  trackingData
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
          onClick={onClose} 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 20 }} 
          className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500">
                <Truck size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">Rastreamento</h2>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest font-mono">{trackingCode}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 size={48} className="text-primary-500 animate-spin mb-4" />
                <p className="text-zinc-500 font-medium animate-pulse">Buscando informações de rastreio...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-500 mb-4">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Erro ao buscar rastreio</h3>
                <p className="text-zinc-500 max-w-md">{error}</p>
              </div>
            ) : trackingData && trackingData.events && trackingData.events.length > 0 ? (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-200 dark:before:via-zinc-800 before:to-transparent">
                {trackingData.events.map((event: TrackingEvent, index: number) => (
                  <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-[.is-active]:bg-primary-500 group-[.is-active]:text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                      {index === 0 ? <CheckCircle2 size={18} /> : <Package size={18} />}
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <span className="text-sm font-bold text-zinc-900 dark:text-white">{event.status}</span>
                        <span className="text-xs font-mono text-zinc-500 bg-zinc-200/50 dark:bg-zinc-900/50 px-2 py-1 rounded-md self-start sm:self-auto">
                          {event.date} {event.time}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{event.description}</p>
                      <div className="flex items-center gap-1 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        <Truck size={12} />
                        {event.location}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-4">
                  <Package size={32} />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Nenhuma informação encontrada</h3>
                <p className="text-zinc-500">Ainda não há eventos de rastreio para este código ou o código é inválido.</p>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-center shrink-0">
             <a href="https://www.siterastreio.com.br/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary-500 hover:text-primary-600 transition-colors">
                Rastreamento via SiteRastreio <ExternalLink size={14} />
             </a>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
