
import React from 'react';
import { Search, ListChecks, FileText, FileSpreadsheet, FileCode, CheckSquare, Square, Filter, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Company } from '../../../types';

const MotionDiv = motion.div as any;

interface VehicleFiltersBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  companyFilter: string;
  setCompanyFilter: (companyId: string) => void;
  ownershipFilter: string;
  setOwnershipFilter: (ownership: string) => void;
  installationFilter: string;
  setInstallationFilter: (installation: string) => void;
  companies: Company[];
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
  searchTerm, setSearchTerm, 
  statusFilter, setStatusFilter,
  companyFilter, setCompanyFilter,
  ownershipFilter, setOwnershipFilter,
  installationFilter, setInstallationFilter,
  companies,
  isClientView, selectedCount, totalCount,
  handleSelectAll, handleExportPDF, handleExportExcel, handleExportCSV, searchPlaceholder
}) => {
  const [showFilters, setShowFilters] = React.useState(false);

  return (
    <div className="sticky top-4 z-20 space-y-2">
      <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-2 pl-4 rounded-[28px] border border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col md:flex-row gap-3 items-center transition-all">
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

        <div className="flex items-center gap-2 px-2 border-l border-zinc-100 dark:border-zinc-800 pl-4">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl transition-all flex items-center gap-2 ${showFilters ? 'bg-primary-500 text-black' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'}`}
          >
            <Filter size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Filtros</span>
          </button>

          {/* SELECTION ACTIONS */}
          {!isClientView && (
              <div className="flex items-center gap-2 w-full md:w-auto justify-end overflow-hidden">
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
      </div>

      <AnimatePresence>
        {showFilters && (
          <MotionDiv
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-lg grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest ml-1">Status</label>
                <div className="relative">
                  <select 
                    value={statusFilter} 
                    onChange={e => setStatusFilter(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-xs font-bold outline-none appearance-none focus:border-primary-500"
                  >
                    <option value="all">Todos os Status</option>
                    <option value="active">Ativo</option>
                    <option value="stolen">Roubo/Furto</option>
                    <option value="maintenance">Manutenção</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                </div>
              </div>

              {/* Company Filter */}
              {!isClientView && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest ml-1">Responsável (Regional)</label>
                  <div className="relative">
                    <select 
                      value={companyFilter} 
                      onChange={e => setCompanyFilter(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-xs font-bold outline-none appearance-none focus:border-primary-500"
                    >
                      <option value="all">Todas Regionais</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Ownership Filter */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest ml-1">Modalidade</label>
                <div className="relative">
                  <select 
                    value={ownershipFilter} 
                    onChange={e => setOwnershipFilter(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-xs font-bold outline-none appearance-none focus:border-primary-500"
                  >
                    <option value="all">Todas Modalidades</option>
                    <option value="leased">Comodato</option>
                    <option value="purchased">Adquirido</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                </div>
              </div>

              {/* Installation Filter */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest ml-1">Tipo de Instalação</label>
                <div className="relative">
                  <select 
                    value={installationFilter} 
                    onChange={e => setInstallationFilter(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-xs font-bold outline-none appearance-none focus:border-primary-500"
                  >
                    <option value="all">Todos os Tipos</option>
                    <option value="tag_only">Apenas Tag</option>
                    <option value="tag_tracker">Tag + Rastreador</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
};
