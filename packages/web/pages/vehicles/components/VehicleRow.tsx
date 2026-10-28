
import React, { useState, useEffect } from 'react';
import { Vehicle, Tag, VehicleCategory, Client } from '../../../types';
import { Edit2, Trash2, Truck, Bike, Car, Calendar, CheckSquare, Square, RefreshCw, CheckCircle2, Clock, BatteryCharging, Wifi, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { trackingApi } from '../../../services/trackingApi';
import { useNotification } from '../../../contexts/NotificationContext';

const ACTION_BTN = 'inline-flex h-10 w-10 items-center justify-center rounded-lg text-fg-3 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';

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
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const tag = tags.find((t: any) => t.id === vehicle.tagId);
  const trackingId = tag?.id || (vehicle.trackerId ? `tracker:${vehicle.trackerId}` : '');
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
    if ((!tag && !vehicle.trackerId) || isUpdating) return;
    
    setIsUpdating(true);
    setUpdateSuccess(false);
    try {
      const result = tag ? await trackingApi.refreshTag(tag.id) : await trackingApi.vehiclePosition(vehicle.id);
      const status = 'status' in result ? result.status : result.degraded ? 'error' : 'unchanged';
      const point = 'position' in result ? result.position : result;
      const age = point?.timestamp ? ` Última posição há ${Math.max(0, Math.floor((Date.now() - Number(point.timestamp)) / 60_000))} min.` : '';
      addNotification(status === 'error' ? 'error' : status === 'updated' ? 'success' : 'info',
        status === 'updated' ? 'Posição atualizada' : status === 'error' ? 'Sem resposta' : 'Sem nova posição',
        `${result.error || (status === 'updated' ? 'Nova posição recebida.' : 'A posição não mudou.')}${age}`);
      setUpdateSuccess(status === 'updated');
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to update location", error);
      addNotification('error', 'Falha na atualização', error instanceof Error ? error.message : 'Não foi possível consultar o equipamento.');
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
        className={`grid grid-cols-1 md:items-center px-4 md:px-6 py-4 border-b border-line last:border-b-0 transition-colors group even:bg-surface-2/40 gap-3 md:gap-4 ${isReadOnly ? 'md:grid-cols-[minmax(11rem,1.2fr)_minmax(14rem,2fr)_minmax(12rem,1.3fr)_minmax(12rem,1fr)] cursor-default' : 'md:grid-cols-[minmax(12rem,1.3fr)_minmax(15rem,2fr)_minmax(12rem,1.3fr)_minmax(10rem,1fr)_7rem] cursor-pointer'} ${isSelected ? 'bg-primary-500/5 dark:bg-primary-500/10' : 'hover:bg-primary-500/5'}`}
    >
      {/* PLACA & STATUS */}
    <div className="w-full min-w-0 flex items-center justify-between md:justify-start gap-4">
        {!isReadOnly && (
            <div className="hidden md:flex items-center text-fg-3 group-hover:text-primary-500 transition-colors">
                {isSelected ? <CheckSquare size={18} className="text-accent" /> : <Square size={18} />}
            </div>
        )}
        <div className="flex items-center gap-3 md:gap-4">
            <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        title="Abrir ficha do veículo"
                        onClick={(e) => { e.stopPropagation(); navigate(`/vehicles/${encodeURIComponent(vehicle.id)}`); }}
                        className="bg-surface-2 px-2.5 py-1 rounded-lg border border-line text-fg-1 font-mono font-black text-sm tracking-wide hover:border-primary-500/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                        {vehicle.plate}
                    </button>
                    {tag && (
                        <div className="text-2xs font-mono font-bold text-fg-2 bg-surface-2 px-1.5 py-0.5 rounded border border-line">
                            TAG: {tag.accessoryId || tag.imei || tag.name}
                        </div>
                    )}
                    {vehicle.trackerId && <div className="text-2xs font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded border border-sky-100 dark:border-sky-900" title={`Rastreador ${vehicle.trackerId}`}>RASTREADOR</div>}
                </div>
                <div className="flex gap-1">
                    <span className={`text-2xs font-black uppercase px-1.5 py-0.5 rounded text-center tracking-widest text-white shrink-0 ${
                        vehicle.status === 'active' ? 'bg-emerald-500' : vehicle.status === 'stolen' ? 'bg-red-500' : 'bg-primary-500'
                    }`}>
                        {vehicle.status === 'active' ? 'ATIVO' : vehicle.status === 'stolen' ? 'ROUBO' : 'MANUT.'}
                    </span>
                </div>
            </div>
        </div>
        {/* Mobile Actions - Ocultar se readonly */}
        {!isReadOnly && (
            <div className="flex md:hidden gap-1">
                {trackingId && <button type="button" aria-label={`Histórico de ${vehicle.plate}`} onClick={(e) => { e.stopPropagation(); navigate(`/map?tagId=${encodeURIComponent(trackingId)}&history=1`); }} className="p-2 bg-surface-2 rounded-lg text-fg-3 hover:text-cyan-500"><History size={16}/></button>}
                <button type="button" aria-label={`Editar ${vehicle.plate}`} onClick={(e) => { e.stopPropagation(); onEdit(vehicle); }} className="p-2 bg-surface-2 rounded-lg text-fg-3 hover:text-primary-500"><Edit2 size={16}/></button>
                <button type="button" aria-label={`Excluir ${vehicle.plate}`} onClick={(e) => { e.stopPropagation(); onDelete(vehicle.id); }} className="p-2 bg-surface-2 rounded-lg text-fg-3 hover:text-red-500"><Trash2 size={16}/></button>
            </div>
        )}
      </div>

      {/* VEÍCULO */}
    <div className="w-full min-w-0 px-0 overflow-hidden flex items-start gap-3">
        <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-fg-3 group-hover:text-accent transition-colors">
            {getIcon(16)}
        </div>
        <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 md:hidden mb-1">
            <span className="text-2xs font-black text-fg-3 uppercase tracking-widest">Veículo:</span>
        </div>
        <h3 className="font-black text-fg-1 uppercase text-sm truncate leading-tight">{vehicle.model}</h3>
        <div className="flex items-center gap-2 mt-0.5">
            <p className="text-2xs font-bold text-fg-2 uppercase tracking-widest truncate">{cat?.name || 'VEÍCULO'}</p>
            {vehicle.ownershipStatus && (
                <span className={`text-2xs font-black uppercase px-1.5 py-0.5 rounded tracking-widest ${vehicle.ownershipStatus === 'purchased' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                    {vehicle.ownershipStatus === 'purchased' ? 'ADQUIRIDO' : 'COMODATO'}
                </span>
            )}
        </div>
        
        {/* NOVO CÓDIGO - INÍCIO */}
        {vehicle.lastPosition && (
            <div className="flex items-center gap-3 mt-1.5 bg-surface-2 p-1.5 rounded-lg border border-line w-fit">
                {vehicle.lastPosition.battery && (
                    <div className="flex items-center gap-1" title="Bateria">
                        <BatteryCharging size={10} className="text-fg-2" />
                        <span className={`text-2xs font-black uppercase px-1.5 py-0.5 rounded tracking-widest ${vehicle.lastPosition.battery.color}`}>
                            Bat: {vehicle.lastPosition.battery.label}
                        </span>
                    </div>
                )}
                {vehicle.lastPosition.conf !== undefined && (
                    <div className="flex items-center gap-1" title="Sinal Confidência">
                        <Wifi size={10} className="text-fg-2" />
                        <span className="text-2xs font-black uppercase text-fg-2">
                            Sinal: {vehicle.lastPosition.conf}
                        </span>
                    </div>
                )}
            </div>
        )}
        {/* NOVO CÓDIGO - FIM */}
        </div>
      </div>

      {/* CLIENTE (Apenas Operadores) */}
      {!isReadOnly && (
          <div className="w-full min-w-0 px-0 overflow-hidden mt-1 md:mt-0">
            <div className="flex items-center gap-2 md:hidden mb-1">
                <span className="text-2xs font-black text-fg-3 uppercase tracking-widest">Cliente:</span>
            </div>
            <p className="text-sm font-black text-fg-1 uppercase truncate">{client?.name || 'SEM VÍNCULO'}</p>
            {client && <p className="text-caption text-fg-2 font-mono truncate">{client.cpf}</p>}
          </div>
      )}

      {/* DISPOSITIVO (Apenas Cliente) */}
      {isReadOnly && (
          <div className="w-full min-w-0 px-0 overflow-hidden mt-1 md:mt-0">
            <div className="flex items-center gap-2 md:hidden mb-1">
                <span className="text-2xs font-black text-fg-3 uppercase tracking-widest">Dispositivo:</span>
            </div>
            {tag || vehicle.trackerId ? (
                <>
                    {tag && <p className="text-sm font-black text-fg-1 uppercase truncate">TAG: {tag.accessoryId || tag.imei || tag.name}</p>}
                    {vehicle.trackerId && <p className="text-sm font-black text-sky-600 dark:text-sky-400 uppercase truncate">RASTREADOR: {vehicle.trackerId}</p>}
                    {tag && vehicle.lastPosition?.battery && (
                        <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-2xs md:text-2xs font-bold text-fg-3 uppercase tracking-widest">Bateria:</span>
                            <span className={`text-2xs font-black uppercase px-1.5 py-0.5 rounded tracking-widest ${vehicle.lastPosition.battery.color}`}>
                                {vehicle.lastPosition.battery.label}
                            </span>
                        </div>
                    )}
                </>
            ) : (
                <p className="text-sm font-black text-fg-3 uppercase truncate">Sem Dispositivo</p>
            )}
          </div>
      )}

      {/* RESPONSÁVEL E DATA - Visível só para operadores */}
      {!isReadOnly && (
          <div className="w-full min-w-0 flex flex-row md:flex-col justify-between md:justify-center items-center md:items-start mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-line">
             <span className="text-xs font-black text-fg-1 uppercase truncate">
               {vehicle.updatedByName || vehicle.createdByName || 'SISTEMA'}
             </span>
             <span className="text-caption font-semibold text-fg-2 md:mt-0.5 flex items-center gap-1">
               <Calendar size={12} aria-hidden /> {new Date(vehicle.createdAt).toLocaleDateString()}
             </span>
          </div>
      )}

      {/* AÇÕES DESKTOP */}
      {!isReadOnly && (
          <div className="hidden md:flex w-full justify-end gap-1 opacity-100 transition-opacity">
            {trackingId && <button type="button" aria-label={`Histórico de ${vehicle.plate}`} onClick={(e) => { e.stopPropagation(); navigate(`/map?tagId=${encodeURIComponent(trackingId)}&history=1`); }} className={ACTION_BTN + " hover:text-info"} title="Histórico"><History size={16} aria-hidden/></button>}
            <button type="button" aria-label={`Editar ${vehicle.plate}`} onClick={(e) => { e.stopPropagation(); onEdit(vehicle); }} className={ACTION_BTN + " hover:text-accent"} title="Editar"><Edit2 size={16} aria-hidden/></button>
            <button type="button" aria-label={`Excluir ${vehicle.plate}`} onClick={(e) => { e.stopPropagation(); onDelete(vehicle.id); }} className={ACTION_BTN + " hover:text-danger"} title="Excluir"><Trash2 size={16} aria-hidden/></button>
          </div>
      )}

      {/* AÇÕES CLIENTE */}
      {isReadOnly && (
          <div className="w-full min-w-0 flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center mt-3 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-line gap-2">
             <span className="text-2xs text-fg-2 flex items-center gap-1 font-medium">
                 <Clock size={12} /> {timeAgo}
             </span>
             {trackingId && (
                 <div className="flex gap-2"><button onClick={(e) => { e.stopPropagation(); navigate(`/map?tagId=${encodeURIComponent(trackingId)}&history=1`); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2xs font-bold uppercase bg-surface-2 text-fg-2"><History size={12}/> Histórico</button>{tag && <button
                     onClick={handleUpdateLocation}
                     disabled={isUpdating}
                     className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-2xs font-bold uppercase tracking-wider transition-all ${
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
                 </button>}</div>
             )}
          </div>
      )}
    </div>
  );
});
VehicleRow.displayName = 'VehicleRow';
