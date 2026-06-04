
import React, { useState, useEffect } from 'react';
import { Vehicle, Tag, VehicleCategory, Client } from '../../../types';
import { Edit2, Trash2, Truck, Bike, Car, Calendar, CheckSquare, Square, RefreshCw, CheckCircle2, Clock, BatteryCharging, Wifi } from 'lucide-react';
import { fetchTagLocation } from '../../../services/api';
import { storage } from '../../../services/storage';

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
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [timeAgo, setTimeAgo] = useState<string>('');

  const updateTimeAgo = () => {
    if (vehicle.lastPosition?.timestamp) {
      const diff = Date.now() - vehicle.lastPosition.timestamp;
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) setTimeAgo('agora mesmo');
      else if (minutes < 60) setTimeAgo(`há ${minutes} min`);
      else {
        const hours = Math.floor(minutes / 60);
        if (hours < 24) setTimeAgo(`há ${hours} h`);
        else {
          const days = Math.floor(hours / 24);
          setTimeAgo(`há ${days} d`);
        }
      }
    } else {
      setTimeAgo('Sem localização');
    }
  };

  useEffect(() => {
    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 60000);
    return () => clearInterval(interval);
  }, [vehicle.lastPosition?.timestamp]);

  const handleUpdateLocation = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tag || isUpdating) return;
    
    setIsUpdating(true);
    setUpdateSuccess(false);
    try {
      const results = await fetchTagLocation(tag);
      if (results && results.length > 0) {
        const location = { ...results[0], tagId: tag.id, id: tag.id };
        await storage.updateVehiclePosition(vehicle.id, location as any);
        setUpdateSuccess(true);
        setTimeout(() => setUpdateSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Failed to update location", error);
    } finally {
      setIsUpdating(false);
    }
  };
  
  const getIcon = (size = 16) => {
    if (cat?.fipeType === 'caminhoes') return <Truck size={size} />;
    if (cat?.fipeType === 'motos') return <Bike size={size} />;
    return <Car size={size} />;
  };

  return (
    <div 
        onClick={() => !isReadOnly && toggleSelect && toggleSelect(vehicle.id)}
        className={`flex flex-col md:flex-row items-start md:items-center px-4 md:px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 transition-colors group gap-3 md:gap-0 ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} ${isSelected ? 'bg-primary-500/5 dark:bg-primary-500/10' : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30'}`}
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
                <div className="flex items-center gap-2">
                    <div className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-mono font-black text-[12px] md:text-xs">
                        {vehicle.plate}
                    </div>
                    {tag && (
                        <div className="text-[9px] font-mono font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-1.5 py-0.5 rounded border border-zinc-100 dark:border-zinc-700">
                            TAG: {tag.accessoryId || tag.imei || tag.name}
                        </div>
                    )}
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
        
        {/* NOVO CÓDIGO - INÍCIO */}
        {vehicle.lastPosition && (
            <div className="flex items-center gap-3 mt-1.5 bg-zinc-50 dark:bg-zinc-800/50 p-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800 w-fit">
                {vehicle.lastPosition.battery && (
                    <div className="flex items-center gap-1" title="Bateria">
                        <BatteryCharging size={10} className="text-zinc-500" />
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-widest ${vehicle.lastPosition.battery.color}`}>
                            Bat: {vehicle.lastPosition.battery.label}
                        </span>
                    </div>
                )}
                {vehicle.lastPosition.conf !== undefined && (
                    <div className="flex items-center gap-1" title="Sinal Confidência">
                        <Wifi size={10} className="text-zinc-500" />
                        <span className="text-[8px] font-black uppercase text-zinc-500">
                            Sinal: {vehicle.lastPosition.conf}
                        </span>
                    </div>
                )}
            </div>
        )}
        {/* NOVO CÓDIGO - FIM */}
      </div>

      {/* CLIENTE (Apenas Operadores) */}
      {!isReadOnly && (
          <div className="w-full md:w-[25%] px-0 md:px-2 overflow-hidden mt-1 md:mt-0">
            <div className="flex items-center gap-2 md:hidden mb-1">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cliente:</span>
            </div>
            <p className="text-xs md:text-[10px] font-black text-zinc-900 dark:text-white uppercase truncate">{client?.name || 'SEM VÍNCULO'}</p>
            {client && <p className="text-[10px] md:text-[8px] text-zinc-400 font-mono tracking-tighter truncate">{client.cpf}</p>}
          </div>
      )}

      {/* DISPOSITIVO (Apenas Cliente) */}
      {isReadOnly && (
          <div className="w-full md:w-[25%] px-0 md:px-2 overflow-hidden mt-1 md:mt-0">
            <div className="flex items-center gap-2 md:hidden mb-1">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Dispositivo:</span>
            </div>
            {tag ? (
                <>
                    <p className="text-xs md:text-[10px] font-black text-zinc-900 dark:text-white uppercase truncate">
                        TAG: {tag.accessoryId || tag.imei || tag.name}
                    </p>
                    {vehicle.lastPosition?.battery && (
                        <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] md:text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Bateria:</span>
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-widest ${vehicle.lastPosition.battery.color}`}>
                                {vehicle.lastPosition.battery.label}
                            </span>
                        </div>
                    )}
                </>
            ) : (
                <p className="text-xs md:text-[10px] font-black text-zinc-400 uppercase truncate">Sem Dispositivo</p>
            )}
          </div>
      )}

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

      {/* AÇÕES CLIENTE */}
      {isReadOnly && (
          <div className="w-full md:w-[25%] flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center mt-3 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800 gap-2">
             <span className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1 font-medium">
                 <Clock size={12} /> {timeAgo}
             </span>
             {tag && (
                 <button 
                     onClick={handleUpdateLocation}
                     disabled={isUpdating}
                     className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                         updateSuccess 
                             ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' 
                             : 'bg-primary-500 text-white hover:bg-primary-600 shadow-sm'
                     }`}
                 >
                     {isUpdating ? (
                         <RefreshCw size={12} className="animate-spin" />
                     ) : updateSuccess ? (
                         <CheckCircle2 size={12} />
                     ) : (
                         <RefreshCw size={12} />
                     )}
                     {isUpdating ? 'Atualizando...' : updateSuccess ? 'Atualizado' : 'Atualizar Tag'}
                 </button>
             )}
          </div>
      )}
    </div>
  );
});
