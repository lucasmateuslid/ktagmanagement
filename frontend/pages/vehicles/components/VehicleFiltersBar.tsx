
import React from 'react';
import { Search, ListChecks, FileText, FileSpreadsheet, FileCode, CheckSquare, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div as any;

interface VehicleFiltersBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isClientView: boolean;
  selectedCount: number;
  totalCount: number;
  handleSelectAll: () => void;
  handleExportPDF: () => void;
  handleExportExcel: () => void;
  handleExportCSV: () => void;
  searchPlaceholder: string;
}

export const VehicleFiltersBar: React.FC<VehicleFiltersBarProps> = ({
  searchTerm, setSearchTerm, isClientView, selectedCount, totalCount,
  handleSelectAll, handleExportPDF, handleExportExcel, handleExportCSV, searchPlaceholder
}) => {
  return (
    <div className="sticky top-4 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-2 pl-4 rounded-[28px] border border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col md:flex-row gap-3 items-center transition-all">
      <div className="relative flex-1 w-full">
        <Search size={18} className="absolute left-0 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input 
          type="text" 
          placeholder={searchPlaceholder} 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          className="w-full pl-8 pr-4 py-3 bg-transparent border-none text-sm font-bold outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400" 
        />
      </div>

      {/* SELECTION ACTIONS */}
      {!isClientView && (
          <div className="flex items-center gap-2 w-full md:w-auto justify-end overflow-hidden px-2 border-l border-zinc-100 dark:border-zinc-800 pl-4">
              <AnimatePresence mode="popLayout">
                  {selectedCount > 0 && (
                      <MotionDiv 
                          initial={{ opacity: 0, x: 20 }} 
                          animate={{ opacity: 1, x: 0 }} 
                          exit={{ opacity: 0, x: 20 }}
                          className="flex items-center gap-2"
                      >
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-primary-500/10 text-primary-600 rounded-xl border border-primary-500/20">
                              <ListChecks size={16} />
                              <span className="text-[10px] font-black uppercase tracking-widest">{selectedCount}</span>
                          </div>
                          
                          <button onClick={handleExportPDF} title="Exportar PDF" className="p-2.5 bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-colors"><FileText size={18}/></button>
                          <button onClick={handleExportExcel} title="Exportar Excel" className="p-2.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-colors"><FileSpreadsheet size={18}/></button>
                          <button onClick={handleExportCSV} title="Exportar CSV" className="p-2.5 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-colors"><FileCode size={18}/></button>
                          
                          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1" />
                      </MotionDiv>
                  )}
              </AnimatePresence>

              <button 
                  onClick={handleSelectAll} 
                  className={`px-6 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center gap-2 transition-all border ${
                      selectedCount === totalCount && totalCount > 0 
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-transparent shadow-md' 
                      : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                  }`}
              >
                  {selectedCount === totalCount && totalCount > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                  {selectedCount === totalCount && totalCount > 0 ? 'Desmarcar' : 'Todos'}
              </button>
          </div>
      )}
    </div>
  );
};
