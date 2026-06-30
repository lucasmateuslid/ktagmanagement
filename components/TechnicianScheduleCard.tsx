import React from 'react';
import { Schedule, Technician } from '../types';
import { Phone, CheckCircle2, XCircle, Wrench, Calendar, MapPin, Clock } from 'lucide-react';
import { getStatusStyle } from '../pages/schedules/utils/scheduleStatusUtils';
import { useNotification } from '../contexts/NotificationContext';

export const TechnicianScheduleCard: React.FC<{
  item: Schedule;
  technicians: Technician[];
  onClick: (item: Schedule) => void;
}> = ({ item, technicians, onClick }) => {
  const { addNotification } = useNotification();
  const styleConfig = getStatusStyle(item.status);

  // Status cor visualização de pílula (customizada baseada nas prints)
  let statusColor = "bg-amber-400";
  if (item.status === "Concluída") statusColor = "bg-emerald-500";
  if (item.status === "Cancelada") statusColor = "bg-red-600";
  if (item.status === "Técnico no local") statusColor = "bg-cyan-400";

  return (
    <div 
      onClick={() => onClick(item)} 
      className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4 relative overflow-hidden"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-2 ${statusColor}`} />
      
      <div className="pl-3 space-y-3">
         <div className="flex justify-between items-start">
             <div>
                <p className="text-[10px] font-black tracking-widest uppercase flex items-center gap-1 text-zinc-500">
                    <Wrench size={12} /> {item.serviceType}
                </p>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-black text-zinc-900 dark:text-white flex gap-1">
                        <span className="text-zinc-400"><FileTextIcon size={16}/></span> 
                        {item.id.substring(0,4)}/2026
                    </span>
                </div>
             </div>
             <div className="flex gap-2">
                 <a 
                    href={`tel:${item.clientPhone?.replace(/\D/g, '')}`} 
                    onClick={e => e.stopPropagation()} 
                    className="w-8 h-8 rounded bg-red-600 text-white flex items-center justify-center p-1.5 shadow-sm"
                 >
                    <Phone size={14} />
                 </a>
                 <a 
                    href={`https://wa.me/55${item.clientPhone?.replace(/\D/g, '')}`} 
                    target="_blank" rel="noreferrer" 
                    onClick={e => e.stopPropagation()} 
                    className="w-8 h-8 rounded bg-green-500 text-white flex items-center justify-center p-1.5 shadow-sm"
                 >
                    <WhatsappIcon />
                 </a>
             </div>
         </div>

         <div className="text-[11px] font-bold text-zinc-600 flex items-center gap-2 mb-1">
             <Calendar size={14} /> 
             {item.confirmedDate || item.preferredDate} - {item.confirmedTime || item.preferredTime}
         </div>

         <div className="text-xs space-y-1">
            <p><span className="font-bold text-zinc-900 dark:text-white">Cliente:</span> {item.clientName}</p>
            <p><span className="font-bold text-zinc-900 dark:text-white">Veículo:</span> {item.vehicleModel} / {item.vehiclePlate}</p>
         </div>
      </div>
    </div>
  );
};

// Utils
const FileTextIcon = ({size}: {size: number}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
)

const WhatsappIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
)
