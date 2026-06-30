
import React, { useState, useEffect } from 'react';
import { Vehicle, Tag, VehicleCategory, Client } from '../../../types';
import { Edit2, Trash2, Truck, Bike, Car, Calendar, CheckSquare, Square, RefreshCw, CheckCircle2, Clock, BatteryCharging, Wifi, Share2 } from 'lucide-react';
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
  onShare?: (v: Vehicle) => void;
}

export const VehicleRow = React.memo(({ vehicle, tags, categories, clients, onEdit, onDelete, onShare, isReadOnly, isSelected, toggleSelect }: VehicleRowProps) => {
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
        className={`flex flex-col lg:flex-row items-stretch lg:items-center p-4 lg:px-6 lg:py-4 border-b border-zinc-100 dark:border-zinc-800 transition-colors group gap-4 lg:gap-0 ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} ${isSelected ? 'bg-primary-500/5 dark:bg-primary-500/10' : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30'}`}
    >
      {/* HEADER MOBILE & DESKTOP 1ST COL (PLACA/STATUS) */}
      <div className="w-full lg:w-[20%] shrink-0 flex items-center justify-between lg:justify-start gap-4">
        
        <div className="flex items-center gap-3 w-full lg:w-auto">
            {!isReadOnly && (
                <div className="text-zinc-400 group-hover:text-primary-500 transition-colors shrink-0">
                    {isSelected ? <CheckSquare size={18} className="text-primary-500" /> : <Square size={18} />}
                </div>
            )}
            <div className="flex flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-mono font-black text-sm lg:text-xs">
                        {vehicle.plate}
                    </div>
                    {tag && (
                        <div className="text-[9px] font-mono font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-1.5 py-0.5 rounded border border-zinc-100 dark:border-zinc-700 truncate max-w-[120px] hidden sm:block">
                            TAG: {tag.accessoryId || tag.imei || tag.name}
                        </div>
                    )}
                </div>
                <div className="flex gap-1">
                    <span className={`text-[9px] lg:text-[8px] font-black uppercase px-2 py-0.5 rounded text-center tracking-widest text-white shrink-0 ${
                        vehicle.status === 'active' ? 'bg-emerald-500' : vehicle.status === 'stolen' ? 'bg-red-500' : 'bg-amber-500'
                    }`}>
                        {vehicle.status === 'active' ? 'ATIVO' : vehicle.status === 'stolen' ? 'ROUBO' : 'MANUT.'}
                    </span>
                </div>
            </div>
        </div>

        {/* Mobile Actions/Data */}
        <div className="flex lg:hidden gap-1 shrink-0 items-center">
            {isReadOnly && timeAgo && (
                <span className="text-[10px] text-zinc-500 font-medium whitespace-nowrap bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                    <Clock size={10} className="inline mr-1" /> {timeAgo}
                </span>
            )}
            {!isReadOnly && (
                <>
                    <button onClick={(e) => { e.stopPropagation(); onEdit(vehicle); }} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-400 hover:text-primary-500"><Edit2 size={16}/></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(vehicle.id); }} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-500"><Trash2 size={16}/></button>
                </>
            )}
        </div>
      </div>

      {/* VEÍCULO */}
      <div className="w-full lg:flex-1 lg:w-[30%] px-0 lg:px-3 overflow-hidden flex items-start gap-3 border-t border-zinc-100 dark:border-zinc-800/50 pt-3 lg:border-none lg:pt-0">
        <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-400 group-hover:text-primary-500 transition-colors shrink-0 hidden sm:block mt-0.5">
            {getIcon(16)}
        </div>

        <div className="flex-1 min-w-0">
            <h3 className="font-black text-zinc-900 dark:text-white uppercase text-base lg:text-xs truncate leading-tight mb-0.5">{vehicle.model}</h3>
            
            <div className="flex items-center gap-2 mb-1.5">
                <p className="text-[11px] lg:text-[8px] font-bold text-zinc-400 uppercase tracking-widest truncate">{cat?.name || 'VEÍCULO'}</p>
                {vehicle.ownershipStatus && (
                    <span className={`text-[9px] lg:text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-widest ${vehicle.ownershipStatus === 'purchased' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'}`}>
                        {vehicle.ownershipStatus === 'purchased' ? 'ADQUIRIDO' : 'COMODATO'}
                    </span>
                )}
            </div>

            {/* BAT/SINAL in Veículo row block */}
            {vehicle.lastPosition && !isReadOnly && (
                <div className="flex flex-wrap items-center gap-2 mt-2 lg:mt-1.5 w-fit">
                    {vehicle.lastPosition.battery && (
                        <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded shadow-sm" title="Bateria">
                            <BatteryCharging size={10} className="text-zinc-500" />
                            <span className={`text-[9px] lg:text-[8px] font-black uppercase tracking-widest ${vehicle.lastPosition.battery.color}`}>
                                Bat: {vehicle.lastPosition.battery.label}
                            </span>
                        </div>
                    )}
                    {vehicle.lastPosition.conf !== undefined && (
                        <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded shadow-sm" title="Sinal Confidência">
                            <Wifi size={10} className="text-zinc-500" />
                            <span className="text-[9px] lg:text-[8px] font-black uppercase tracking-widest text-zinc-500">
                                Sinal: {vehicle.lastPosition.conf}
                            </span>
                        </div>
                    )}
                </div>
            )}
            
            {/* Show simple Tag info on mobile to cover space */}
            {tag && (
                <div className="lg:hidden flex items-center gap-2 mt-2 bg-zinc-50 dark:bg-zinc-800/80 p-1.5 rounded-lg border border-zinc-100 dark:border-zinc-700 w-fit">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">TAG</span>
                    <span className="text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300">{tag.accessoryId || tag.imei || tag.name}</span>
                </div>
            )}
        </div>
      </div>

      {/* CLIENTE (Apenas Operadores) */}
      {!isReadOnly && (
          <div className="w-full lg:w-[25%] px-0 lg:px-2 overflow-hidden flex flex-row lg:flex-col items-center lg:items-start justify-between lg:justify-start border-t border-zinc-100 dark:border-zinc-800/50 pt-3 lg:border-none lg:pt-0 mt-1 lg:mt-0">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest lg:hidden">Vínculo:</span>
            <div className="text-right lg:text-left min-w-0 max-w-[60%] lg:max-w-none">
                <p className="text-sm lg:text-[10px] font-black text-zinc-900 dark:text-white uppercase truncate">{client?.name || 'SEM VÍNCULO'}</p>
                {client && <p className="text-[11px] lg:text-[8px] text-zinc-500 lg:text-zinc-400 font-mono tracking-tighter truncate mt-0.5">{client.cpf}</p>}
            </div>
          </div>
      )}

      {/* DISPOSITIVO (Apenas Cliente - View ReadOnly) */}
      {isReadOnly && (
          <div className="w-full lg:w-[25%] px-0 lg:px-2 overflow-hidden flex flex-row lg:flex-col items-center lg:items-start justify-between lg:justify-start border-t border-zinc-100 dark:border-zinc-800/50 pt-3 lg:border-none lg:pt-0 mt-1 lg:mt-0">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest lg:hidden">Rastreador:</span>
            <div className="text-right lg:text-left min-w-0">
                {tag ? (
                    <>
                        <p className="text-sm lg:text-[10px] font-black text-zinc-900 dark:text-white uppercase truncate">
                            {tag.accessoryId || tag.imei || tag.name}
                        </p>
                        {vehicle.lastPosition?.battery && (
                            <div className="flex items-center justify-end lg:justify-start gap-1 mt-0.5">
                                <BatteryCharging size={10} className="text-zinc-400" />
                                <span className={`text-[10px] lg:text-[8px] font-black uppercase tracking-widest ${vehicle.lastPosition.battery.color}`}>
                                    {vehicle.lastPosition.battery.label}
                                </span>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-sm lg:text-[10px] font-black text-zinc-400 uppercase truncate">Nenhum</p>
                )}
            </div>
          </div>
      )}

      {/* RESPONSÁVEL E DATA - Visível só para operadores */}
      {!isReadOnly && (
          <div className="w-full lg:w-[15%] flex flex-row lg:flex-col justify-between lg:justify-center items-center lg:items-start border-t border-zinc-100 dark:border-zinc-800/50 pt-3 lg:border-none lg:pt-0 mt-1 lg:mt-0">
             <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest lg:hidden">Cadastro:</span>
             <div className="text-right lg:text-left">
                 <span className="block text-[11px] lg:text-[10px] font-black text-zinc-900 dark:text-white uppercase truncate mb-0.5">
                   {vehicle.updatedBy || 'SISTEMA'}
                 </span>
                 <span className="flex items-center justify-end lg:justify-start gap-1 text-[10px] lg:text-[8px] font-bold text-zinc-500 lg:text-zinc-400 uppercase tracking-widest">
                   <Calendar size={10} className="lg:w-2 lg:h-2" /> {new Date(vehicle.createdAt).toLocaleDateString()}
                 </span>
             </div>
          </div>
      )}

      {/* AÇÕES DESKTOP */}
      {!isReadOnly && (
          <div className="hidden lg:flex w-[10%] justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onShare && (
              <button onClick={(e) => { e.stopPropagation(); onShare(vehicle); }} title="Compartilhar Acesso Temporário" className="p-1.5 lg:p-2 text-zinc-300 hover:text-blue-500 transition-colors">
                <Share2 size={14}/>
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onEdit(vehicle); }} className="p-1.5 lg:p-2 text-zinc-300 hover:text-primary-500 transition-colors"><Edit2 size={14}/></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(vehicle.id); }} className="p-1.5 lg:p-2 text-zinc-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
          </div>
      )}

      {/* AÇÕES CLIENTE - Refresh e Update Map */}
      {isReadOnly && (
          <div className="w-full lg:w-[25%] flex justify-end lg:justify-center border-t border-zinc-100 dark:border-zinc-800/50 pt-3 lg:border-none lg:pt-0 mt-3 lg:mt-0">
             {tag && (
                 <button 
                     onClick={handleUpdateLocation}
                     disabled={isUpdating}
                     className={`flex items-center justify-center gap-1.5 px-4 lg:px-3 py-2.5 lg:py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all w-full lg:w-auto ${
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
                     {isUpdating ? 'Atualizando...' : updateSuccess ? 'Posição Atualizada' : 'Atualizar Posição GPS'}
                 </button>
             )}
          </div>
      )}
    </div>
  );
});
