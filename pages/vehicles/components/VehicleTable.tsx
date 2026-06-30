
import React from 'react';
import { Vehicle, Tag, VehicleCategory, Client } from '../../../types';
import { VehicleRow } from './VehicleRow';
import { Car } from 'lucide-react';

interface VehicleTableProps {
  vehicles: Vehicle[];
  tags: Tag[];
  categories: VehicleCategory[];
  clients: Client[];
  isReadOnly: boolean;
  selectedVehicles: Set<string>;
  toggleSelect: (id: string) => void;
  onEdit: (v: Vehicle) => void;
  onDelete: (id: string) => void;
}

export const VehicleTable: React.FC<VehicleTableProps> = ({ 
  vehicles, tags, categories, clients, isReadOnly, selectedVehicles, toggleSelect, onEdit, onDelete 
}) => {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
         {/* CABEÇALHO TABELA - VISÍVEL APENAS EM DESKTOP */}
         <div className="hidden lg:flex px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-950/20 text-[8px] font-black uppercase tracking-widest text-zinc-400">
            <div className="w-[20%] shrink-0">Placa & Status</div>
            <div className="w-[30%] px-3">Veículo</div>
            <div className="w-[25%] px-2">Cliente</div>
            {!isReadOnly && <div className="w-[15%]">Responsável & Data</div>}
            {!isReadOnly && <div className="w-[10%] text-right">Ações</div>}
         </div>
         <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {vehicles.length === 0 ? (
               <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                  <Car size={48} />
                  <span className="text-[10px] font-black uppercase">Nenhum veículo localizado</span>
               </div>
            ) : (
              vehicles.map(v => (
                <VehicleRow 
                    key={v.id} 
                    vehicle={v} 
                    tags={tags} 
                    categories={categories} 
                    clients={clients} 
                    isReadOnly={isReadOnly}
                    isSelected={selectedVehicles.has(v.id)}
                    toggleSelect={toggleSelect}
                    onEdit={onEdit} 
                    onDelete={onDelete} 
                />
              ))
            )}
         </div>
    </div>
  );
};
