import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, BatteryCharging, CalendarDays, ChevronDown, ChevronUp,
    FileSpreadsheet, FileText, Loader2, MapPinned, Navigation, Pause, Play,
} from 'lucide-react';
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

const dateKey = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const dateLabel = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (dateKey(timestamp) === dateKey(today.getTime())) return 'Hoje';
    if (dateKey(timestamp) === dateKey(yesterday.getTime())) return 'Ontem';
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
};

const pointAddress = (item: LocationHistory, resolvedAddresses: Record<string, string>) => (
    item.address || resolvedAddresses[`${item.lat.toFixed(6)},${item.lon.toFixed(6)}`]
);

export const HistoryOverlay: React.FC<HistoryOverlayProps> = ({
    isVisible, onClose, activeVehicle, activeTag,
    historyItems, historyLoading, resolvedAddresses,
    exporting, exportProgress, onExport,
    hasMore, onLoadMore, partial, warnings, onResolveAddress, onViewPoint,
    replayIndex, replayPlaying, replaySpeed, replayPoint, onReplayToggle, onReplaySeek, onReplaySpeedChange,
}) => {
    const [isMobileExpanded, setIsMobileExpanded] = useState(false);

    const groups = useMemo(() => {
        const grouped: Array<{ key: string; label: string; items: Array<{ item: LocationHistory; index: number }> }> = [];
        historyItems.forEach((item, index) => {
            const key = dateKey(item.timestamp);
            let group = grouped[grouped.length - 1];
            if (!group || group.key !== key) {
                group = { key, label: dateLabel(item.timestamp), items: [] };
                grouped.push(group);
            }
            group.items.push({ item, index });
        });
        return grouped;
    }, [historyItems]);

    const oldestPoint = historyItems[historyItems.length - 1];
    const newestPoint = historyItems[0];
    const viewPoint = (item: LocationHistory) => {
        setIsMobileExpanded(false);
        onViewPoint(item);
    };
    const closePanel = () => {
        setIsMobileExpanded(false);
        onClose();
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[2100] flex items-end justify-end pointer-events-none md:items-center">
                    <MotionDiv
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 220 }}
                        className={`${isMobileExpanded ? 'h-[82dvh]' : 'h-[52dvh]'} relative flex min-h-[360px] max-h-[720px] w-full flex-col overflow-hidden rounded-t-[28px] border-t border-zinc-200 bg-white shadow-2xl pointer-events-auto dark:border-zinc-800 dark:bg-zinc-900 md:h-full md:min-h-0 md:max-h-none md:w-[480px] md:rounded-none md:border-l md:border-t-0`}
                    >
                        <AnimatePresence>
                            {exporting && (
                                <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[2010] flex flex-col items-center justify-center bg-black/80 p-8 text-center text-white backdrop-blur-sm">
                                    <Loader2 size={44} className="mb-5 animate-spin text-primary-500" />
                                    <h3 className="text-lg font-black uppercase tracking-tight">Processando trajeto</h3>
                                    <p className="mb-6 mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Resolvendo endereços completos</p>
                                    <div className="h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-zinc-800">
                                        <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${exportProgress}%` }} />
                                    </div>
                                    <span className="mt-3 font-mono text-sm font-bold text-primary-500">{exportProgress}%</span>
                                </MotionDiv>
                            )}
                        </AnimatePresence>

                        <div className="shrink-0 border-b border-zinc-100 px-4 pb-3 pt-2 dark:border-zinc-800 md:p-7">
                            <button
                                type="button"
                                onClick={() => setIsMobileExpanded(value => !value)}
                                aria-label={isMobileExpanded ? 'Mostrar mais do mapa' : 'Expandir histórico'}
                                className="mx-auto mb-2 flex h-5 w-20 items-center justify-center rounded-full text-zinc-400 md:hidden"
                            >
                                <span className="h-1 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                            </button>

                            <div className="flex items-center gap-3">
                                <button onClick={closePanel} aria-label="Fechar histórico" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 shadow-sm transition-colors hover:text-primary-500 dark:bg-zinc-800 md:h-12 md:w-12 md:rounded-2xl">
                                    <ArrowLeft size={20} />
                                </button>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h2 className="truncate text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white md:text-2xl">Histórico da rota</h2>
                                        <button type="button" onClick={() => setIsMobileExpanded(value => !value)} className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 md:hidden" aria-label={isMobileExpanded ? 'Recolher histórico' : 'Expandir histórico'}>
                                            {isMobileExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                                        </button>
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                        <span className="truncate text-primary-600 dark:text-primary-400">{activeVehicle ? activeVehicle.plate : (activeTag?.name || 'TAG')}</span>
                                        <span>•</span>
                                        <span>{historyItems.length} {historyItems.length === 1 ? 'ponto' : 'pontos'}</span>
                                        <span className="hidden sm:inline">• últimas 48 horas</span>
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-1.5">
                                    <button onClick={() => onExport('pdf')} disabled={exporting || historyItems.length === 0} title="Exportar PDF" className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500 transition-colors hover:bg-red-500 hover:text-white disabled:opacity-40 md:h-11 md:w-11"><FileText size={18} /></button>
                                    <button onClick={() => onExport('excel')} disabled={exporting || historyItems.length === 0} title="Exportar Excel" className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500 hover:text-white disabled:opacity-40 md:h-11 md:w-11"><FileSpreadsheet size={18} /></button>
                                </div>
                            </div>

                            {oldestPoint && newestPoint && (
                                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-zinc-50 p-2.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:bg-zinc-950/60 md:mt-5 md:p-3">
                                    <div><span className="block text-[8px] text-zinc-400">Início exibido</span><span className="mt-0.5 block text-zinc-700 dark:text-zinc-200">{new Date(oldestPoint.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
                                    <div><span className="block text-[8px] text-zinc-400">Última posição</span><span className="mt-0.5 block text-zinc-700 dark:text-zinc-200">{new Date(newestPoint.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
                                </div>
                            )}
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-3 md:px-7 md:py-5">
                            {partial && <div className="mb-3 rounded-xl bg-amber-500/10 p-3 text-xs font-bold text-amber-700 dark:text-amber-400">Histórico parcial. {warnings.join(' ')}</div>}
                            {historyLoading && historyItems.length === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center gap-4 text-zinc-400">
                                    <Loader2 className="animate-spin text-primary-500" size={36} />
                                    <span className="text-[10px] font-black uppercase tracking-[0.25em]">Organizando trajeto...</span>
                                </div>
                            ) : historyItems.length === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center gap-4 text-zinc-300 dark:text-zinc-700">
                                    <CalendarDays size={52} />
                                    <span className="text-center text-[10px] font-black uppercase">Nenhum ponto registrado no período</span>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {groups.map(group => (
                                        <section key={group.key}>
                                            <div className="sticky top-0 z-10 mb-2 flex items-center gap-3 bg-white/95 py-1.5 backdrop-blur dark:bg-zinc-900/95">
                                                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-700 first-letter:uppercase dark:text-zinc-200">{group.label}</span>
                                                <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                                                <span className="text-[8px] font-bold uppercase text-zinc-400">{group.items.length} {group.items.length === 1 ? 'registro' : 'registros'}</span>
                                            </div>
                                            <div className="space-y-2">
                                                {group.items.map(({ item, index }) => {
                                                    const address = pointAddress(item, resolvedAddresses);
                                                    return (
                                                        <article key={item.id} className={`relative rounded-2xl border p-3 transition-colors ${index === 0 ? 'border-primary-500/40 bg-primary-500/5' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'}`}>
                                                            <div className="flex items-start gap-3">
                                                                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${index === 0 ? 'bg-primary-500 text-black shadow-lg' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}`}>
                                                                    {index === 0 ? <Navigation size={16} className="fill-current" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div>
                                                                            <span className="block font-mono text-xs font-black text-zinc-900 dark:text-white">{new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                                                            <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-widest text-zinc-400">{index === 0 ? 'Posição mais recente' : `Ponto ${historyItems.length - index} de ${historyItems.length}`}</span>
                                                                        </div>
                                                                        {item.battery && item.battery.level > 0 && (
                                                                            <div className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                                                                                <BatteryCharging size={11} style={{ color: item.battery.color }} />
                                                                                <span className="text-[8px] font-black" style={{ color: item.battery.color }}>{item.battery.level}%</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <p className={`mt-2 text-xs font-semibold leading-relaxed ${address ? 'text-zinc-600 dark:text-zinc-300' : 'font-mono text-[10px] text-zinc-400'}`}>
                                                                        {address || `${item.lat.toFixed(5)}, ${item.lon.toFixed(5)}`}
                                                                    </p>
                                                                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                                                                        {item.provider && <span className="text-[8px] font-black uppercase tracking-wider text-zinc-400">Fonte: {item.provider === 'traccar' ? 'Rastreador' : 'K-TAG'}</span>}
                                                                        {!address && <button onClick={() => onResolveAddress(item)} className="text-[9px] font-black uppercase tracking-wider text-cyan-600 hover:underline">Buscar endereço</button>}
                                                                        <button onClick={() => viewPoint(item)} className="ml-auto flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-primary-600 hover:underline dark:text-primary-400"><MapPinned size={13} /> Ver no mapa</button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </article>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    ))}
                                    {hasMore && <button onClick={onLoadMore} disabled={historyLoading} className="w-full rounded-xl bg-zinc-100 py-3 text-xs font-black uppercase text-zinc-500 disabled:opacity-50 dark:bg-zinc-800">{historyLoading ? 'Carregando...' : 'Carregar pontos anteriores'}</button>}
                                </div>
                            )}
                        </div>

                        <div className="shrink-0 border-t border-zinc-100 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900 md:px-6 md:py-4">
                            <div className="flex items-center gap-2 md:gap-3">
                                <button type="button" onClick={onReplayToggle} disabled={historyItems.length < 2} aria-label={replayPlaying ? 'Pausar replay' : 'Iniciar replay'} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white disabled:opacity-40 md:h-11 md:w-11 md:rounded-2xl">
                                    {replayPlaying ? <Pause size={17} className="fill-current" /> : <Play size={17} className="fill-current" />}
                                </button>
                                <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex justify-between text-[8px] font-black uppercase tracking-wider text-zinc-400">
                                        <span>Replay</span>
                                        <span>{replayPoint ? new Date(replayPoint.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}</span>
                                    </div>
                                    <input type="range" min={0} max={Math.max(0, historyItems.length - 1)} value={Math.min(replayIndex, Math.max(0, historyItems.length - 1))} onChange={event => onReplaySeek(Number(event.target.value))} disabled={historyItems.length < 2} className="block w-full accent-cyan-600" aria-label="Posição do replay" />
                                </div>
                                <div className="flex shrink-0 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
                                    {([1, 2, 4] as const).map(speed => <button key={speed} type="button" onClick={() => onReplaySpeedChange(speed)} className={`rounded-lg px-1.5 py-1.5 text-[8px] font-black sm:px-2 ${replaySpeed === speed ? 'bg-white text-cyan-600 shadow-sm dark:bg-zinc-700' : 'text-zinc-400'}`}>{speed}x</button>)}
                                </div>
                            </div>
                        </div>
                    </MotionDiv>
                </MotionDiv>
            )}
        </AnimatePresence>
    );
};
