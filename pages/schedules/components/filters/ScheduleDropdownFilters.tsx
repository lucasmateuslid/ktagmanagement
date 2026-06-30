
import React from 'react';
import { Technician } from '@/types';

interface ScheduleDropdownFiltersProps {
  technicians: Technician[];
  filterTech: string;
  setFilterTech: (val: string) => void;
  filterService: string;
  setFilterService: (val: string) => void;
  filterStatusDropdown: string;
  setFilterStatusDropdown: (val: string) => void;
  filterDevice: string;
  setFilterDevice: (val: string) => void;
  filterShift?: string;
  setFilterShift?: (val: string) => void;
  filterActiveRequester?: boolean;
  setFilterActiveRequester?: (val: boolean) => void;
  filterOnlyMine?: boolean;
  setFilterOnlyMine?: (val: boolean) => void;
}

export const ScheduleDropdownFilters: React.FC<ScheduleDropdownFiltersProps> = ({
  technicians,
  filterTech, setFilterTech,
  filterService, setFilterService,
  filterStatusDropdown, setFilterStatusDropdown,
  filterDevice, setFilterDevice,
  filterShift, setFilterShift,
  filterActiveRequester, setFilterActiveRequester,
  filterOnlyMine, setFilterOnlyMine
}) => {
  return (
    <div className="flex flex-col gap-3 w-full">
        <div className="flex flex-wrap gap-2 md:gap-3 w-full items-center">
            <select value={filterTech} onChange={(e) => setFilterTech(e.target.value)} className="flex-1 px-3 py-3 md:px-6 md:py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl md:rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none shadow-sm md:min-w-[180px] min-w-[45%] focus:border-primary-500 transition-colors truncate">
                <option>Todos Técnicos</option>
                <option>Sem Técnico</option>
                {technicians
                    .filter(t => filterDevice === 'Todos Dispositivos' || !t.services || t.services.length === 0 || t.services.includes(filterDevice))
                    .map(t => <option key={t.id}>{t.name}</option>)}
            </select>
            <select value={filterService} onChange={(e) => setFilterService(e.target.value)} className="flex-1 px-3 py-3 md:px-6 md:py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl md:rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none shadow-sm md:min-w-[180px] min-w-[45%] focus:border-primary-500 transition-colors truncate">
                <option>Todos Serviços</option>
                <option>Instalação</option>
                <option>Manutenção</option>
                <option>Retirada</option>
                <option>Vistoria</option>
            </select>
            <select value={filterDevice} onChange={(e) => setFilterDevice(e.target.value)} className="flex-1 px-3 py-3 md:px-6 md:py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl md:rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none shadow-sm md:min-w-[180px] min-w-[45%] focus:border-primary-500 transition-colors truncate">
                <option>Todos Dispositivos</option>
                <option>Tag</option>
                <option>Rastreador</option>
                <option>Rastreador + Tag</option>
            </select>
            <select value={filterStatusDropdown} onChange={(e) => setFilterStatusDropdown(e.target.value)} className="flex-1 px-3 py-3 md:px-6 md:py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl md:rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none shadow-sm md:min-w-[180px] min-w-[45%] focus:border-primary-500 transition-colors truncate">
                <option>Todos Status</option>
                <option>Solicitada</option>
                <option>Em análise</option>
                <option>Em orçamento</option>
                <option>Autorizada</option>
                <option>Confirmada</option>
                <option>Reagendada</option>
                <option>Técnico no local</option>
                <option>Cliente no local</option>
                <option>Concluída</option>
                <option>Frustrada</option>
                <option>Cancelada</option>
            </select>
            {setFilterShift && (
                <select value={filterShift || 'Todos Turnos'} onChange={(e) => setFilterShift(e.target.value)} className="flex-1 px-3 py-3 md:px-6 md:py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl md:rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none shadow-sm md:min-w-[180px] min-w-[45%] focus:border-primary-500 transition-colors truncate">
                    <option>Todos Turnos</option>
                    <option>Manhã</option>
                    <option>Tarde</option>
                    <option>Noite</option>
                </select>
            )}
            {setFilterActiveRequester && (
                <button
                    onClick={() => setFilterActiveRequester(!filterActiveRequester)}
                    className={`flex-1 px-3 py-3 md:px-6 md:py-3.5 border rounded-xl md:rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none shadow-sm md:min-w-[150px] min-w-[45%] transition-colors truncate ${filterActiveRequester ? 'bg-indigo-50 text-indigo-600 border-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500'}`}
                >
                    Somente Cliente Ativo
                </button>
            )}
            {setFilterOnlyMine && (
                <button
                    onClick={() => setFilterOnlyMine(!filterOnlyMine)}
                    className={`flex-1 px-3 py-3 md:px-6 md:py-3.5 border rounded-xl md:rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none shadow-sm md:min-w-[150px] min-w-[45%] transition-colors truncate ${filterOnlyMine ? 'bg-amber-50 text-amber-600 border-amber-500 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500'}`}
                >
                    Somente Minhas OS's
                </button>
            )}
        </div>
    </div>
  );
};
