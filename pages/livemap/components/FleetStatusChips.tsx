
import React, { useState } from 'react';
import { LayoutGrid, Wifi, Eye, ChevronDown, Check, ScanText } from 'lucide-react';
import { DisplayLimit } from '../../../types';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div as any;

interface FleetStatusChipsProps {
    stats: { linked: number, online: number, offline: number };
    filter: 'all' | 'online' | 'offline';
    setFilter: (f: 'all' | 'online' | 'offline') => void;
    displayLimit: DisplayLimit;
    setDisplayLimit: (v: DisplayLimit) => void;
    showPlates?: boolean;
    setShowPlates?: (b: boolean) => void;
}

export const FleetStatusChips: React.FC<FleetStatusChipsProps> = ({ 
    stats, filter, setFilter, displayLimit, setDisplayLimit, showPlates, setShowPlates 
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const options: DisplayLimit[] = [10, 30, 50, 100, 200, 'all'];

    return (
        <div className="pointer-events-auto flex items-center bg-zinc-900/90 dark:bg-white/90 backdrop-blur-md rounded-full p-1.5 shadow-2xl border border-zinc-800 dark:border-zinc-200 gap-1 relative z-20">
            {/* Toggle Plates - Novo Botão */}
            {setShowPlates && (
                <button 
                    onClick={() => setShowPlates(!showPlates)} 
                    className={`p-2 rounded-full transition-all flex items-center justify-center ${showPlates ? 'bg-primary-500 text-black' : 'text-zinc-500 hover:text-zinc-300 dark:hover:text-zinc-600'}`}
                    title={showPlates ? "Ocultar Placas" : "Mostrar Placas"}
                >
                    <ScanText size={14} strokeWidth={2.5} />
                </button>
            )}

            <div className="w-px h-4 bg-zinc-700 dark:bg-zinc-300 mx-1 opacity-30" />

            {/* Filtro: Total */}
            <button 
                onClick={() => setFilter('all')} 
                className={`px-3 md:px-4 py-1.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${filter === 'all' ? 'bg-white dark:bg-zinc-950 text-black dark:text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300 dark:hover:text-zinc-600'}`}
            >
              <LayoutGrid size={12} /> {stats.linked}
            </button>

            {/* Filtro: Online */}
            <button 
                onClick={() => setFilter('online')} 
                className={`px-3 md:px-4 py-1.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${filter === 'online' ? 'bg-emerald-500 text-white shadow-md' : 'text-zinc-500 hover:text-emerald-500'}`}
            >
              <Wifi size={12} /> {stats.online}
            </button>
            
            <div className="w-px h-4 bg-zinc-700 dark:bg-zinc-300 mx-1 opacity-30" />
            
            {/* Seletor de Quantidade (Display Limit) */}
            <div className="relative">
                <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)} 
                    className={`pl-3 pr-2 py-1.5 rounded-full text-[9px] md:text-[10px] font-black uppercase transition-all flex items-center gap-1 hover:bg-white/5 dark:hover:bg-black/5 ${isMenuOpen ? 'text-primary-500' : 'text-zinc-400 dark:text-zinc-600'}`}
                >
                    <Eye size={12} /> 
                    <span>{displayLimit === 'all' ? 'TODOS' : displayLimit}</span>
                    <ChevronDown size={10} className={`transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                    {isMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-[-1]" onClick={() => setIsMenuOpen(false)} />
                            <MotionDiv 
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                className="absolute top-full mt-3 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-white rounded-xl shadow-2xl border border-zinc-800 dark:border-zinc-200 p-1 flex flex-col min-w-[100px] overflow-hidden z-50"
                            >
                                <div className="px-3 py-2 text-[8px] font-black text-zinc-500 uppercase tracking-widest text-center border-b border-zinc-800 dark:border-zinc-200 mb-1">
                                    Visualização
                                </div>
                                {options.map((opt) => (
                                    <button 
                                        key={opt}
                                        onClick={() => { setDisplayLimit(opt); setIsMenuOpen(false); }}
                                        className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors flex items-center justify-between group ${displayLimit === opt ? 'bg-primary-500 text-black' : 'text-zinc-400 dark:text-zinc-600 hover:bg-zinc-800 dark:hover:bg-zinc-100 hover:text-white dark:hover:text-black'}`}
                                    >
                                        <span>{opt === 'all' ? 'Todos' : opt}</span>
                                        {displayLimit === opt && <Check size={10} strokeWidth={4} />}
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
