
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronDown, ChevronUp, User, Tag as TagIcon, 
    BatteryCharging, MapPin, Navigation, History, X, Box, Clock
} from 'lucide-react';
import { FaMotorcycle, FaTruck, FaCar } from 'react-icons/fa';
import { Vehicle, Tag, VehicleCategory, Client, LocationHistory } from '../../../types';

const MotionDiv = motion.div as any;

interface DetailsSheetProps {
    selectedTagId: string;
    isExpanded: boolean;
    toggleExpanded: () => void;
    vehicle?: Vehicle;
    tag?: Tag;
    category?: VehicleCategory;
    client?: Client;
    lastLoc?: LocationHistory;
    resolvedAddress?: string;
    userRole?: string;
    onFetchHistory: () => void;
    onClose: () => void;
}

export const DetailsSheet: React.FC<DetailsSheetProps> = ({
    selectedTagId, isExpanded, toggleExpanded, vehicle, tag, category, client, lastLoc, resolvedAddress, userRole, onFetchHistory, onClose
}) => {
    const getModalIcon = (fipeType?: string) => {
        switch (fipeType) {
            case 'motos': return <FaMotorcycle size={24} className="md:w-[28px] md:h-[28px]" />;
            case 'caminhoes': return <FaTruck size={24} className="md:w-[28px] md:h-[28px]" />;
            default: return <FaCar size={24} className="md:w-[28px] md:h-[28px]" />;
        }
    };

    return (
        <AnimatePresence>
            {selectedTagId && (
              <MotionDiv initial={{ y: '100%' }} animate={{ y: isExpanded ? 0 : 'calc(100% - 90px)' }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 180 }}
                // Aumentado z-index para 3000 (acima do Nav que é 2000)
                className="fixed md:absolute bottom-0 left-0 right-0 z-[3000] bg-white dark:bg-zinc-900 rounded-t-[32px] md:rounded-t-[40px] shadow-[0_-20px_60px_rgba(0,0,0,0.3)] border-t border-zinc-100 dark:border-zinc-800 flex flex-col md:left-auto md:right-6 md:bottom-6 md:w-[420px] md:rounded-[40px] overflow-hidden max-h-[90vh] md:max-h-none"
              >
                <div className="h-[90px] md:h-[100px] px-6 md:px-8 flex items-center justify-between cursor-pointer group" onClick={toggleExpanded}>
                  <div className="flex items-center gap-4 md:gap-5">
                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shadow-xl transition-all ${lastLoc ? 'bg-primary-500 text-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                      {vehicle ? getModalIcon(category?.fipeType) : <Box size={24} className="md:w-[28px] md:h-[28px]"/>}
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-display font-black text-zinc-900 dark:text-white uppercase leading-none tracking-tighter">
                          {vehicle ? vehicle.plate : (tag?.name || 'Tag Desconhecida')}
                      </h2>
                      <div className="flex items-center gap-1.5 mt-1 md:mt-1.5">
                          <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${lastLoc ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                          <span className="text-[8px] md:text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                              {lastLoc ? 'Sinal Ativo Online' : 'Sem Resposta (Offline)'}
                          </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-primary-500 transition-colors">
                    {isExpanded ? <ChevronDown size={20} className="md:w-[22px] md:h-[22px]" /> : <ChevronUp size={20} className="md:w-[22px] md:h-[22px]" />}
                  </div>
                </div>

                <div className="px-6 md:px-8 pb-8 md:pb-10 space-y-5 md:space-y-6 overflow-y-auto custom-scrollbar border-t border-zinc-50 dark:border-zinc-800/50 pt-6 md:pt-8">
                    
                    {/* Exibição do Cliente Responsável */}
                    {vehicle && client && userRole !== 'client' && (
                        <div className="flex items-center gap-3 p-3 md:p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-[20px] border border-zinc-100 dark:border-zinc-800">
                            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shadow-sm shrink-0">
                                <User size={16} className="md:w-[18px] md:h-[18px]" />
                            </div>
                            <div className="overflow-hidden">
                                <span className="text-[8px] md:text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-0.5">Cliente Responsável</span>
                                <span className="text-xs font-bold text-zinc-900 dark:text-white uppercase truncate block">{client.name}</span>
                            </div>
                        </div>
                    )}

                    {!vehicle && tag && (
                        <div className="p-3 md:p-4 bg-amber-500/10 border border-amber-500/20 rounded-[20px] flex gap-3 items-center">
                            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-amber-500 text-black flex items-center justify-center shadow-sm shrink-0 font-bold"><TagIcon size={16} className="md:w-[18px] md:h-[18px]"/></div>
                            <div>
                                <span className="text-[8px] md:text-[9px] font-black text-amber-600 uppercase tracking-widest block">Modo Estoque</span>
                                <span className="text-xs font-bold text-zinc-900 dark:text-white">Serial: {tag.accessoryId}</span>
                            </div>
                        </div>
                    )}

                    {/* Battery Status */}
                    {lastLoc && lastLoc.battery && (
                        <div className="flex items-center justify-between p-3 md:p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-[20px] border border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm shrink-0" style={{ color: lastLoc.battery.color }}>
                                    <BatteryCharging size={18} className="md:w-[20px] md:h-[20px]" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[8px] md:text-[9px] font-black uppercase text-zinc-400 tracking-widest">Nível de Bateria</span>
                                    <span className="text-xs font-bold uppercase" style={{ color: lastLoc.battery.color }}>
                                        {lastLoc.battery.label} ({lastLoc.battery.level}%)
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-zinc-50 dark:bg-zinc-950/60 p-5 md:p-6 rounded-2xl md:rounded-[32px] border border-zinc-100 dark:border-zinc-800/50 relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2 text-primary-500">
                                <MapPin size={14} className="md:w-[16px] md:h-[16px]" />
                                <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">Endereço de Localização</span>
                            </div>
                            {lastLoc && (
                                <div className="flex items-center gap-1 px-1.5 py-0.5 md:px-2 md:py-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg border border-zinc-300 dark:border-zinc-700">
                                    <Clock size={8} className="md:w-[10px] md:h-[10px] text-zinc-400"/>
                                    <span className="text-[8px] md:text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-300">
                                        {new Date(lastLoc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            )}
                        </div>
                        <p className="text-[13px] md:text-[14px] font-bold text-zinc-900 dark:text-zinc-100 leading-relaxed pr-8">
                            {lastLoc ? (resolvedAddress || 'Resolvendo endereço...') : 'Coordenadas não disponíveis no momento.'}
                        </p>
                        <div className="absolute top-0 right-0 w-20 h-20 -mt-8 -mr-8 bg-primary-500/5 rounded-full" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <button onClick={() => lastLoc && window.open(`https://www.google.com/maps/dir/?api=1&destination=${lastLoc.lat},${lastLoc.lon}`)} className="h-14 md:h-16 bg-zinc-950 dark:bg-zinc-800 text-white rounded-xl md:rounded-[24px] flex items-center justify-center gap-2 md:gap-3 font-black text-[10px] md:text-[11px] uppercase tracking-widest shadow-xl transition-all active:scale-95 border border-zinc-800">
                            <Navigation size={18} className="md:w-[22px] md:h-[22px]"/> Rota
                        </button>
                        <button onClick={onFetchHistory} className="h-14 md:h-16 bg-primary-500 text-black rounded-xl md:rounded-[24px] flex items-center justify-center gap-2 md:gap-3 font-black text-[10px] md:text-[11px] uppercase tracking-widest shadow-xl transition-all active:scale-95">
                            <History size={18} className="md:w-[22px] md:h-[22px]"/> Histórico
                        </button>
                    </div>

                    <button onClick={onClose} className="w-full py-2 text-[9px] md:text-[10px] font-black text-zinc-300 hover:text-red-500 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 opacity-60 hover:opacity-100">
                        <X size={14} className="md:w-[16px] md:h-[16px]" /> Fechar Detalhes
                    </button>
                </div>
              </MotionDiv>
            )}
        </AnimatePresence>
    );
};
