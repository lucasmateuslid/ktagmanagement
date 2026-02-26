
import React from 'react';
import { Search, RefreshCw, X } from 'lucide-react';
import { SearchDropdown } from './SearchDropdown';
import { FleetStatusChips } from './FleetStatusChips';
import { DisplayLimit } from '../../LiveMap';

interface TopHUDProps {
    searchTerm: string;
    setSearchTerm: (s: string) => void;
    isFocused: boolean;
    setIsFocused: (b: boolean) => void;
    loading: boolean;
    onRefresh: () => void;
    searchPlaceholder: string;
    filteredList: any[];
    fleetLocations: any[];
    clients: any[];
    userRole?: string;
    onSelect: (id: string) => void;
    stats: any;
    filter: any;
    setFilter: any;
    displayLimit: DisplayLimit;
    setDisplayLimit: (v: DisplayLimit) => void;
    showPlates?: boolean; // New prop
    setShowPlates?: (b: boolean) => void; // New prop
}

export const TopHUD: React.FC<TopHUDProps> = ({ 
    searchTerm, setSearchTerm, isFocused, setIsFocused, loading, onRefresh, searchPlaceholder,
    filteredList, fleetLocations, clients, userRole, onSelect,
    stats, filter, setFilter, displayLimit, setDisplayLimit,
    showPlates, setShowPlates
}) => {
    
    const handleClearSearch = () => {
        setSearchTerm('');
        setIsFocused(false);
    };

    return (
        <div className="absolute top-4 left-0 right-0 z-[400] px-4 pointer-events-none flex flex-col items-center gap-3">
            
            {/* BARRA DE PESQUISA REATORADA */}
            <div className="w-full max-w-lg pointer-events-auto relative z-30">
              <div className={`
                  flex items-center gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl 
                  border transition-all duration-300
                  ${isFocused 
                    ? 'rounded-[24px] border-primary-500 ring-4 ring-primary-500/10 shadow-xl' 
                    : 'rounded-full border-zinc-200 dark:border-zinc-800 shadow-lg hover:shadow-xl hover:border-zinc-300 dark:hover:border-zinc-700'}
                  p-1.5
              `}>
                <div className="pl-3 flex items-center justify-center text-zinc-400">
                    <Search size={18} strokeWidth={2.5} className={isFocused ? 'text-primary-500' : ''} />
                </div>

                <input 
                    type="text" 
                    placeholder={searchPlaceholder}
                    value={searchTerm}
                    onFocus={() => setIsFocused(true)}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-[13px] font-bold text-zinc-800 dark:text-white placeholder:text-zinc-400 placeholder:font-medium h-10 px-1"
                />

                <div className="flex items-center gap-1 pr-1">
                    {searchTerm && (
                        <button 
                            onClick={handleClearSearch}
                            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors"
                        >
                            <X size={14} strokeWidth={3} />
                        </button>
                    )}
                    
                    <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1" />

                    <button 
                        onClick={onRefresh} 
                        className={`
                            p-2 rounded-full transition-all active:scale-90
                            ${loading 
                                ? 'bg-primary-500/10 text-primary-500 rotate-180' 
                                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-primary-500'}
                        `}
                        title="Atualizar Localizações"
                    >
                        <RefreshCw size={16} strokeWidth={2.5} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
              </div>

              <SearchDropdown 
                isVisible={isFocused}
                items={filteredList}
                fleetLocations={fleetLocations}
                clients={clients}
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
