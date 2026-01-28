
import React from 'react';
import { Technician } from '../../../../types';

interface ScheduleDropdownFiltersProps {
  technicians: Technician[];
  filterTech: string;
  setFilterTech: (val: string) => void;
  filterService: string;
  setFilterService: (val: string) => void;
  filterStatusDropdown: string;
  setFilterStatusDropdown: (val: string) => void;
}

export const ScheduleDropdownFilters: React.FC<ScheduleDropdownFiltersProps> = ({
  technicians,
  filterTech, setFilterTech,
  filterService, setFilterService,
  filterStatusDropdown, setFilterStatusDropdown
}) => {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
        <select value={filterTech} onChange={(e) => setFilterTech(e.target.value)} className="px-6 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none shadow-sm min-w-[180px]">
            <option>Todos Técnicos</option>
            <option>Sem Técnico</option>
            {technicians.map(t => <option key={t.id}>{t.name}</option>)}
        </select>
        <select value={filterService} onChange={(e) => setFilterService(e.target.value)} className="px-6 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none shadow-sm min-w-[180px]">
            <option>Todos Serviços</option>
            <option>Instalação</option>
            <option>Manutenção</option>
            <option>Retirada</option>
            <option>Vistoria</option>
        </select>
        <select value={filterStatusDropdown} onChange={(e) => setFilterStatusDropdown(e.target.value)} className="px-6 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none shadow-sm min-w-[180px]">
            <option>Todos Status</option>
            <option>Solicitada</option>
            <option>Em análise</option>
            <option>Em orçamento</option>
            <option>Autorizada</option>
            <option>Confirmada</option>
            <option>Reagendada</option>
            <option>Técnico no local</option>
            <option>Concluída</option>
            <option>Cancelada</option>
        </select>
    </div>
  );
};
