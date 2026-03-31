
import React from 'react';
import { Schedule, Technician } from '../../../../types';
import { Copy, Maximize2, User, SearchCheck, Wrench, Calendar, MapPin, Clock, XCircle, Check, Wallet } from 'lucide-react';
import { getStatusStyle } from '../../utils/scheduleStatusUtils';
import { getTimeElapsedStr, getDisplayDate, getDisplayTime, isScheduleOverdue } from '../../utils/scheduleTimeUtils';

// --- SUBCOMPONENT: USER STEPPER ---
const UserStepper = ({ status }: { status: string }) => {
  const steps = [
      { id: 'Solicitada', label: 'Solicitado' },
      { id: 'Em análise', label: 'Análise' },
      { id: 'Confirmada', label: 'Agendado' },
      { id: 'Concluída', label: 'Concluído' }
  ];

  let activeIndex = 0;
  if (status === 'Solicitada') activeIndex = 0;
  else if (['Em análise', 'Em orçamento'].includes(status)) activeIndex = 1;
  else if (['Autorizada', 'Confirmada', 'Reagendada', 'Técnico no local', 'Cliente no local'].includes(status)) activeIndex = 2;
  else if (status === 'Concluída') activeIndex = 3;
  else if (status === 'Cancelada') activeIndex = -1;

  if (status === 'Cancelada') {
      return (
          <div className="w-full bg-red-50 dark:bg-red-900/10 p-3 rounded-2xl border border-red-100 dark:border-red-900/20 flex items-center justify-center gap-2 mt-4">
              <XCircle size={16} className="text-red-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">Cancelada</span>
          </div>
      );
  }

  return (
      <div className="relative w-full mt-8 mb-4 px-4">
          <div className="absolute top-4 left-0 w-full h-[3px] bg-zinc-100 dark:bg-zinc-800 -translate-y-1/2 rounded-full z-0"></div>
          <div className="flex justify-between relative z-10 w-full">
              {steps.map((step, index) => {
                  const isCompleted = index <= activeIndex;
                  return (
                      <div key={step.id} className="flex flex-col items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-[4px] transition-all duration-300 ${
                              isCompleted 
                              ? 'bg-emerald-500 border-emerald-100 dark:border-emerald-900/30 text-white shadow-lg shadow-emerald-500/20' 
                              : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-300'
                          }`}>
                              {isCompleted && <Check size={14} strokeWidth={4} />}
                          </div>
                          <span className={`text-[9px] font-black uppercase tracking-widest ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-300 dark:text-zinc-600'}`}>
                              {step.label}
                          </span>
                      </div>
                  );
              })}
          </div>
      </div>
  );
};

interface UserScheduleCardProps {
  item: Schedule;
  technicians: Technician[];
  onClick: (item: Schedule) => void;
  onCopy: (e: React.MouseEvent, item: Schedule) => void;
}

export const UserScheduleCard: React.FC<UserScheduleCardProps> = ({ item, technicians, onClick, onCopy }) => {
  const assignedTech = technicians.find(t => t.id === item.technicianId);
  const styleConfig = getStatusStyle(item.status);
  
  // Lógica atualizada para encontrar o responsável (quem verificou, assumiu ou confirmou)
  const responsibleHistory = [...item.history].reverse().find(h => 
      h.action === 'Assumiu' || 
      h.action === 'Verificando' || 
      h.action === 'Confirmou' ||
      h.action === 'Reagendou' ||
      (h.statusSnapshot === 'Em análise' && h.actionBy !== 'Sistema')
  );

  const responsibleName = responsibleHistory?.actionBy;
  const timeElapsedStr = getTimeElapsedStr(item.createdAt);
  const displayDate = getDisplayDate(item);
  const displayTime = getDisplayTime(item);
  const isOverdue = isScheduleOverdue(item);

  return (
    <div onClick={() => onClick(item)} className={`bg-white dark:bg-zinc-900 rounded-[32px] border p-8 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group ${isOverdue ? 'border-red-500/50 dark:border-red-500/50 ring-1 ring-red-500/20' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}>
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
            <div className="flex flex-wrap gap-2 items-center">
                <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${styleConfig.badgeBg} ${styleConfig.badgeText}`}>{item.status}</span>
                <span className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1">
                    <Clock size={12}/> {timeElapsedStr}
                </span>
                {isOverdue && (
                    <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 flex items-center gap-1 border border-red-200 dark:border-red-800 animate-pulse">
                        Atenção: +24h
                    </span>
                )}
            </div>
            <div className="flex gap-2">
                <button onClick={(e) => onCopy(e, item)} className="p-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all border border-emerald-200 dark:border-emerald-500/30" title="Copiar confirmação"><Copy size={16} /></button>
                <button onClick={(e) => { e.stopPropagation(); onClick(item); }} className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors border border-zinc-200 dark:border-zinc-700"><Maximize2 size={16} /></button>
            </div>
        </div>
        <div className="mb-8">
            <h2 className="text-4xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter">{item.vehiclePlate}</h2>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1 flex items-center gap-2">{item.vehicleModel}<span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"/><span className="text-primary-500">{item.deviceType}</span></p>
        </div>
        
        <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-3xl p-6 border border-zinc-100 dark:border-zinc-800/50 mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 shadow-sm border border-zinc-100 dark:border-zinc-800">
                        <User size={16} />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Técnico Responsável</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {assignedTech && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: assignedTech.color }} />}
                            <p className={`text-xs font-bold uppercase truncate ${!assignedTech ? 'text-zinc-400 italic' : 'text-zinc-900 dark:text-white'}`}>
                                {assignedTech ? assignedTech.name : 'A definir'}
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className={`flex items-center gap-3 p-2 rounded-xl transition-all ${['Em análise', 'Em orçamento'].includes(item.status) ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20' : ''}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm border ${['Em análise', 'Em orçamento'].includes(item.status) ? 'bg-white dark:bg-zinc-900 text-amber-500 border-amber-100 dark:border-amber-900/30' : 'bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-100 dark:border-zinc-800'}`}>
                        <SearchCheck size={16} />
                    </div>
                    <div>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${['Em análise', 'Em orçamento'].includes(item.status) ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-400'}`}>Responsável pelo Agendamento</p>
                        <p className={`text-xs font-bold uppercase truncate ${!responsibleName ? 'text-zinc-400 italic' : (['Em análise', 'Em orçamento'].includes(item.status) ? 'text-amber-900 dark:text-amber-200' : 'text-zinc-900 dark:text-white')}`}>
                            {responsibleName || '--'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 shadow-sm border border-zinc-100 dark:border-zinc-800"><Wrench size={16} /></div>
                    <div>
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Tipo de Serviço</p>
                        <p className={`text-xs font-bold uppercase truncate ${item.serviceType === 'Instalação' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>{item.serviceType}</p>
                    </div>
                </div>
            </div>
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 shadow-sm border border-zinc-100 dark:border-zinc-800"><Calendar size={16} /></div>
                    <div>
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Data & Hora</p>
                        <p className="text-xs font-bold text-zinc-900 dark:text-white uppercase truncate">
                            {displayDate} {displayTime ? `às ${displayTime}` : ''}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 shadow-sm border border-zinc-100 dark:border-zinc-800 shrink-0"><MapPin size={16} /></div>
                    <div className="min-w-0">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Localização</p>
                        <p className="text-xs font-bold text-zinc-900 dark:text-white leading-tight mt-0.5 line-clamp-2" title={item.locationAddress}>{item.locationAddress}</p>
                    </div>
                </div>
            </div>
        </div>
        <div className="pt-2"><UserStepper status={item.status} /></div>
    </div>
  );
};
