import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Schedule, Technician, Company, DeviceType, User } from '../types';
import { 
  X, User as UserIcon, Calendar, Clock, MapPin, 
  Phone, Building2, Tag, Milestone, Map as MapIcon, 
  DollarSign, Send, Copy, MessageCircle, ExternalLink,
  Edit2, Trash2, Save, CheckCircle2, ShieldCheck
} from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';

// Helper for date formatting
const formatSafeDate = (dateStr?: string) => {
    if (!dateStr) return 'Data não definida';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return new Date(dateStr).toLocaleDateString();
};

const MotionDiv = motion.div as any;

interface TrackingModalProps {
    schedule: Schedule;
    technicians: Technician[];
    companies: Company[];
    onClose: () => void;
    onUpdate: (s: Schedule) => void;
    onDelete?: (id: string) => void;
    currentUser: User | null;
}

export const TrackingModal: React.FC<TrackingModalProps> = ({ 
    schedule, technicians, companies, onClose, onUpdate, onDelete, currentUser 
}) => {
    const { addNotification } = useNotification();
    const isPrivileged = currentUser?.role === 'admin' || currentUser?.role === 'moderator';
    
    const [isUserEditing, setIsUserEditing] = useState(false);
    
    // State for editing form
    const [formData, setFormData] = useState({
        date: schedule.confirmedDate || schedule.preferredDate,
        time: schedule.confirmedTime || schedule.preferredTime,
        technicianId: schedule.technicianId || '',
        companyId: schedule.companyId || '',
        deviceType: schedule.deviceType,
        needsInspection: schedule.needsInspection ?? false,
        paymentOnSite: schedule.paymentOnSite ?? false,
        isRemoteLocation: schedule.isRemoteLocation ?? false,
        displacementKm: schedule.displacementKm || 0,
        displacementValue: schedule.displacementValue || 0,
        adhesionValue: schedule.adhesionValue || 0,
        locationAddress: schedule.locationAddress,
        notes: schedule.notes || ''
    });

    useEffect(() => {
        setFormData({
            date: schedule.confirmedDate || schedule.preferredDate,
            time: schedule.confirmedTime || schedule.preferredTime,
            technicianId: schedule.technicianId || '',
            companyId: schedule.companyId || '',
            deviceType: schedule.deviceType,
            needsInspection: schedule.needsInspection ?? false,
            paymentOnSite: schedule.paymentOnSite ?? false,
            isRemoteLocation: schedule.isRemoteLocation ?? false,
            displacementKm: schedule.displacementKm || 0,
            displacementValue: schedule.displacementValue || 0,
            adhesionValue: schedule.adhesionValue || 0,
            locationAddress: schedule.locationAddress,
            notes: schedule.notes || ''
        });
    }, [schedule]);

    const availableTechnicians = technicians.filter(t => t.active);
    const responsibleCompany = companies.find(c => c.id === schedule.companyId);

    const handleUserSave = () => {
        const updatedSchedule: Schedule = {
            ...schedule,
            ...(schedule.status === 'Solicitada' || schedule.status === 'Em análise' ? {
                preferredDate: formData.date,
                preferredTime: formData.time
            } : {
                confirmedDate: formData.date,
                confirmedTime: formData.time
            }),
            locationAddress: formData.locationAddress,
            deviceType: formData.deviceType,
            needsInspection: formData.needsInspection,
            paymentOnSite: formData.paymentOnSite,
            
            history: [...schedule.history, { 
                action: 'Atualizou', 
                actionBy: currentUser?.name || 'Usuário', 
                timestamp: Date.now(), 
                details: 'Atualizou detalhes da solicitação' 
            }]
        };
        onUpdate(updatedSchedule);
        setIsUserEditing(false);
        addNotification('success', 'Atualizado', 'Suas alterações foram salvas.');
    };

    const handleAdminSave = () => {
        const updatedSchedule: Schedule = {
            ...schedule,
            confirmedDate: formData.date,
            confirmedTime: formData.time,
            technicianId: formData.technicianId || undefined,
            companyId: formData.companyId || undefined,
            deviceType: formData.deviceType,
            needsInspection: formData.needsInspection,
            paymentOnSite: formData.paymentOnSite,
            isRemoteLocation: formData.isRemoteLocation,
            displacementKm: formData.displacementKm,
            displacementValue: formData.displacementValue,
            adhesionValue: formData.adhesionValue,
            locationAddress: formData.locationAddress,
            notes: formData.notes,
            history: [...schedule.history, {
                action: 'Edição Admin',
                actionBy: currentUser?.name || 'Admin',
                timestamp: Date.now(),
                details: 'Atualizou dados do agendamento'
            }]
        };
        onUpdate(updatedSchedule);
        addNotification('success', 'Atualizado', 'Dados atualizados com sucesso.');
    };

    const handleCopyClientMessage = () => {
        const dateRaw = formData.date;
        const dateDisplay = dateRaw ? formatSafeDate(dateRaw) : 'A definir';
        const timeDisplay = formData.time || '--:--';
        
        const selectedTech = technicians.find(t => t.id === formData.technicianId);
        const techDisplay = selectedTech ? selectedTech.name : 'A definir';
        
        const msg = `AGENDAMENTO CONFIRMADO!\n` +
            `SOLICITANTE: ${schedule.requesterName}\n\n` +
            `DATA: ${dateDisplay}\n` +
            `HORA: ${timeDisplay}\n` +
            `TÉCNICO: ${techDisplay}\n` +
            `VEÍCULO: ${schedule.vehicleModel} (${schedule.vehiclePlate})\n` +
            `DISPOSITIVO: ${formData.deviceType}\n` +
            `ENDEREÇO: ${formData.locationAddress}`;

        navigator.clipboard.writeText(msg);
        addNotification('success', 'Sucesso', 'Mensagem para cliente copiada');
    };

    const handleCopyTechnicianMessage = () => {
        const dateRaw = formData.date;
        const dateDisplay = dateRaw ? formatSafeDate(dateRaw) : 'A definir';
        const timeDisplay = formData.time || '--:--';
        
        const msg = `ORDEM DE SERVIÇO\n` +
            `VEÍCULO: ${schedule.vehicleModel} (${schedule.vehiclePlate})\n` +
            `SERVIÇO: ${schedule.serviceType}\n` +
            `DATA: ${dateDisplay} - ${timeDisplay}\n` +
            `CLIENTE: ${schedule.clientName || schedule.requesterName}\n` +
            `LOCAL: ${formData.locationAddress}\n` +
            `OBS: ${formData.notes || 'Sem observações'}`;

        navigator.clipboard.writeText(msg);
        addNotification('success', 'Sucesso', 'Mensagem para técnico copiada');
    };

    const handleSendToTechnician = () => {
        const selectedTech = technicians.find(t => t.id === formData.technicianId);
        if (!selectedTech || !selectedTech.phone) {
            addNotification('error', 'Erro', 'Técnico sem telefone cadastrado.');
            return;
        }
        
        const dateRaw = formData.date;
        const dateDisplay = dateRaw ? formatSafeDate(dateRaw) : 'A definir';
        const timeDisplay = formData.time || '--:--';

        const msg = `*NOVA OS - K-TAG*\n\n` +
            `🚗 *${schedule.vehiclePlate}* - ${schedule.vehicleModel}\n` +
            `🔧 *${schedule.serviceType}* (${formData.deviceType})\n` +
            `📅 ${dateDisplay} às ${timeDisplay}\n` +
            `👤 ${schedule.clientName || schedule.requesterName}\n` +
            `📍 ${formData.locationAddress}\n` +
            `📝 ${formData.notes || ''}`;
            
        const url = `https://wa.me/55${selectedTech.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    };

    if (isPrivileged) {
        return (
            <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
                <MotionDiv 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    className="bg-white dark:bg-zinc-900 w-full max-w-5xl rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-2xl relative flex flex-col md:flex-row h-[90vh] md:h-[85vh] overflow-hidden"
                >
                    {/* LEFT COLUMN: CONTROLS */}
                    <div className="w-full md:w-[60%] flex flex-col h-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white relative border-r border-zinc-200 dark:border-zinc-800">
                        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center shrink-0 bg-white dark:bg-zinc-900 z-10">
                            <h2 className="text-xl font-display font-black uppercase tracking-tight text-zinc-900 dark:text-white">Gerenciar Solicitação</h2>
                            <button onClick={onClose} className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-xl transition-all"><X size={20}/></button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative">
                            <div className="p-6 space-y-6">
                                {/* Info Block */}
                                <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-widest mb-1">Solicitante</p>
                                            <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase">{schedule.requesterName}</p>
                                            {schedule.clientName && (
                                                <div className="mt-1">
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">Cliente: {schedule.clientName}</p>
                                                    {schedule.clientPhone && <p className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono"><Phone size={10}/> {schedule.clientPhone}</p>}
                                                </div>
                                            )}
                                            {responsibleCompany && (
                                                <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 w-fit">
                                                    <Building2 size={10}/> {responsibleCompany.name}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700">
                                            <Clock size={12} className="text-zinc-400"/>
                                            <span className="text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-300">{new Date(schedule.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    <div className="h-px bg-zinc-200 dark:bg-zinc-800 w-full mb-4" />

                                    <div className="mb-2 flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-widest">Veículo</span>
                                        <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[9px] px-2 py-0.5 rounded font-black uppercase">{schedule.serviceType}</span>
                                    </div>
                                    <h1 className="text-4xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-1">{schedule.vehiclePlate}</h1>
                                    <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-2">
                                        {schedule.vehicleModel} <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600"/> {formData.deviceType}
                                    </p>

                                    {/* Edição de Tipo de Equipamento e Flags */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2 mb-1"><Building2 size={12}/> Regional</label>
                                                <select value={formData.companyId} onChange={e => setFormData({...formData, companyId: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-950 px-2 py-1.5 rounded-lg text-xs font-bold outline-none border border-transparent focus:border-primary-500">
                                                    <option value="">-- Não Informada --</option>
                                                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2 mb-1"><Tag size={12}/> Tipo Equipamento</label>
                                                <select value={formData.deviceType} onChange={e => setFormData({...formData, deviceType: e.target.value as DeviceType})} className="w-full bg-zinc-100 dark:bg-zinc-950 px-2 py-1.5 rounded-lg text-xs font-bold outline-none border border-transparent focus:border-primary-500">
                                                    <option value="Rastreador">Rastreador</option>
                                                    <option value="Tag">Tag</option>
                                                    <option value="Rastreador + Tag">Rastreador + Tag</option>
                                                    <option value="Não precisa">Não precisa</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={formData.needsInspection} onChange={e => setFormData({...formData, needsInspection: e.target.checked})} className="accent-primary-500 w-3 h-3 rounded" />
                                                <span className="text-[9px] font-bold text-zinc-500 uppercase">Necessita Vistoria</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={formData.paymentOnSite} onChange={e => setFormData({...formData, paymentOnSite: e.target.checked})} className="accent-primary-500 w-3 h-3 rounded" />
                                                <span className="text-[9px] font-bold text-zinc-500 uppercase">Pagamento no Local</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="mt-4 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-start gap-3">
                                        <MapPin size={16} className="text-red-500 shrink-0 mt-0.5"/>
                                        <div className="w-full">
                                            <input type="text" value={formData.locationAddress} onChange={e => setFormData({...formData, locationAddress: e.target.value})} className="w-full bg-transparent border-none p-0 text-xs font-bold text-zinc-700 dark:text-zinc-300 focus:ring-0 focus:outline-none"/>
                                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(schedule.locationAddress)}`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-[#f59e0b] uppercase tracking-widest inline-flex items-center gap-1 hover:underline mt-1">Ver no Mapa <ExternalLink size={10}/></a>
                                        </div>
                                    </div>
                                    {schedule.notes && <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl"><p className="text-[9px] font-black uppercase text-blue-500 tracking-widest mb-1">Observações do Solicitante</p><p className="text-xs text-blue-900 dark:text-blue-100 font-medium">{schedule.notes}</p></div>}
                                </div>

                                {/* LOCAL DISTANTE & ORÇAMENTO */}
                                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-3xl border border-amber-100 dark:border-amber-900/20">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <div className="relative">
                                            <input type="checkbox" className="sr-only peer" checked={formData.isRemoteLocation} onChange={e => setFormData({...formData, isRemoteLocation: e.target.checked})} />
                                            <div className="w-10 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full peer-checked:bg-amber-500 transition-all"></div>
                                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-all shadow-sm"></div>
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 tracking-widest flex items-center gap-2"><Milestone size={14}/> Local Distante (Ativar Orçamento)</span>
                                    </label>

                                    {formData.isRemoteLocation && (
                                        <div className="grid grid-cols-2 gap-4 mt-4 animate-in slide-in-from-top-2">
                                            <div>
                                                <label className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-500 mb-1 block">KM (Ida e Volta)</label>
                                                <div className="relative">
                                                    <MapIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400"/>
                                                    <input type="number" value={formData.displacementKm} onChange={e => setFormData({...formData, displacementKm: parseFloat(e.target.value)})} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-950 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs font-bold outline-none focus:border-amber-500" placeholder="0 KM"/>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-500 mb-1 block">Valor Deslocamento (R$)</label>
                                                <div className="relative">
                                                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400"/>
                                                    <input type="number" step="0.01" value={formData.displacementValue} onChange={e => setFormData({...formData, displacementValue: parseFloat(e.target.value)})} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-950 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs font-bold outline-none focus:border-amber-500" placeholder="R$ 0,00"/>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Inputs de Controle e FINANCEIRO (Se status for Orçamento) */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-widest mb-1.5 block">Atribuir Técnico</label>
                                        <div className="flex gap-2">
                                            <select value={formData.technicianId} onChange={e => setFormData({...formData, technicianId: e.target.value})} className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm text-zinc-900 dark:text-white outline-none focus:border-primary-500">
                                                <option value="">-- Selecione --</option>
                                                {availableTechnicians.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                            {/* Button Group */}
                                            <button onClick={handleSendToTechnician} className="px-4 bg-[#25D366] hover:bg-[#1fb550] text-white rounded-xl flex items-center justify-center shadow-lg transition-all active:scale-95" title="Enviar para Técnico"><Send size={18} /></button>
                                            <button onClick={handleCopyTechnicianMessage} className="px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-700 rounded-xl flex items-center justify-center transition-all active:scale-95" title="Copiar Mensagem Técnico"><Copy size={18} /></button>
                                            <button onClick={handleCopyClientMessage} className="px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-700 rounded-xl flex items-center justify-center transition-all active:scale-95" title="Copiar Mensagem Cliente"><MessageCircle size={18} /></button>
                                        </div>
                                    </div>

                                    {/* Scheduling inputs */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1 block">Data Confirmada</label>
                                            <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm text-zinc-900 dark:text-white outline-none focus:border-primary-500" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-1 block">Hora</label>
                                            <input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm text-zinc-900 dark:text-white outline-none focus:border-primary-500" />
                                        </div>
                                    </div>
                                    
                                    <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
                                        <button onClick={handleAdminSave} className="w-full py-4 bg-primary-500 text-black rounded-xl font-black uppercase text-xs tracking-widest hover:scale-[1.01] transition-all flex items-center justify-center gap-2">
                                            <Save size={16}/> Salvar Alterações
                                        </button>
                                        {onDelete && (
                                            <button onClick={() => onDelete(schedule.id)} className="w-full mt-2 py-3 bg-red-500/10 text-red-500 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-red-500/20 transition-all">
                                                Excluir Solicitação
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: HISTORY */}
                    <div className="hidden md:flex w-[40%] bg-zinc-50 dark:bg-zinc-950 flex-col border-l border-zinc-200 dark:border-zinc-800">
                        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Linha do Tempo</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {schedule.history.slice().reverse().map((h, i) => (
                                <div key={i} className="relative pl-6 border-l border-zinc-200 dark:border-zinc-800 last:border-0 pb-2">
                                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700 border-2 border-white dark:border-zinc-900" />
                                    <div className="flex flex-col gap-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black uppercase text-zinc-900 dark:text-white">{h.action}</span>
                                            <span className="text-[9px] font-mono text-zinc-400">{new Date(h.timestamp).toLocaleString()}</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">Por: {h.actionBy}</span>
                                        {h.details && <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 italic">"{h.details}"</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </MotionDiv>
            </div>
        );
    }

    // Render User/Standard View (Simpler Modal)
    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <MotionDiv 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50">
                    <div>
                        <h2 className="text-lg font-display font-black uppercase tracking-tight text-zinc-900 dark:text-white">{isUserEditing ? 'Editar Solicitação' : 'Detalhes do Serviço'}</h2>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{schedule.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"><X size={20}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Status Banner */}
                    <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
                        schedule.status === 'Confirmada' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20 text-emerald-600 dark:text-emerald-400' :
                        schedule.status === 'Cancelada' ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400' :
                        'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20 text-blue-600 dark:text-blue-400'
                    }`}>
                        {schedule.status === 'Confirmada' ? <CheckCircle2 size={24}/> : schedule.status === 'Cancelada' ? <X size={24}/> : <Clock size={24}/>}
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Status Atual</p>
                            <p className="text-sm font-black uppercase">{schedule.status}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Veículo</p>
                            <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase">{schedule.vehiclePlate}</p>
                            <p className="text-xs text-zinc-500 uppercase">{schedule.vehicleModel}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Serviço</p>
                            <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase">{schedule.serviceType}</p>
                            <p className="text-xs text-zinc-500 uppercase">{formData.deviceType}</p>
                        </div>
                    </div>

                    {/* User Edit Form */}
                    {isUserEditing ? (
                        <div className="space-y-4 bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                            <div>
                                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1 block">Endereço</label>
                                <input type="text" value={formData.locationAddress} onChange={e => setFormData({...formData, locationAddress: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none"/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1 block">Data Preferencial</label>
                                    <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none"/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1 block">Hora Preferencial</label>
                                    <input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none"/>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setIsUserEditing(false)} className="flex-1 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase">Cancelar</button>
                                <button onClick={handleUserSave} className="flex-1 py-3 bg-primary-500 text-black rounded-xl font-bold text-xs uppercase shadow-lg">Salvar</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Localização</p>
                                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 leading-relaxed">{schedule.locationAddress}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Data Agendada</p>
                                    <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase">
                                        {schedule.confirmedDate ? new Date(schedule.confirmedDate).toLocaleDateString() : (schedule.preferredDate ? new Date(schedule.preferredDate).toLocaleDateString() : 'A definir')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Horário</p>
                                    <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase">
                                        {schedule.confirmedTime || schedule.preferredTime || '--:--'}
                                    </p>
                                </div>
                            </div>
                            {/* Allow user to edit if status is pending */}
                            {['Solicitada', 'Em análise'].includes(schedule.status) && (
                                <button onClick={() => setIsUserEditing(true)} className="w-full py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black uppercase text-zinc-500 hover:text-primary-500 hover:border-primary-500 transition-all flex items-center justify-center gap-2">
                                    <Edit2 size={14}/> Editar Informações
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </MotionDiv>
        </div>
    );
};