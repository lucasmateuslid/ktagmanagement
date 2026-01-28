
import React from 'react';
import { LayoutGrid, Wifi, Eye } from 'lucide-react';

interface FleetStatusChipsProps {
    stats: { linked: number, online: number, offline: number };
    filter: 'all' | 'online' | 'offline';
    setFilter: (f: 'all' | 'online' | 'offline') => void;
    limit50: boolean;
    setLimit50: (v: boolean) => void;
}

export const FleetStatusChips: React.FC<FleetStatusChipsProps> = ({ stats, filter, setFilter, limit50, setLimit50 }) => {
    return (
        <div className="pointer-events-auto flex items-center bg-zinc-900/90 dark:bg-white/90 backdrop-blur-md rounded-full p-1 shadow-2xl border border-zinc-800 dark:border-zinc-200 gap-1">
            <button onClick={() => setFilter('all')} className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filter === 'all' ? 'bg-white dark:bg-zinc-950 text-black dark:text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300 dark:hover:text-zinc-600'}`}>
              <LayoutGrid size={13} /> {stats.linked}
            </button>
            <button onClick={() => setFilter('online')} className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filter === 'online' ? 'bg-emerald-500 text-white shadow-lg' : 'text-zinc-500 hover:text-emerald-500'}`}>
              <Wifi size={13} /> {stats.online}
            </button>
            <div className="w-px h-4 bg-zinc-700 dark:bg-zinc-300 mx-1 opacity-30" />
            <button 
                onClick={() => setLimit50(!limit50)} 
                title={limit50 ? "Mostrar Todos" : "Limitar a 50"}
                className={`px-3 py-2 rounded-full text-[10px] font-black uppercase transition-all flex items-center gap-1 ${limit50 ? 'text-zinc-500' : 'text-primary-500 bg-primary-500/10'}`}
            >
                <Eye size={13} /> {limit50 ? '50' : 'ALL'}
            </button>
        </div>
    );
};
