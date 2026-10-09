import React, { useEffect, useState } from 'react';
import { BatteryCharging, CarFront, ChevronDown, ChevronLeft, ChevronUp, Clock3, History, MapPin, Navigation, RefreshCw, Search, Share2, X } from 'lucide-react';
import type { Client, LocationHistory, Tag, Vehicle, VehicleCategory } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import { VehicleBlockingControls } from '../../../components/VehicleBlockingControls';

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
    search: string;
    onSearch: (value: string) => void;
    onFetchHistory: () => void;
    onRefreshTag: (tagId: string) => Promise<{ status: string; ageMinutes?: number | null; provider?: string; error?: string }>;
    onClose: () => void;
}

export const DetailsSheet: React.FC<DetailsSheetProps> = ({
    selectedTagId, isExpanded, toggleExpanded, vehicle, tag, category, client, lastLoc, resolvedAddress, userRole,
    search, onSearch, onFetchHistory, onRefreshTag, onClose,
}) => {
    const { addNotification } = useNotification();
    const [isUpdating, setIsUpdating] = useState(false);
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    if (!selectedTagId) return null;
    const tagIdentifier = tag?.type === 'XADTAG'
        ? (tag.identifierOriginal || tag.accessoryId || selectedTagId)
        : (tag?.accessoryId || tag?.name || selectedTagId);
    const ageMinutes = lastLoc?.timestamp ? Math.max(0, Math.floor((now - lastLoc.timestamp) / 60_000)) : null;
    const activeSignal = ageMinutes !== null && ageMinutes <= 5;
    const statusText = ageMinutes === null ? 'Nunca comunicou' : activeSignal ? 'Online' : ageMinutes <= 12 * 60 ? 'Atualização atrasada' : 'Sem comunicação';
    const ageText = ageMinutes === null ? '' : ageMinutes < 1 ? 'agora' : ageMinutes < 60 ? `há ${ageMinutes} min` : ageMinutes < 1440 ? `há ${Math.floor(ageMinutes / 60)} h` : `há ${Math.floor(ageMinutes / 1440)} d`;

    const updateLocation = async () => {
        if (isUpdating) return;
        setIsUpdating(true);
        try {
            const result = await onRefreshTag(selectedTagId);
            const age = result.ageMinutes === null || result.ageMinutes === undefined ? '' : ` Última posição há ${result.ageMinutes} min.`;
            if (result.status === 'error') throw new Error(result.error || 'O equipamento não respondeu.');
            addNotification(result.status === 'updated' ? 'success' : 'info',
                result.status === 'updated' ? 'Posição atualizada' : 'Sem nova resposta',
                `${result.error || (result.status === 'updated' ? 'Nova posição recebida.' : 'A posição não mudou.')}${age}`);
        } catch (error) {
            addNotification('error', 'Falha ao atualizar', error instanceof Error ? error.message : 'Falha ao atualizar localização.');
        } finally {
            setIsUpdating(false);
        }
    };
    const openRoute = () => {
        if (!lastLoc) return;
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lastLoc.lat},${lastLoc.lon}`, '_blank', 'noopener,noreferrer');
    };
    const shareLocation = async () => {
        if (!lastLoc) return;
        try {
            await navigator.clipboard.writeText(`https://www.google.com/maps/search/?api=1&query=${lastLoc.lat},${lastLoc.lon}`);
            addNotification('success', 'Localização copiada', 'Link da localização copiado.');
        } catch {
            addNotification('error', 'Falha ao compartilhar', 'Não foi possível copiar a localização.');
        }
    };

    return <aside aria-label="Ficha do veículo" className={`absolute bottom-0 left-0 right-0 z-[1000] flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[22px] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 sm:bottom-auto sm:left-4 sm:right-auto sm:top-4 sm:w-[min(390px,calc(100vw-32px))] sm:rounded-[20px] ${isExpanded ? 'sm:h-[min(84dvh,800px)]' : 'sm:h-auto'}`}>
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-900/30"><CarFront size={17} /></div>
            <div className="min-w-0 flex-1"><h2 className="text-xs font-bold text-zinc-900 dark:text-white">Ficha do veículo</h2><p className="text-[10px] text-zinc-400">1 selecionado</p></div>
            <button type="button" onClick={updateLocation} disabled={isUpdating} aria-label="Atualizar localização" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"><RefreshCw size={15} className={isUpdating ? 'animate-spin' : ''} /></button>
            <button type="button" onClick={toggleExpanded} aria-label={isExpanded ? 'Recolher ficha' : 'Expandir ficha'} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">{isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</button>
        </div>
        {isExpanded && <>
            <div className="shrink-0 border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
                <div className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 px-3 focus-within:border-sky-500 dark:border-zinc-700"><Search size={15} className="text-zinc-400" /><input value={search} onChange={event => { onSearch(event.target.value); onClose(); }} placeholder="Placa, modelo, equipamento ou cliente..." aria-label="Pesquisar veículos" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-zinc-400 dark:text-white" /></div>
            </div>
            <div className="shrink-0 border-b border-zinc-100 px-3 py-3 dark:border-zinc-800">
                <button type="button" onClick={onClose} className="mb-3 flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-sky-600"><ChevronLeft size={13} />Voltar aos veículos</button>
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-sky-600 dark:bg-amber-900/20"><CarFront size={22} /></div>
                    <div className="min-w-0"><h3 className="text-base font-bold leading-tight text-zinc-900 dark:text-white">{vehicle?.plate || tag?.name || 'Tag'}</h3><p className="truncate text-[10px] text-zinc-500">{vehicle?.model || category?.name || tagIdentifier}{vehicle?.year ? ` · ${vehicle.year}` : ''}</p><p className={`mt-1 flex items-center gap-1 text-[10px] font-semibold ${activeSignal ? 'text-emerald-600' : ageMinutes === null ? 'text-zinc-400' : 'text-amber-600'}`}><span className={`h-1.5 w-1.5 rounded-full ${activeSignal ? 'bg-emerald-500' : ageMinutes === null ? 'bg-zinc-400' : 'bg-amber-500'}`} />{statusText}{ageText ? ` · ${ageText}` : ''}</p></div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                    <button type="button" onClick={openRoute} disabled={!lastLoc} className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-zinc-50 text-[10px] text-zinc-600 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-300"><Navigation size={15} />Rota</button>
                    <button type="button" onClick={onFetchHistory} className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-zinc-50 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"><History size={15} />Histórico</button>
                    <button type="button" onClick={shareLocation} disabled={!lastLoc} className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-zinc-50 text-[10px] text-zinc-600 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-300"><Share2 size={15} />Compartilhar</button>
                </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-2 custom-scrollbar">
                <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-3 dark:border-amber-900/30 dark:bg-amber-900/10">
                    <button type="button" onClick={updateLocation} disabled={isUpdating} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-[11px] font-bold text-white disabled:opacity-50"><RefreshCw size={15} className={isUpdating ? 'animate-spin' : ''} />{isUpdating ? 'Atualizando...' : 'Atualizar localização'}</button>
                    <p className="mt-2 text-center text-[9px] text-zinc-500">Última comunicação: {lastLoc?.timestamp ? new Date(lastLoc.timestamp).toLocaleString('pt-BR') : 'não registrada'}</p>
                </div>

                {vehicle && <section className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700">
                    <h4 className="mb-3 text-[9px] font-bold uppercase tracking-wider text-zinc-400">Dados do veículo</h4>
                    {client && userRole !== 'client' && <div className="mb-3"><p className="text-[9px] text-zinc-400">Proprietário / cliente</p><p className="text-[10px] font-bold text-amber-600">{client.name}</p></div>}
                    <div className="mb-3"><p className="text-[9px] text-zinc-400">Modelo</p><p className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-200">{vehicle.model}{vehicle.year ? ` · ${vehicle.year}` : ''}</p></div>
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800"><span className="text-[9px] text-zinc-400">Situação</span><span className="rounded-lg bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700">{vehicle.status === 'stolen' ? 'Alerta' : vehicle.status === 'maintenance' ? 'Manutenção' : 'Ativo'}</span></div>
                    {tag && userRole !== 'client' && <div className="flex items-center justify-between gap-2 pt-3"><span className="text-[9px] text-zinc-400">{tag.type === 'XADTAG' ? 'XADTAG' : 'K-TAG'}</span><span className="truncate text-[10px] font-semibold text-zinc-700 dark:text-zinc-200">{tagIdentifier}</span></div>}
                </section>}
                {vehicle?.trackerId && <VehicleBlockingControls vehicleId={vehicle.id} />}
                <section className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700"><h4 className="mb-2 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400"><MapPin size={12} />Última localização</h4><p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-200">{lastLoc ? (resolvedAddress || 'Endereço ainda não disponível') : 'Sem posição registrada'}</p></section>
                {lastLoc && <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 text-center dark:border-zinc-700">
                    <div className="border-b border-r border-zinc-200 p-3 dark:border-zinc-700"><Clock3 size={15} className="mx-auto mb-1 text-zinc-400" /><p className="text-[9px] text-zinc-400">Comunicação</p><p className="text-[10px] font-medium">{new Date(lastLoc.timestamp).toLocaleString('pt-BR')}</p></div>
                    <div className="border-b border-zinc-200 p-3 dark:border-zinc-700"><BatteryCharging size={15} className="mx-auto mb-1 text-zinc-400" /><p className="text-[9px] text-zinc-400">Bateria</p><p className="text-[10px] font-medium">{lastLoc.battery ? `${lastLoc.battery.label} (${lastLoc.battery.level}%)` : 'Não informada'}</p></div>
                    <div className="border-r border-zinc-200 p-3 dark:border-zinc-700"><MapPin size={15} className="mx-auto mb-1 text-zinc-400" /><p className="text-[9px] text-zinc-400">Latitude</p><p className="text-[10px] font-medium">{lastLoc.lat.toFixed(6)}</p></div>
                    <div className="p-3"><MapPin size={15} className="mx-auto mb-1 text-zinc-400" /><p className="text-[9px] text-zinc-400">Longitude</p><p className="text-[10px] font-medium">{lastLoc.lon.toFixed(6)}</p></div>
                </div>}
            </div>
        </>}
    </aside>;
};
