import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Truck, Package, CheckCircle2, AlertTriangle, ExternalLink, Loader2, Calendar } from 'lucide-react';

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

  // Helper to format the date/time from the API response
  const formatEvent = (event: any): TrackingEvent => {
    const dtHr = event.dtHrCriado?.date || '';
    const [date, time] = dtHr.split(' ');
    
    let locationStr = '';
    if (event.unidade?.tipo && event.unidade?.endereco?.cidade && event.unidade?.endereco?.uf) {
      locationStr = `de ${event.unidade.tipo}, ${event.unidade.endereco.cidade} - ${event.unidade.endereco.uf}`;
    } else if (event.unidade?.cidade && event.unidade?.uf) {
      locationStr = `de ${event.unidade.cidade} - ${event.unidade.uf}`;
    }

    if (event.unidadeDestino?.tipo && event.unidadeDestino?.endereco?.cidade && event.unidadeDestino?.endereco?.uf) {
      locationStr += `\npara ${event.unidadeDestino.tipo}, ${event.unidadeDestino.endereco.cidade} - ${event.unidadeDestino.endereco.uf}`;
    } else if (event.unidadeDestino?.cidade && event.unidadeDestino?.uf) {
      locationStr += `\npara ${event.unidadeDestino.cidade} - ${event.unidadeDestino.uf}`;
    }

    return {
      date: date ? date.split('-').reverse().join('/') : '',
      time: time ? time.substring(0, 5) : '',
      location: locationStr || `${event.unidade?.cidade || ''} - ${event.unidade?.uf || ''}`,
      status: event.descricao || 'Sem status',
      description: event.descricaoFrontEnd || '',
    };
  };

  const events: TrackingEvent[] = trackingData?.events 
    ? trackingData.events.map(formatEvent)
    : [];

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

          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-zinc-50 dark:bg-zinc-900">
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
            ) : events.length > 0 ? (
              <div className="space-y-8">
                {/* Timeline Header */}
                <div className="relative flex justify-between items-center mb-8 px-4">
                  <div className="absolute left-10 right-10 top-6 h-1 bg-zinc-200 dark:bg-zinc-800 -z-10">
                    <div className="h-full bg-primary-500 transition-all duration-500" style={{ width: trackingData?.status === 'entregue' ? '100%' : trackingData?.status === 'em_transito' ? '50%' : '0%' }} />
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-white dark:border-zinc-900 ${events.length > 0 ? 'bg-primary-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'}`}>
                      <Package size={20} />
                    </div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">Postado</span>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-white dark:border-zinc-900 ${events.some(e => e.status.toLowerCase().includes('transferência') || e.status.toLowerCase().includes('trânsito')) ? 'bg-primary-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'}`}>
                      <Truck size={20} />
                    </div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">Em trânsito</span>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-white dark:border-zinc-900 ${events[0]?.status.toLowerCase().includes('entregue') ? 'bg-primary-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'}`}>
                      <CheckCircle2 size={20} />
                    </div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">Entregue</span>
                  </div>
                </div>

                {trackingData?.dtPrevista && (
                  <div className="bg-primary-900/10 border border-primary-500/20 rounded-xl p-4 flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-500 shrink-0">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-primary-600/80 font-medium">Previsão de entrega</p>
                      <p className="text-sm font-bold text-primary-700 dark:text-primary-400">{trackingData.dtPrevista}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
                  {events.map((event, index) => (
                    <div key={index} className="relative flex items-start gap-6 group">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-first:bg-primary-500 group-first:text-white shrink-0 shadow-sm z-10">
                        {index === 0 ? <CheckCircle2 size={18} /> : <Package size={18} />}
                      </div>
                      <div className="flex-1 pt-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-bold text-zinc-900 dark:text-white">{event.status}</span>
                          <span className="text-xs font-mono text-zinc-500">
                            {event.date} {event.time}
                          </span>
                        </div>
                        {event.description && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{event.description}</p>
                        )}
                        {event.location && (
                          <div className="text-xs font-medium text-zinc-500 whitespace-pre-line">
                            {event.location}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-4">
                  <Package size={32} />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Nenhuma informação encontrada</h3>
                <p className="text-zinc-500">Ainda não há eventos de rastreio para este código ou o código é inválido.</p>
              </div>
            )
            }
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
