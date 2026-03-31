
import React from 'react';
import { Schedule, Technician } from '../../../../types';
import { User, UserCircle2, Wrench, MapPin, SearchCheck } from 'lucide-react';
import { getStatusStyle } from '../../utils/scheduleStatusUtils';
import { getTimeElapsedStr, getDisplayDate, isScheduleOverdue } from '../../utils/scheduleTimeUtils';
import { calculateServiceValue } from '../../utils/scheduleFinancialUtils';

interface AdminScheduleCardProps {
  item: Schedule;
  technicians: Technician[];
  onClick: (item: Schedule) => void;
}

export const AdminScheduleCard: React.FC<AdminScheduleCardProps> = ({ item, technicians, onClick }) => {
  const assignedTech = technicians.find(t => t.id === item.technicianId);
  const styleConfig = getStatusStyle(item.status);
  
  const isUnderAnalysis = ['Em análise', 'Em orçamento'].includes(item.status);
  const analysisHistory = [...item.history].reverse().find(h => 
      h.action === 'Assumiu' || 
      h.action === 'Verificando' || 
      h.statusSnapshot === 'Em análise' || 
      h.statusSnapshot === 'Em orçamento' ||
      (h.action === 'Confirmou' && item.status === 'Confirmada')
  );

  const showAnalysisInfo = isUnderAnalysis && analysisHistory?.actionBy;
  const responsibleName = analysisHistory?.actionBy;
  const techName = assignedTech ? assignedTech.name : 'A definir';
  const techColor = assignedTech ? (assignedTech.color || '#3b82f6') : '#e4e4e7';
  
  const timeElapsedStr = getTimeElapsedStr(item.createdAt);
  const displayDate = getDisplayDate(item);
  const isOverdue = isScheduleOverdue(item);

  const serviceVal = calculateServiceValue(item, assignedTech);
  const totalVal = serviceVal + (item.displacementValue || 0);

  return (
    <div onClick={() => onClick(item)} className={`bg-white dark:bg-zinc-900 p-6 rounded-[24px] border shadow-sm hover:shadow-xl transition-all cursor-pointer relative group border-l-[6px] flex flex-col h-full min-h-[340px] ${isOverdue ? 'border-red-500/50 dark:border-red-500/50 ring-1 ring-red-500/20' : 'border-zinc-200 dark:border-zinc-800'}`} style={{ borderLeftColor: isOverdue ? '#ef4444' : styleConfig.color }}>
        {/* Header: Badge Status + Date/Time */}
        <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest w-fit ${styleConfig.badgeBg} ${styleConfig.badgeText}`}>
                        {item.status}
                    </span>
                    {isOverdue && (
                        <span className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 flex items-center gap-1 border border-red-200 dark:border-red-800 animate-pulse">
                            Atenção: +24h
                        </span>
                    )}
                </div>
            </div>
            <div className="text-right">
                <div className="text-[10px] font-bold text-zinc-400">{displayDate}</div>
                <div className="text-lg font-black text-zinc-900 dark:text-white leading-none">{timeElapsedStr}</div>
            </div>
        </div>

        <div className="flex items-center gap-3 mb-1">
            <span className="text-[10px] font-mono text-zinc-300 dark:text-zinc-600"># {item.id.slice(0, 2).toUpperCase()}</span>
        </div>

        <h2 className="text-4xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-1 truncate" title={item.vehiclePlate}>{item.vehiclePlate}</h2>
        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-6 truncate" title={item.vehicleModel}>{item.vehicleModel}</p>

        <div className="space-y-4 mb-6 flex-1">
            <div className="flex items-start gap-3">
                <div className="mt-0.5"><User size={14} className="text-zinc-300"/></div>
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">SOLICITANTE:</span>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase truncate" title={item.requesterName}>{item.requesterName}</span>
                </div>
            </div>
            <div className="flex items-start gap-3">
                <div className="mt-0.5"><UserCircle2 size={14} className="text-zinc-300"/></div>
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">CLIENTE:</span>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase truncate" title={item.clientName || 'N/A'}>{item.clientName || 'N/A'}</span>
                    {item.clientPhone && <span className="text-[9px] font-mono text-zinc-400 truncate">{item.clientPhone}</span>}
                </div>
            </div>
            <div className="flex items-start gap-3">
                <div className="mt-0.5"><Wrench size={14} className="text-zinc-300"/></div>
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">SERVIÇO:</span>
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase">{item.serviceType}</span>
                </div>
            </div>
            <div className="flex items-start gap-3">
                <div className="mt-0.5"><MapPin size={14} className="text-zinc-300"/></div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">LOCAL:</span>
                    <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-300 leading-tight line-clamp-2">{item.locationAddress}</span>
                </div>
            </div>
            {isUnderAnalysis && responsibleName && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/20 animate-in fade-in slide-in-from-top-1">
                    <div className="mt-0.5"><SearchCheck size={14} className="text-amber-500"/></div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[9px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">RESPONSÁVEL PELA ANÁLISE:</span>
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase truncate">{responsibleName}</span>
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 flex justify-between items-end">
            <div className="flex flex-col">
                <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">TÉCNICO</span>
                <div className="flex items-center gap-2">
                    {assignedTech && (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: techColor }} />
                    )}
                    <span className={`text-xs font-bold uppercase ${!assignedTech ? 'text-zinc-400 italic' : 'text-zinc-900 dark:text-white'}`}>
                        {techName}
                    </span>
                </div>
            </div>
            
            {assignedTech && assignedTech.serviceRates && (
                <div className="text-right">
                    <div className="text-[9px] font-bold text-amber-500">
                        R$ {serviceVal.toFixed(2)} 
                        {item.displacementValue ? <span className="text-zinc-400"> + R$ {item.displacementValue}</span> : ''}
                    </div>
                    <div className="text-xs font-black text-zinc-900 dark:text-white">
                        Total: R$ {totalVal.toFixed(2)}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
