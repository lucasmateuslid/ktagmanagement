
import React from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { SearchDropdown } from './SearchDropdown';
import { FleetStatusChips } from './FleetStatusChips';

interface TopHUDProps {
    searchTerm: string;
    setSearchTerm: (s: string) => void;
    isFocused: boolean;
    setIsFocused: (b: boolean) => void;
    loading: boolean;
    onRefresh: () => void;
    searchPlaceholder: string;
    // Props para Dropdown
    filteredList: any[];
    fleetLocations: any[];
    clients: any[];
    userRole?: string;
    onSelect: (id: string) => void;
    // Props para Chips
    stats: any;
    filter: any;
    setFilter: any;
    limit50: any;
    setLimit50: any;
}

export const TopHUD: React.FC<TopHUDProps> = ({ 
    searchTerm, setSearchTerm, isFocused, setIsFocused, loading, onRefresh, searchPlaceholder,
    filteredList, fleetLocations, clients, userRole, onSelect,
    stats, filter, setFilter, limit50, setLimit50
}) => {
    return (
        <div className="absolute top-6 left-0 right-0 z-[400] px-4 pointer-events-none flex flex-col items-center gap-4">
            <div className="w-full max-w-xl pointer-events-auto">
              <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-[24px] shadow-2xl border border-zinc-200 dark:border-zinc-800 p-1.5 flex items-center gap-2">
                <div className="flex-1 flex items-center gap-3 pl-4">
                  <Search size={18} className="text-zinc-400" />
                  <input 
                    type="text" 
                    placeholder={searchPlaceholder}
                    value={searchTerm}
                    onFocus={() => setIsFocused(true)}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-transparent border-none outline-none text-[13px] font-black w-full text-zinc-900 dark:text-white uppercase placeholder:normal-case placeholder:font-bold"
                  />
                </div>
                <button onClick={onRefresh} className={`p-2.5 rounded-2xl transition-all active:scale-90 ${loading ? 'text-primary-500' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>

              <SearchDropdown 
                isVisible={isFocused}
                items={filteredList}
                fleetLocations={fleetLocations}
                clients={clients}
                userRole={userRole}
                onSelect={onSelect}
              />
            </div>

            {/* STATUS CHIPS (Apenas visível se não estiver pesquisando tag solta) */}
            <FleetStatusChips 
                stats={stats}
                filter={filter}
                setFilter={setFilter}
                limit50={limit50}
                setLimit50={setLimit50}
            />
        </div>
    );
};
