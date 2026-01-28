
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag as TagIcon, Car, Search, ChevronRight } from 'lucide-react';
import { Vehicle } from '../../../types';

const MotionDiv = motion.div as any;

interface SearchDropdownProps {
    isVisible: boolean;
    items: any[];
    fleetLocations: any[];
    clients: any[];
    userRole?: string;
    onSelect: (tagId: string) => void;
}

export const SearchDropdown: React.FC<SearchDropdownProps> = ({ isVisible, items, fleetLocations, clients, userRole, onSelect }) => {
    return (
        <AnimatePresence>
            {isVisible && (
              <MotionDiv initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="absolute top-full mt-3 left-0 right-0 bg-white dark:bg-zinc-900 rounded-[28px] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden max-h-[40vh] overflow-y-auto p-2"
              >
                 {items.length === 0 ? <div className="py-10 text-center text-zinc-400 text-[10px] font-black uppercase tracking-widest opacity-40 italic">Nenhum resultado encontrado</div> : 
                   items.map((item: any) => {
                     // Lógica de Renderização Mista (Veículo vs Tag)
                     if (item.isTag) {
                         // Renderização de TAG SOLTA
                         return (
                            <button key={item.id} onClick={() => onSelect(item.tagId)} className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/5 rounded-2xl transition-all group text-left border-l-4 border-transparent hover:border-primary-500">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700">
                                        <TagIcon size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-black text-zinc-900 dark:text-white uppercase leading-none mb-1">{item.name}</div>
                                        <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest truncate">
                                            Serial: {item.serial} • <span className="text-amber-500">ESTOQUE (SEM VÍNCULO)</span>
                                        </div>
                                    </div>
                                </div>
                                <Search size={16} className="text-zinc-300 group-hover:text-primary-500 shrink-0" />
                            </button>
                         );
                     } else {
                         // Renderização de VEÍCULO
                         const v = item as Vehicle;
                         const cliName = clients.find(c => c.id === v.clientId)?.name;
                         return (
                            <button key={v.id} onClick={() => onSelect(v.tagId!)} className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/5 rounded-2xl transition-all group text-left">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${fleetLocations.some(l => l.tagId === v.tagId) ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700'}`}>
                                        <Car size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-black text-zinc-900 dark:text-white uppercase leading-none mb-1">{v.plate}</div>
                                        <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest truncate">
                                            {v.model} {cliName && userRole !== 'client' ? `• ${cliName}` : ''}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-zinc-300 group-hover:text-primary-500 shrink-0" />
                            </button>
                         );
                     }
                   })
                 }
              </MotionDiv>
            )}
        </AnimatePresence>
    );
};
