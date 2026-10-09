import React, { useMemo, useState } from 'react';
import { CarFront, Check, ChevronLeft, ChevronRight, ClipboardList, MapPinned, RefreshCw, Search, X } from 'lucide-react';
import type { Client, LocationHistory, Vehicle, VehicleCategory } from '../../../types';
import { fleetStatus, type FleetLocationIndex, type FleetStatus, vehicleLocation } from '../utils/fleetView';
import { vehicleDisplayTagId, vehicleEquipmentKind } from '../utils/vehicleTracking';

const statusLabels: Record<FleetStatus, string> = { all: 'Todos', online: 'Online', delayed: 'Atrasados', offline: 'Não comunicam', no_position: 'Nunca' };
const statusColors: Record<Exclude<FleetStatus, 'all'>, string> = { online: 'text-emerald-600', delayed: 'text-amber-600', offline: 'text-red-600', no_position: 'text-zinc-400' };
const statusDots: Record<FleetStatus, string> = { all: 'bg-zinc-400', online: 'bg-emerald-500', delayed: 'bg-amber-500', offline: 'bg-red-500', no_position: 'bg-zinc-400' };

interface FleetPanelProps {
  vehicles: Vehicle[];
  results: Vehicle[];
  locations: LocationHistory[];
  clients: Client[];
  categories: VehicleCategory[];
  search: string;
  onSearch: (value: string) => void;
  status: FleetStatus;
  onStatus: (value: FleetStatus) => void;
  communicationSeen: Set<string>;
  locationIndex: FleetLocationIndex;
  selectedIds: string[];
  onSelectedIds: (ids: string[]) => void;
  onOpenVehicle: (tagId: string) => void;
  onViewMap: () => void;
  onRefresh: () => void;
  counts: Record<FleetStatus, number>;
  mapLimit: number | 'all';
  onMapLimit: (limit: number | 'all') => void;
  showPlates: boolean;
  onShowPlates: (show: boolean) => void;
  userRole?: string;
}

export const FleetPanel: React.FC<FleetPanelProps> = ({
  vehicles, results, locations, clients, categories, search, onSearch, status, onStatus, communicationSeen, locationIndex,
  selectedIds, onSelectedIds, onOpenVehicle, onViewMap, onRefresh, counts, mapLimit, onMapLimit, showPlates, onShowPlates, userRole,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const selectedSet = new Set(selectedIds);
  const selectedVehicles = vehicles.filter(vehicle => selectedSet.has(vehicle.id));
  const categoryById = useMemo(() => new Map(categories.map(category => [category.id, category])), [categories]);
  const clientById = useMemo(() => new Map(clients.map(client => [client.id, client])), [clients]);
  const selectableIds = results.map(item => item.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedSet.has(id));
  const toggleResultSelection = () => onSelectedIds(allSelected ? selectedIds.filter(id => !selectableIds.includes(id)) : [...new Set([...selectedIds, ...selectableIds])]);
  const selectPastedPlates = () => {
    const plates = new Set((pasteText.toUpperCase().match(/[A-Z]{3}[0-9][A-Z0-9][0-9]{2}/g) || []).map(value => value.replace(/[^A-Z0-9]/g, '')));
    const matching = results.filter(vehicle => plates.has(String(vehicle.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))).map(vehicle => vehicle.id);
    onSelectedIds([...new Set([...selectedIds, ...matching])]);
    setPasteOpen(false);
    setPasteText('');
  };

  return (
    <div className="pointer-events-none absolute inset-x-2 top-2 z-[900] flex items-start sm:inset-x-auto sm:left-4 sm:top-4">
      <section className={`pointer-events-auto flex max-h-[min(82dvh,800px)] w-full flex-col overflow-hidden rounded-[22px] border border-zinc-200 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-zinc-700 dark:bg-zinc-900/95 ${expanded ? 'sm:w-[450px]' : 'sm:w-[360px]'}`} aria-label="Minha frota">
        {expanded && <div className="flex shrink-0 items-center gap-2 border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-900/30"><CarFront size={17} /></div>
          <div className="min-w-0 flex-1"><h2 className="text-xs font-bold text-zinc-900 dark:text-white">Minha frota</h2><p className="text-[10px] text-zinc-400">{selectedIds.length ? `${selectedIds.length} ${selectedIds.length === 1 ? 'selecionado' : 'selecionados'}` : `${counts.all} veículos`}</p></div>
          {userRole !== 'client' && <button type="button" onClick={onRefresh} title="Atualizar veículos" aria-label="Atualizar veículos" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><RefreshCw size={15} /></button>}
          <button type="button" onClick={() => setExpanded(false)} aria-label="Recolher frota" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronLeft size={16} /></button>
        </div>}
          <div className="shrink-0 space-y-2 px-3 py-3">
            <div className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 px-3 focus-within:border-sky-500 dark:border-zinc-700"><Search size={15} className="text-zinc-400" /><input value={search} onFocus={() => setExpanded(true)} onChange={event => onSearch(event.target.value)} placeholder={userRole === 'client' ? 'Pesquisar placa ou modelo...' : 'Placa, modelo, equipamento ou cliente...'} className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-zinc-400 dark:text-white" aria-label="Pesquisar frota" />{search && <button type="button" onClick={() => onSearch('')} aria-label="Limpar busca"><X size={14} /></button>}{!expanded && <button type="button" onClick={() => setExpanded(true)} aria-label="Expandir pesquisa" className="text-zinc-400 hover:text-sky-600"><ChevronRight size={17} /></button>}</div>
            {expanded && <>
            <div className="flex gap-1 overflow-x-auto pb-1" aria-label="Filtrar por status">{(['all', 'online', 'delayed', 'offline', 'no_position'] as FleetStatus[]).map(value => <button key={value} type="button" onClick={() => onStatus(value)} aria-label={value === 'no_position' ? `Nunca comunicaram: ${counts[value]}` : undefined} aria-pressed={status === value} className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold ${status === value ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}><span className={`h-1.5 w-1.5 rounded-full ${status === value ? 'bg-current' : statusDots[value]}`} />{statusLabels[value]} <span className="opacity-60">{counts[value]}</span></button>)}</div>
            <div className="flex items-center justify-between gap-2 rounded-xl bg-zinc-900 px-2 py-1.5 text-white dark:bg-zinc-800"><span className="px-1 text-[10px] font-semibold">Status de comunicação</span>{userRole !== 'client' && <button type="button" onClick={onRefresh} className="flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-[10px] font-bold text-white"><RefreshCw size={12} /> Atualizar tudo</button>}</div>
            <label className="flex items-center justify-between gap-2 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300"><span>Veículos exibidos no mapa</span><select aria-label="Limite de veículos no mapa" value={mapLimit} onChange={event => onMapLimit(event.target.value === 'all' ? 'all' : Number(event.target.value))} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-900">{[10, 30, 50, 100, 200].map(limit => <option key={limit} value={limit}>{limit}</option>)}<option value="all">Todos</option></select></label>
            <label className="flex items-center gap-2 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300"><input type="checkbox" checked={showPlates} onChange={event => onShowPlates(event.target.checked)} /> Mostrar placas no mapa</label>
            </>}
          </div>
          {expanded && <>
          <div className="flex shrink-0 items-center justify-between border-t border-zinc-100 px-3 py-2 text-[10px] dark:border-zinc-800"><span className="font-bold text-zinc-700 dark:text-zinc-200">{results.length} veículos encontrados</span><span className="text-zinc-400">{selectedIds.length} selecionados</span></div>
          {selectedVehicles.length > 0 && <div className="flex shrink-0 gap-1 overflow-x-auto px-3 pb-2 custom-scrollbar" aria-label="Veículos selecionados">{selectedVehicles.map(vehicle => <button key={vehicle.id} type="button" onClick={() => onSelectedIds(selectedIds.filter(id => id !== vehicle.id))} aria-label={`Remover ${vehicle.plate} da seleção`} className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{vehicle.plate}<X size={10} /></button>)}</div>}
          <div className="flex shrink-0 gap-2 px-3 py-2"><button type="button" onClick={toggleResultSelection} disabled={!results.length} className="flex-1 rounded-lg bg-zinc-100 px-2 py-2 text-[10px] font-bold text-zinc-700 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200"><Check size={12} className="mr-1 inline" />{allSelected ? 'Desmarcar resultados' : 'Selecionar resultados'}</button><button type="button" onClick={() => setPasteOpen(value => !value)} aria-expanded={pasteOpen} className="rounded-lg border border-zinc-200 px-2 py-2 text-[10px] font-bold text-zinc-600 dark:border-zinc-700"><ClipboardList size={12} className="mr-1 inline" />Colar lista</button></div>
          {pasteOpen && <div className="shrink-0 space-y-2 border-b border-zinc-100 px-3 pb-2 dark:border-zinc-800"><textarea value={pasteText} onChange={event => setPasteText(event.target.value)} placeholder="Cole as placas, uma por linha" aria-label="Lista de placas" className="h-16 w-full resize-none rounded-lg border border-zinc-200 p-2 text-[11px] outline-none focus:border-sky-500 dark:border-zinc-700 dark:bg-zinc-900" /><button type="button" onClick={selectPastedPlates} disabled={!pasteText.trim()} className="rounded-lg bg-sky-600 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">Selecionar placas encontradas</button></div>}
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2 custom-scrollbar">{results.length === 0 ? <p className="py-8 text-center text-xs text-zinc-400">Nenhum veículo encontrado.</p> : results.map(vehicle => {
            const location = vehicleLocation(vehicle, locations, locationIndex);
            const id = location?.tagId || vehicleDisplayTagId(vehicle, locations);
            const state = fleetStatus(vehicle, locations, Date.now(), communicationSeen, locationIndex);
            const category = categoryById.get(vehicle.type);
            const clientName = userRole === 'client' ? '' : clientById.get(vehicle.clientId || '')?.name;
            return <div key={vehicle.id} className={`flex items-start gap-2 rounded-xl border p-2.5 shadow-sm dark:bg-zinc-900 ${selectedSet.has(vehicle.id) ? 'border-sky-400 bg-amber-50/40 dark:border-sky-600' : 'border-zinc-100 bg-white dark:border-zinc-800'}`}>
              <button type="button" onClick={() => onOpenVehicle(id)} className="min-w-0 flex-1 text-left"><div className="flex items-center gap-2"><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selectedSet.has(vehicle.id) ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-sky-50 text-sky-600 dark:bg-sky-900/30'}`}><CarFront size={15} /></div><div className="min-w-0"><p className="text-xs font-bold text-zinc-900 dark:text-white">{vehicle.plate}</p><p className="truncate text-[9px] text-zinc-500">{vehicle.model}{vehicle.year ? ` · ${vehicle.year}` : ''}</p></div></div><p className="mt-1.5 truncate text-[9px] text-zinc-400">{category?.name || vehicleEquipmentKind(vehicle)}{clientName ? ` · ${clientName}` : ''}</p><p className={`mt-1 text-[9px] font-semibold ${statusColors[state]}`}>{state === 'no_position' ? 'Nunca comunicou' : state === 'online' ? 'Online' : state === 'delayed' ? 'Comunicação atrasada' : 'Sem comunicação'}{location?.timestamp ? ` · ${new Date(location.timestamp).toLocaleString('pt-BR')}` : ''}</p><span className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold text-sky-600">Ver ficha <ChevronRight size={11} /></span></button>
              <label className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border dark:border-zinc-700 ${selectedSet.has(vehicle.id) ? 'border-sky-600 bg-sky-600 text-white' : 'border-zinc-200'}`} aria-label={`Selecionar ${vehicle.plate}`}><input type="checkbox" checked={selectedSet.has(vehicle.id)} onChange={() => onSelectedIds(selectedSet.has(vehicle.id) ? selectedIds.filter(value => value !== vehicle.id) : [...selectedIds, vehicle.id])} className="sr-only" />{selectedSet.has(vehicle.id) && <Check size={15} />}</label>
            </div>;
          })}</div>
          <div className="shrink-0 border-t border-zinc-100 p-2 dark:border-zinc-800"><div className="flex gap-2"><button type="button" onClick={() => onSelectedIds([])} disabled={!selectedIds.length} className="rounded-xl border border-zinc-200 px-3 text-[10px] font-semibold text-zinc-500 disabled:opacity-50 dark:border-zinc-700">Limpar</button><button type="button" onClick={() => { if (selectedVehicles.length === 1) onOpenVehicle(vehicleDisplayTagId(selectedVehicles[0], locations)); else { setExpanded(false); onViewMap(); } }} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 text-xs font-bold text-white"><MapPinned size={15} />{selectedVehicles.length === 1 ? 'Abrir veículo no mapa' : selectedVehicles.length > 1 ? 'Ver selecionados no mapa' : 'Ver frota no mapa'}</button></div></div>
        </>}
      </section>
    </div>
  );
};
