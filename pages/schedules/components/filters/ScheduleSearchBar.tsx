
import React from 'react';
import { Search, FileText, FileSpreadsheet, Calendar } from 'lucide-react';

interface ScheduleSearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isPrivileged: boolean;
  onExportPDF: () => void;
  onExportExcel: () => void;
  isExporting: boolean;
  filterStartDate?: string;
  setFilterStartDate?: (date: string) => void;
  filterEndDate?: string;
  setFilterEndDate?: (date: string) => void;
}

export const ScheduleSearchBar: React.FC<ScheduleSearchBarProps> = ({
  searchTerm,
  setSearchTerm,
  isPrivileged,
  onExportPDF,
  onExportExcel,
  isExporting,
  filterStartDate,
  setFilterStartDate,
  filterEndDate,
  setFilterEndDate
}) => {
  return (
    <div className="flex-1 w-full flex flex-col xl:flex-row gap-3 xl:justify-end items-start xl:items-center">
        
        {/* Search */}
        <div className="relative w-full xl:max-w-xs xl:flex-1 order-1 xl:order-2">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
                type="text" 
                placeholder="Buscar solicitações..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl xl:rounded-2xl text-xs font-bold outline-none focus:border-primary-500 transition-all shadow-sm h-11 xl:h-[46px]" 
            />
        </div>

        {/* Dates and Buttons Container */}
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto order-2 xl:order-1">
            {/* Dates */}
            {isPrivileged && setFilterStartDate && setFilterEndDate && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex-1 flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl xl:rounded-2xl px-3 h-11 xl:h-[46px] shadow-sm focus-within:border-primary-500 transition-colors">
                        <span className="text-[9px] uppercase font-black text-zinc-400 mr-2 shrink-0">De</span>
                        <input 
                            type="date" 
                            value={filterStartDate} 
                            onChange={(e) => setFilterStartDate(e.target.value)} 
                            className="bg-transparent text-xs font-bold outline-none text-zinc-700 dark:text-zinc-300 w-full"
                        />
                    </div>
                    <div className="flex-1 flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl xl:rounded-2xl px-3 h-11 xl:h-[46px] shadow-sm focus-within:border-primary-500 transition-colors">
                        <span className="text-[9px] uppercase font-black text-zinc-400 mr-2 shrink-0">Até</span>
                        <input 
                            type="date" 
                            value={filterEndDate} 
                            onChange={(e) => setFilterEndDate(e.target.value)} 
                            className="bg-transparent text-xs font-bold outline-none text-zinc-700 dark:text-zinc-300 w-full"
                        />
                    </div>
                </div>
            )}
            
            {/* Export */}
            {isPrivileged && (
                <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={onExportPDF} disabled={isExporting} title="Baixar PDF Operacional" className="flex-1 sm:flex-none p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl xl:rounded-2xl text-zinc-400 hover:text-red-500 hover:border-red-500/30 shadow-sm disabled:opacity-50 h-11 xl:h-[46px] flex items-center justify-center transition-colors"><FileText size={18}/></button>
                    <button onClick={onExportExcel} disabled={isExporting} title="Baixar Planilha Excel" className="flex-1 sm:flex-none p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl xl:rounded-2xl text-zinc-400 hover:text-emerald-500 hover:border-emerald-500/30 shadow-sm disabled:opacity-50 h-11 xl:h-[46px] flex items-center justify-center transition-colors"><FileSpreadsheet size={18}/></button>
                </div>
            )}
        </div>
    </div>
  );
};
