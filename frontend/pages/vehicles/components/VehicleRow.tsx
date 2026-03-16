
import React from 'react';
import { Vehicle, Tag, VehicleCategory, Client } from '../../../types';
import { Edit2, Trash2, Truck, Bike, Car, Calendar, CheckSquare, Square } from 'lucide-react';

interface VehicleRowProps {
  vehicle: Vehicle;
  tags: Tag[];
  categories: VehicleCategory[];
  clients: Client[];
  isReadOnly: boolean;
  isSelected: boolean;
  toggleSelect: (id: string) => void;
  onEdit: (v: Vehicle) => void;
  onDelete: (id: string) => void;
}

export const VehicleRow = React.memo(({ vehicle, tags, categories, clients, onEdit, onDelete, isReadOnly, isSelected, toggleSelect }: VehicleRowProps) => {
  const tag = tags.find((t: any) => t.id === vehicle.tagId);
  const client = clients.find((c: any) => c.id === vehicle.clientId);
  const cat = categories.find((c: any) => c.id === vehicle.type);
  
  const getIcon = (size = 16) => {
    if (cat?.fipeType === 'caminhoes') return <Truck size={size} />;
    if (cat?.fipeType === 'motos') return <Bike size={size} />;
    return <Car size={size} />;
  };

  return (
    <div 
        onClick={() => !isReadOnly && toggleSelect && toggleSelect(vehicle.id)}
        className={`flex flex-col md:flex-row items-start md:items-center px-4 md:px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 transition-colors group gap-3 md:gap-0 cursor-pointer ${isSelected ? 'bg-primary-500/5 dark:bg-primary-500/10' : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30'}`}
    >
      {/* PLACA & STATUS */}
      <div className="w-full md:w-[20%] shrink-0 flex items-center justify-between md:justify-start gap-4">
        {!isReadOnly && (
            <div className="hidden md:flex items-center text-zinc-400 group-hover:text-primary-500 transition-colors">
                {isSelected ? <CheckSquare size={18} className="text-primary-500" /> : <Square size={18} />}
            </div>
        )}
        <div className="flex items-center gap-3 md:gap-4">
            <div className="flex flex-col gap-1 min-w-0">
                <div className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-mono font-black text-[12px] md:text-xs">
                    {vehicle.plate}
                </div>
                <div className="flex gap-1">
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded text-center tracking-widest text-white shrink-0 ${
                        vehicle.status === 'active' ? 'bg-emerald-500' : vehicle.status === 'stolen' ? 'bg-red-500' : 'bg-amber-500'
                    }`}>
                        {vehicle.status === 'active' ? 'ATIVO' : vehicle.status === 'stolen' ? 'ROUBO' : 'MANUT.'}
                    </span>
                </div>
            </div>
            <div className="hidden sm:block p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-400 group-hover:text-primary-500 transition-colors">
                {getIcon(14)}
            </div>
        </div>
        {/* Mobile Actions - Ocultar se readonly */}
        {!isReadOnly && (
            <div className="flex md:hidden gap-1">
                <button onClick={(e) => { e.stopPropagation(); onEdit(vehicle); }} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-400 hover:text-primary-500"><Edit2 size={16}/></button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(vehicle.id); }} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-500"><Trash2 size={16}/></button>
            </div>
        )}
      </div>

      {/* VEÍCULO */}
      <div className="w-full md:flex-1 md:w-[30%] px-0 md:px-3 overflow-hidden">
        <div className="flex items-center gap-2 md:hidden mb-1">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Veículo:</span>
        </div>
        <h3 className="font-black text-zinc-900 dark:text-white uppercase text-sm md:text-xs truncate leading-tight">{vehicle.model}</h3>
        <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] md:text-[8px] font-bold text-zinc-400 uppercase tracking-widest truncate">{cat?.name || 'VEÍCULO'}</p>
            {vehicle.ownershipStatus && (
                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-widest ${vehicle.ownershipStatus === 'purchased' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'}`}>
                    {vehicle.ownershipStatus === 'purchased' ? 'ADQUIRIDO' : 'COMODATO'}
                </span>
            )}
        </div>
      </div>

      {/* CLIENTE */}
      <div className="w-full md:w-[25%] px-0 md:px-2 overflow-hidden mt-1 md:mt-0">
        <div className="flex items-center gap-2 md:hidden mb-1">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cliente:</span>
        </div>
        <p className="text-xs md:text-[10px] font-black text-zinc-900 dark:text-white uppercase truncate">{client?.name || 'SEM VÍNCULO'}</p>
        {client && <p className="text-[10px] md:text-[8px] text-zinc-400 font-mono tracking-tighter truncate">{client.cpf}</p>}
      </div>

      {/* RESPONSÁVEL E DATA - Visível só para operadores */}
      {!isReadOnly && (
          <div className="w-full md:w-[15%] flex flex-row md:flex-col justify-between md:justify-center items-center md:items-start mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800">
             <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase truncate">
               {vehicle.updatedBy || 'SISTEMA'}
             </span>
             <span className="text-[10px] md:text-[8px] font-bold text-zinc-400 uppercase tracking-widest md:mt-0.5 flex items-center gap-1">
               <Calendar size={10} className="md:w-2 md:h-2" /> {new Date(vehicle.createdAt).toLocaleDateString()}
             </span>
          </div>
      )}

      {/* AÇÕES DESKTOP */}
      {!isReadOnly && (
          <div className="hidden md:flex w-[10%] justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); onEdit(vehicle); }} className="p-1.5 md:p-2 text-zinc-300 hover:text-primary-500 transition-colors"><Edit2 size={14}/></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(vehicle.id); }} className="p-1.5 md:p-2 text-zinc-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
          </div>
      )}
    </div>
  );
});
