
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag as TagIcon, Car, Search, ChevronRight, Bike, Truck } from 'lucide-react';
import { Vehicle, VehicleCategory } from '../../../types';

const MotionDiv = motion.div as any;

interface SearchDropdownProps {
    isVisible: boolean;
    items: any[];
    fleetLocations: any[];
    clients: any[];
    categories: VehicleCategory[];
    userRole?: string;
    onSelect: (tagId: string) => void;
}

export const SearchDropdown: React.FC<SearchDropdownProps> = ({ isVisible, items, fleetLocations, clients, categories, userRole, onSelect }) => {
    
    const getVehicleIcon = (typeId: string) => {
        const cat = categories.find(c => c.id === typeId);
        if (!cat) return <Car size={20} />;
        
        switch (cat.fipeType) {
            case 'motos': return <Bike size={20} />;
            case 'caminhoes': return <Truck size={20} />;
            default: return <Car size={20} />;
        }
    };

    const getStatusColor = (tagId: string) => {
        const loc = fleetLocations.find(l => l.tagId === tagId);
        if (!loc || !loc.timestamp) return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700';
        
        const now = Date.now();
        const diffMs = now - loc.timestamp;
        const diffMin = diffMs / 60000;
        const diffHours = diffMin / 60;

        if (diffMin <= 30) {
            // Verde Claro (Online recente)
            return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
        } else if (diffHours <= 3) {
            // Amarelo (30min a 3h)
            return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
        } else if (diffHours <= 12) {
            // Laranja (3h a 12h)
            return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
        } else {
            // Vermelho (+12h)
            return 'bg-red-500/10 text-red-500 border-red-500/20';
        }
    };

    const getTimeAgoText = (timestamp?: number) => {
        if (!timestamp) return 'Sem conexão';
        const diffMs = Date.now() - timestamp;
        if (diffMs < 0) return 'Agora';
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60) return `${diffMins}m atrás`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h atrás`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d atrás`;
    };

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
                         const loc = fleetLocations.find(l => l.tagId === item.id);
                         return (
                            <button key={item.id} onClick={() => onSelect(item.id)} className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/5 rounded-2xl transition-all group text-left border-l-4 border-transparent hover:border-primary-500">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700">
                                        <TagIcon size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-black text-zinc-900 dark:text-white uppercase leading-none mb-1">{item.name}</div>
                                        <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest truncate">
                                            Serial: {item.serial} • <span className="text-amber-500">ESTOQUE</span> • Atualizado: {getTimeAgoText(loc?.timestamp)}
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
                         const loc = fleetLocations.find(l => l.tagId === v.tagId);
                         return (
                            <button key={v.id} onClick={() => onSelect(v.tagId!)} className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/5 rounded-2xl transition-all group text-left">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${getStatusColor(v.tagId!)}`}>
                                        {getVehicleIcon(v.type)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-black text-zinc-900 dark:text-white uppercase leading-none mb-1">{v.plate}</div>
                                        <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest truncate">
                                            {v.model} {cliName && userRole !== 'client' ? `• ${cliName}` : ''} • Atualizado: {getTimeAgoText(loc?.timestamp)}
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
