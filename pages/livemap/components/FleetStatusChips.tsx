
import React, { useState } from 'react';
import { LayoutGrid, Wifi, Eye, ChevronDown } from 'lucide-react';
import { DisplayLimit } from '../LiveMap';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div as any;

interface FleetStatusChipsProps {
    stats: { linked: number, online: number, offline: number };
    filter: 'all' | 'online' | 'offline';
    setFilter: (f: 'all' | 'online' | 'offline') => void;
    displayLimit: DisplayLimit;
    setDisplayLimit: (v: DisplayLimit) => void;
}

export const FleetStatusChips: React.FC<FleetStatusChipsProps> = ({ stats, filter, setFilter, displayLimit, setDisplayLimit }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const options: DisplayLimit[] = [10, 30, 50, 100, 200, 'all'];

    return (
        <div className="pointer-events-auto flex items-center bg-zinc-900/90 dark:bg-white/90 backdrop-blur-md rounded-full p-1 shadow-2xl border border-zinc-800 dark:border-zinc-200 gap-0.5 md:gap-1 scale-[0.9] md:scale-100 relative">
            <button 
                onClick={() => setFilter('all')} 
                className={`px-4 md:px-5 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 md:gap-2 ${filter === 'all' ? 'bg-white dark:bg-zinc-950 text-black dark:text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300 dark:hover:text-zinc-600'}`}
            >
              <LayoutGrid size={12} /> {stats.linked}
            </button>
            <button 
                onClick={() => setFilter('online')} 
                className={`px-4 md:px-5 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 md:gap-2 ${filter === 'online' ? 'bg-emerald-500 text-white shadow-lg' : 'text-zinc-500 hover:text-emerald-500'}`}
            >
              <Wifi size={12} /> {stats.online}
            </button>
            
            <div className="w-px h-3 md:h-4 bg-zinc-700 dark:bg-zinc-300 mx-1 opacity-20" />
            
            <div className="relative">
                <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)} 
                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${displayLimit === 'all' ? 'text-primary-500' : 'text-zinc-400'}`}
                >
                    <Eye size={12} /> {displayLimit === 'all' ? 'ALL' : displayLimit}
                    <ChevronDown size={10} className={`transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                    {isMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-[-1]" onClick={() => setIsMenuOpen(false)} />
                            <MotionDiv 
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-white rounded-2xl shadow-2xl border border-zinc-800 dark:border-zinc-200 p-1.5 flex flex-col min-w-[80px] overflow-hidden"
                            >
                                {options.map((opt) => (
                                    <button 
                                        key={opt}
                                        onClick={() => { setDisplayLimit(opt); setIsMenuOpen(false); }}
                                        className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-colors text-center ${displayLimit === opt ? 'bg-primary-500 text-black' : 'text-zinc-500 hover:bg-zinc-800 dark:hover:bg-zinc-100'}`}
                                    >
                                        {opt === 'all' ? 'Todos' : opt}
                                    </button>
                                ))}
                            </MotionDiv>
                        </>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
