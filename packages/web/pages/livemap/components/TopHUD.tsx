
import React from 'react';
import { Search, RefreshCw, X } from 'lucide-react';
import { SearchDropdown } from './SearchDropdown';
import { FleetStatusChips } from './FleetStatusChips';
import { DisplayLimit } from '../../../types';

interface TopHUDProps {
    searchTerm: string;
    setSearchTerm: (s: string) => void;
    isFocused: boolean;
    setIsFocused: (b: boolean) => void;
    searchPlaceholder: string;
    filteredList: any[];
    fleetLocations: any[];
    clients: any[];
    categories: any[];
    userRole?: string;
    onSelect: (id: string) => void;
    stats: any;
    filter: any;
    setFilter: any;
    displayLimit: DisplayLimit;
    setDisplayLimit: (v: DisplayLimit) => void;
    showPlates?: boolean; // New prop
    setShowPlates?: (b: boolean) => void; // New prop
    onOpenUpdateModal?: () => void;
}

export const TopHUD: React.FC<TopHUDProps> = ({ 
    searchTerm, setSearchTerm, isFocused, setIsFocused, searchPlaceholder,
    filteredList, fleetLocations, clients, categories, userRole, onSelect,
    stats, filter, setFilter, displayLimit, setDisplayLimit,
    showPlates, setShowPlates, onOpenUpdateModal
}) => {
    
    const handleClearSearch = () => {
        setSearchTerm('');
        setIsFocused(false);
    };

    return (
        <div className="absolute left-0 right-0 top-3 z-[1000] flex max-w-full flex-col items-center gap-2 px-3 pointer-events-none sm:top-4 sm:gap-3 sm:px-4">
            <div className="flex w-full max-w-xl justify-end pointer-events-auto">
                <button 
                    onClick={onOpenUpdateModal}
                    className="bg-primary-500 text-black hover:bg-primary-400 px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all active:scale-95"
                >
                    <RefreshCw size={14} /> Atualizar Tudo
                </button>
            </div>
            
            {/* OVERLAY PARA FECHAR AO CLICAR FORA */}
            {isFocused && (
                <div 
                    className="fixed inset-0 z-20 pointer-events-auto" 
                    onClick={() => setIsFocused(false)}
                />
            )}

            {/* BARRA DE PESQUISA REATORADA */}
            <div className="relative z-30 w-full min-w-0 max-w-xl pointer-events-auto">
              <div className="flex w-full min-w-0 items-center gap-1.5 sm:gap-2">
                <div className={`
                    min-w-0 flex-1 flex items-center gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl
                    border transition-all duration-300
                    ${isFocused 
                      ? 'rounded-[24px] border-primary-500 ring-4 ring-primary-500/10 shadow-xl' 
                      : 'rounded-full border-zinc-200 dark:border-zinc-800 shadow-lg hover:shadow-xl hover:border-zinc-300 dark:hover:border-zinc-700'}
                    p-1.5
                `}>
                  <div className="pl-3 flex items-center justify-center text-zinc-400 shrink-0">
                      <Search size={18} strokeWidth={2.5} className={isFocused ? 'text-primary-500' : ''} />
                  </div>

                  <input 
                      type="text" 
                      placeholder={searchPlaceholder}
                      value={searchTerm}
                      onFocus={() => setIsFocused(true)}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] font-bold text-zinc-800 dark:text-white placeholder:text-zinc-400 placeholder:font-medium h-10 px-1"
                  />

                  <div className="flex items-center gap-1 pr-1 shrink-0">
                      {searchTerm && (
                          <button 
                              onClick={handleClearSearch}
                              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors"
                              title="Limpar busca"
                          >
                              <X size={14} strokeWidth={3} />
                          </button>
                      )}
                      
                  </div>
                </div>

                {/* Cancel Button */}
                {isFocused && (
                    <button
                        onClick={() => setIsFocused(false)}
                        aria-label="Fechar pesquisa"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-zinc-600 transition-colors hover:bg-white/80 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900/80 dark:hover:text-white sm:h-auto sm:w-auto sm:rounded-none sm:px-3 sm:py-2"
                    >
                        <X size={17} className="sm:hidden" />
                        <span className="hidden sm:inline">Cancelar</span>
                    </button>
                )}
              </div>

              <SearchDropdown 
                isVisible={isFocused}
                items={filteredList}
                fleetLocations={fleetLocations}
                clients={clients}
                categories={categories}
                userRole={userRole}
                onSelect={(id) => { onSelect(id); setIsFocused(false); }}
              />
            </div>

            {/* CHIPS FLUTUANTES */}
            <FleetStatusChips 
                stats={stats}
                filter={filter}
                setFilter={setFilter}
                displayLimit={displayLimit}
                setDisplayLimit={setDisplayLimit}
                showPlates={showPlates}
                setShowPlates={setShowPlates}
            />
        </div>
    );
};
