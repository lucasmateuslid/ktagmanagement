import React, { useState } from 'react';
import { Schedule, Technician } from '../../../types';
import { getStatusStyle } from '../../schedules/utils/scheduleStatusUtils';
import { calculateServiceValue } from '../../schedules/utils/scheduleFinancialUtils';
import { UserCircle2, Wrench, AlertCircle, Edit2, Check, XCircle, Ban, PlayCircle, CheckCircle2 } from 'lucide-react';

interface CRMKanbanCardProps {
    item: Schedule;
    technicians: Technician[];
    onUpdateValue: (val: number) => void;
    onAction: (action: string) => void;
}

export const CRMKanbanCard: React.FC<CRMKanbanCardProps> = ({ item, technicians, onUpdateValue, onAction }) => {
    const assignedTech = technicians.find(t => t.id === item.technicianId);
    const techName = assignedTech ? assignedTech.name : 'Sem Técnico';
    const clientName = item.clientName ? item.clientName.split(' ')[0] : item.requesterName.split(' ')[0];
    const adminOwner = item.responsibleAdmin || 'Sistema';

    const [isEditingValue, setIsEditingValue] = useState(false);
    
    // Default value falls back to tech's rate for this service
    const defaultVal = calculateServiceValue(item, assignedTech);
    const displayValue = item.adhesionValue ?? defaultVal;
    const [editValue, setEditValue] = useState(displayValue);

    const handleSaveValue = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdateValue(editValue);
        setIsEditingValue(false);
    };

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex justify-between items-start mb-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex-1">
                    <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1 flex items-center gap-1">
                        <AlertCircle size={10} /> O.S. P-{item.id.slice(-4).toUpperCase()}
                    </p>
                    <h4 className="font-display font-black text-sm text-zinc-900 dark:text-white leading-tight">
                        {clientName}
                    </h4>
                    <p className="text-xs font-bold text-zinc-500">{item.vehicleModel} • {item.vehiclePlate}</p>
                </div>
                <div className="flex flex-col items-end shrink-0 gap-1 pl-2">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${getStatusStyle(item.status)}`}>
                        {item.status}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg">
                        {item.serviceType}
                    </span>
                </div>
            </div>

            <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                        <UserCircle2 size={12} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-400">Solicitante</span>
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">{item.requesterName}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <UserCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-400">Owner (Admin/Mod)</span>
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">{adminOwner}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                        <Wrench size={12} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-400">Técnico Atribuído</span>
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">{techName}</span>
                    </div>
                </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/20 -mx-4 -mb-4 px-4 py-3 rounded-b-2xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Valor da O.S.</span>
                <div className="flex items-center gap-2">
                    {isEditingValue ? (
                        <div className="flex items-center gap-1">
                            <span className="text-sm font-bold text-emerald-600">R$</span>
                            <input 
                                type="number" 
                                autoFocus
                                value={editValue} 
                                onChange={(e) => setEditValue(Number(e.target.value))}
                                className="w-16 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-sm font-black px-1 outline-none focus:border-emerald-500"
                                onClick={(e) => e.stopPropagation()}
                            />
                            <button 
                                onClick={handleSaveValue}
                                className="p-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 rounded hover:bg-emerald-100"
                            >
                                <Check size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setIsEditingValue(true); }}>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                R$ {displayValue.toFixed(2).replace('.', ',')}
                            </span>
                            <Edit2 size={12} className="text-zinc-400 hover:text-emerald-500 transition-colors" />
                        </div>
                    )}
                </div>
            </div>

            {/* QUICK ACTIONS & CONTACTS */}
            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-2 w-full">
                {/* Contacts */}
                <div className="flex gap-2">
                    {item.clientPhone && (
                        <a 
                            href={`https://wa.me/55${item.clientPhone.replace(/\D/g, '')}`}
                            target="_blank" rel="noreferrer"
                            className="flex-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-green-100 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                        >
                            WhatsApp Cliente
                        </a>
                    )}
                    {assignedTech?.phone && (
                        <a 
                            href={`https://wa.me/55${assignedTech.phone.replace(/\D/g, '')}`}
                            target="_blank" rel="noreferrer"
                            className="flex-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-amber-100 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                        >
                            WhatsApp Técnico
                        </a>
                    )}
                </div>

                {/* Workflow Actions */}
                <div className="flex gap-2">
                    {['Solicitada', 'Em análise'].includes(item.status) && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); onAction('cancel'); }} className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-red-100 transition-colors"><XCircle size={12} /> Cancelar</button>
                            <button onClick={(e) => { e.stopPropagation(); onAction('confirm'); }} className="flex-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-indigo-100 transition-colors"><CheckCircle2 size={12} /> Confirmar</button>
                        </>
                    )}
                    {['Em orçamento', 'Autorizada'].includes(item.status) && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); onAction('cancel'); }} className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-red-100 transition-colors"><XCircle size={12} /> Cancelar</button>
                            <button onClick={(e) => { e.stopPropagation(); onAction('confirm'); }} className="flex-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-indigo-100 transition-colors"><CheckCircle2 size={12} /> Confirmar</button>
                        </>
                    )}
                    {['Confirmada', 'Reagendada'].includes(item.status) && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); onAction('cancel'); }} className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-red-100 transition-colors"><XCircle size={12} /> Cancelar</button>
                        </>
                    )}
                    {['Em andamento', 'Técnico no local', 'Cliente no local'].includes(item.status) && (
                        <button onClick={(e) => { e.stopPropagation(); onAction('frustrate'); }} className="flex-1 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-orange-100 transition-colors"><Ban size={12} /> Frustrar</button>
                    )}
                    {['Aguardando Vínculo'].includes(item.status) && (
                        <button onClick={(e) => { e.stopPropagation(); onAction('finish'); }} className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-emerald-100 transition-colors"><CheckCircle2 size={12} /> Concluir</button>
                    )}
                </div>
            </div>
        </div>
    );
};
