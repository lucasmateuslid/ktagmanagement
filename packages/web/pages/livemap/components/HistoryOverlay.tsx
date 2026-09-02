
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowLeft, FileText, FileSpreadsheet, CalendarDays, Navigation, BatteryCharging, Signal, MapPinned, Play, Pause } from 'lucide-react';
import { LocationHistory, Vehicle, Tag } from '../../../types';

const MotionDiv = motion.div as any;

interface HistoryOverlayProps {
    isVisible: boolean;
    onClose: () => void;
    activeVehicle?: Vehicle;
    activeTag?: Tag;
    historyItems: LocationHistory[];
    historyLoading: boolean;
    resolvedAddresses: Record<string, string>;
    exporting: boolean;
    exportProgress: number;
    onExport: (type: 'pdf' | 'excel') => void;
    hasMore: boolean;
    onLoadMore: () => void;
    partial: boolean;
    warnings: string[];
    onResolveAddress: (item: LocationHistory) => void;
    onViewPoint: (item: LocationHistory) => void;
    replayIndex: number;
    replayPlaying: boolean;
    replaySpeed: 1 | 2 | 4;
    replayPoint: LocationHistory | null;
    onReplayToggle: () => void;
    onReplaySeek: (index: number) => void;
    onReplaySpeedChange: (speed: 1 | 2 | 4) => void;
}

export const HistoryOverlay: React.FC<HistoryOverlayProps> = ({ 
    isVisible, onClose, activeVehicle, activeTag, 
    historyItems, historyLoading, resolvedAddresses, 
    exporting, exportProgress, onExport,
    hasMore, onLoadMore, partial, warnings, onResolveAddress, onViewPoint,
    replayIndex, replayPlaying, replaySpeed, replayPoint, onReplayToggle, onReplaySeek, onReplaySpeedChange,
}) => {
    return (
        <AnimatePresence>
            {isVisible && (
               <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[2000] pointer-events-none flex items-center justify-end">
                  <MotionDiv initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                    className="w-full md:w-[480px] h-full bg-white dark:bg-zinc-900 shadow-2xl flex flex-col overflow-hidden relative pointer-events-auto"
                  >
                    {/* OVERLAY DE EXPORTAÇÃO */}
                    <AnimatePresence>
                        {exporting && (
                            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[2010] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center text-white">
                                <Loader2 size={48} className="animate-spin text-primary-500 mb-6" />
                                <h3 className="text-xl font-display font-black uppercase tracking-tight mb-2">Processando Trajeto</h3>
                                <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-8">Resolvendo endereços completos...</p>
                                
                                <div className="w-full max-w-[200px] h-2 bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${exportProgress}%` }} />
                                </div>
                                <span className="mt-4 text-sm font-mono font-bold text-primary-500">{exportProgress}%</span>
                            </MotionDiv>
                        )}
                    </AnimatePresence>
    
                    <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                        <div className="flex justify-between items-start mb-8">
                            <button onClick={onClose} className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-zinc-500 hover:text-primary-500 transition-all shadow-sm"><ArrowLeft size={24}/></button>
                            <div className="flex gap-2">
                                <button onClick={() => onExport('pdf')} disabled={exporting} title="PDF Completo" className="p-4 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"><FileText size={22}/></button>
                                <button onClick={() => onExport('excel')} disabled={exporting} title="Excel Completo" className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-50"><FileSpreadsheet size={22}/></button>
                            </div>
                        </div>
                        <div>
                            <h2 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter">Linha do Tempo</h2>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-sm font-black text-primary-500 uppercase tracking-widest">{activeVehicle ? activeVehicle.plate : (activeTag?.name || 'TAG')}</span>
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700"/>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Últimas 48 horas</span>
                            </div>
                        </div>
                    </div>
    
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                        {partial && <div className="rounded-xl bg-amber-500/10 text-amber-600 p-3 text-xs font-bold">Histórico parcial. {warnings.join(' ')}</div>}
                        {historyLoading && historyItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center gap-5 opacity-50">
                                <Loader2 className="animate-spin text-primary-500" size={40} />
                                <span className="text-[11px] font-black uppercase tracking-[0.3em]">Consolidando Trajeto...</span>
                            </div>
                        ) : historyItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center gap-5 opacity-20">
                                <CalendarDays size={64} />
                                <span className="text-[11px] font-black uppercase">Nenhum ponto registrado no período</span>
                            </div>
                        ) : (
                            <>{historyItems.map((item, idx) => (
                                <div key={item.id} className="relative flex gap-8 group">
                                    {idx !== historyItems.length - 1 && <div className="absolute w-[2px] bg-zinc-300 dark:bg-zinc-700 z-0" style={{ left: '19px', top: '40px', bottom: '-24px' }} />}
                                    <div className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center relative z-10 border-2 transition-all ${idx === 0 ? 'bg-primary-500 border-primary-400 text-black shadow-2xl' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-300'}`}>
                                        {idx === 0 ? <Navigation size={18} className="fill-current"/> : <div className="w-2 h-2 rounded-full bg-current"/>}
                                    </div>
                                    <div className="flex-1 pb-10">
                                        <div className="flex justify-between items-start mb-1.5">
                                            <div>
                                                <span className="text-[12px] font-black text-zinc-900 dark:text-white uppercase font-mono tracking-tight block">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{new Date(item.timestamp).toLocaleDateString()}</span>
                                            </div>
                                            {/* History Battery (Small) */}
                                            {item.battery && item.battery.level > 0 && (
                                                <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                                                    <BatteryCharging size={10} style={{ color: item.battery.color }} />
                                                    <span className="text-[8px] font-black" style={{ color: item.battery.color }}>{item.battery.level}%</span>
                                                </div>
                                            )}
                                        </div>
                                        <p className={`text-[14px] font-bold leading-tight transition-colors ${item.address || resolvedAddresses[`${item.lat.toFixed(4)},${item.lon.toFixed(4)}`] ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-400 dark:text-zinc-600 font-medium'}`}>
                                            {item.address || resolvedAddresses[`${item.lat.toFixed(4)},${item.lon.toFixed(4)}`] || `Referência: ${item.lat.toFixed(4)}, ${item.lon.toFixed(4)}`}
                                        </p>
                                        <div className="mt-3 flex items-center gap-4">
                                            <div className="flex items-center gap-1.5 text-[9px] font-black text-zinc-400 uppercase tracking-widest"><Signal size={12}/> Sinal 100%</div>
                                            {!item.address && !resolvedAddresses[`${item.lat.toFixed(4)},${item.lon.toFixed(4)}`] && <button onClick={() => onResolveAddress(item)} className="text-[9px] font-black text-cyan-600 uppercase tracking-widest hover:underline">Buscar endereço</button>}
                                            <button onClick={() => onViewPoint(item)} className="text-[9px] font-black text-primary-500 uppercase tracking-widest flex items-center gap-1.5 hover:underline"><MapPinned size={12}/> Ver no Mapa</button>
                                        </div>
                                    </div>
                                </div>
                            ))}{hasMore && <button onClick={onLoadMore} disabled={historyLoading} className="w-full py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-black uppercase text-zinc-500 disabled:opacity-50">{historyLoading ? 'Carregando...' : 'Carregar mais'}</button>}</>
                        )}
                    </div>
    
                    <div className="px-6 py-4 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                            <button type="button" onClick={onReplayToggle} disabled={historyItems.length < 2} aria-label={replayPlaying ? 'Pausar replay' : 'Iniciar replay'} className="w-11 h-11 shrink-0 rounded-2xl bg-cyan-600 text-white flex items-center justify-center disabled:opacity-40">
                                {replayPlaying ? <Pause size={18} className="fill-current"/> : <Play size={18} className="fill-current"/>}
                            </button>
                            <div className="min-w-0 flex-1">
                                <div className="flex justify-between mb-2 text-[9px] font-black uppercase tracking-wider text-zinc-400">
                                    <span>Replay do trajeto</span>
                                    <span>{replayPoint ? new Date(replayPoint.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}</span>
                                </div>
                                <input type="range" min={0} max={Math.max(0, historyItems.length - 1)} value={Math.min(replayIndex, Math.max(0, historyItems.length - 1))} onChange={event => onReplaySeek(Number(event.target.value))} disabled={historyItems.length < 2} className="w-full accent-cyan-600" aria-label="Posição do replay"/>
                            </div>
                            <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1">
                                {([1, 2, 4] as const).map(speed => <button key={speed} type="button" onClick={() => onReplaySpeedChange(speed)} className={`px-2 py-1.5 rounded-lg text-[9px] font-black ${replaySpeed === speed ? 'bg-white dark:bg-zinc-700 text-cyan-600 shadow-sm' : 'text-zinc-400'}`}>{speed}x</button>)}
                            </div>
                        </div>
                    </div>
                    <div className="px-8 py-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-400 text-center uppercase tracking-[0.2em] leading-relaxed">
                            Sistema K-TAG Intelligence • Relatório de Fluxo Operacional
                        </p>
                    </div>
                  </MotionDiv>
               </MotionDiv>
            )}
        </AnimatePresence>
    );
};
