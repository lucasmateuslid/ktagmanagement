
import React from 'react';
import { Search, FileText, FileSpreadsheet, Calendar } from 'lucide-react';

interface ScheduleSearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isPrivileged: boolean;
  onExportPDF: () => void;
  onExportExcel: () => void;
  isExporting: boolean;
  filterDate?: string;
  setFilterDate?: (date: string) => void;
}

export const ScheduleSearchBar: React.FC<ScheduleSearchBarProps> = ({
  searchTerm,
  setSearchTerm,
  isPrivileged,
  onExportPDF,
  onExportExcel,
  isExporting,
  filterDate,
  setFilterDate
}) => {
  return (
    <div className="flex-1 w-full flex flex-col md:flex-row gap-3 justify-end items-center">
        {isPrivileged && setFilterDate && (
            <div className="relative w-full md:w-auto">
                <input 
                    type="date" 
                    value={filterDate} 
                    onChange={(e) => setFilterDate(e.target.value)} 
                    className="w-full md:w-auto px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none text-zinc-500 uppercase tracking-widest shadow-sm focus:border-zinc-400 transition-all h-[46px]"
                />
            </div>
        )}
        
        <div className="relative flex-1 max-w-md w-full">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
                type="text" 
                placeholder="Buscar..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:border-zinc-400 transition-all shadow-sm h-[46px]" 
            />
        </div>
        
        {isPrivileged && (
            <div className="flex gap-2 w-full md:w-auto">
                <button onClick={onExportPDF} disabled={isExporting} className="flex-1 md:flex-none p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 hover:text-red-500 shadow-sm disabled:opacity-50 h-[46px] flex items-center justify-center"><FileText size={18}/></button>
                <button onClick={onExportExcel} disabled={isExporting} className="flex-1 md:flex-none p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 hover:text-emerald-500 shadow-sm disabled:opacity-50 h-[46px] flex items-center justify-center"><FileSpreadsheet size={18}/></button>
            </div>
        )}
    </div>
  );
};
