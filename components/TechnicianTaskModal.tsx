import React, { useState } from "react";
import { Schedule, Technician, Company, ChecklistItem, defaultChecklistItems } from "../types";
import { X, Clock, CheckCircle2, Activity, Calendar, User, Phone, MapPin, Search, Plus, MessageCircle, ChevronDown, Link } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotification } from "../contexts/NotificationContext";
import { getDisplayDate } from "../pages/schedules/utils/scheduleTimeUtils";
import { SignaturePad } from "./SignaturePad";
import { printOsDoc } from "../utils/printOsDoc";
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import { storage } from "../services/storage";
import { Tag } from "../types";

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface TechnicianTaskModalProps {
  schedule: Schedule;
  technicians: Technician[];
  companies: Company[];
  onClose: () => void;
  onUpdate: (schedule: Schedule) => void;
  currentUser: any;
}

export const TechnicianTaskModal: React.FC<TechnicianTaskModalProps> = ({
  schedule,
  technicians,
  companies,
  onClose,
  onUpdate,
  currentUser,
}) => {
  const { addNotification } = useNotification();
  const [view, setView] = useState<'main' | 'checklist' | 'signature' | 'techSignature'>('main');
  const [checklistType, setChecklistType] = useState<'before' | 'after'>('before');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const [isDeviceListOpen, setIsDeviceListOpen] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState("");
  
  const [isTagListOpen, setIsTagListOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");

  React.useEffect(() => {
    storage.getTags().then(tags => setAvailableTags(tags));
  }, []);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (schedule.status === "Técnico no local") {
        const start = schedule.history?.find(h => h.action === "Técnico no local")?.timestamp || Date.now();
        interval = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - start) / 1000));
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [schedule.status, schedule.history]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const [formData, setFormData] = useState({
    installedImei: schedule.installedImei || "",
    installedTagImei: schedule.installedTagImei || "",
    locationAddress: schedule.locationAddress || "",
    notes: schedule.notes || "",
    vehicleChassis: schedule.vehicleChassis || "",
    vehicleColor: schedule.vehicleColor || "",
    vehicleStatus: schedule.vehicleStatus || "",
    clientStatus: schedule.clientStatus || "",
    clientSignature: schedule.osSignature || "",
    checklist: schedule.checklist?.length ? schedule.checklist : defaultChecklistItems.map(item => ({
        name: item,
        before: '' as any,
        after: '' as any
    })),
  });

  const assignedTech = technicians.find((t) => t.id === schedule.technicianId);
  const regionalName = companies.find((c) => c.id === schedule.companyId)?.name || 'N/A';

  const handleUpdateStatus = (newStatus: "Técnico no local" | "Concluída" | "Frustrada" | "Cancelada", details?: string) => {
    onUpdate({
        ...schedule,
        status: newStatus,
        history: [
            ...(schedule.history || []),
            {
                timestamp: Date.now(),
                action: newStatus,
                details: details || `Status movido para ${newStatus}`,
                actionBy: currentUser?.name || 'Técnico',
            }
        ]
    });
  }

  const handleStartService = () => {
      handleUpdateStatus("Técnico no local", "Técnico informou que chegou ao local.");
      addNotification('success', 'Iniciado', 'Serviço iniciado com sucesso!');
  }

  const handleFrustrateService = () => {
      handleUpdateStatus("Frustrada", "Técnico informou que o serviço foi frustrado.");
      addNotification('error', 'Frustrado', 'Serviço marcado como frustrado.');
      onClose();
  }

  const handleFinishProcess = () => {
      setView('signature');
  }

  const handleSaveSignature = (signatureDataUrl: string) => {
      // Salva cliente temporariamente
      setFormData(prev => ({ ...prev, clientSignature: signatureDataUrl }));

      if (!assignedTech?.signature) {
          setView('techSignature');
      } else {
          completeService(signatureDataUrl, assignedTech.signature);
      }
  }

  const handleSaveTechSignature = async (techSignatureDataUrl: string) => {
      try {
          if (assignedTech) {
              await storage.saveTechnician({ ...assignedTech, signature: techSignatureDataUrl });
              addNotification("success", "Assinatura do Técnico", "Sua assinatura foi salva para futuros serviços.");
              completeService(formData.clientSignature as unknown as string, techSignatureDataUrl);
          }
      } catch (error) {
          console.error(error);
      }
  }

  const completeService = (clientSig: string, techSig?: string) => {
      const updatedSchedule = { 
          ...schedule, 
          status: "Concluída", 
          osSignature: clientSig, 
          installedImei: formData.installedImei,
          installedTagImei: formData.installedTagImei,
          vehicleChassis: formData.vehicleChassis,
          vehicleColor: formData.vehicleColor,
          vehicleStatus: formData.vehicleStatus,
          clientStatus: formData.clientStatus,
          checklist: formData.checklist,
          history: [
              ...(schedule.history || []),
              {
                  timestamp: Date.now(),
                  action: "Concluída",
                  details: "Serviço finalizado pelo técnico e OS assinada.",
                  actionBy: currentUser?.name || 'Técnico',
              }
          ]
      } as Schedule;

      onUpdate(updatedSchedule);

      addNotification('success', 'Finalizado', 'O serviço foi finalizado e a OS assinada.');
      const company = companies.find((c) => c.id === updatedSchedule.companyId);
      
      const techToPass = { ...assignedTech, signature: techSig } as any;
      printOsDoc(updatedSchedule, techToPass, company);
      onClose();
  }

  const handleSaveChecklist = () => {
      onUpdate({ ...schedule, checklist: formData.checklist });
      setView('main');
      addNotification('success', 'Checklist Salvo', 'Checklist da etapa salvo com sucesso');
  }

  const updateChecklistItem = (index: number, value: string) => {
      const newChecklist = [...formData.checklist];
      if (checklistType === 'before') {
          newChecklist[index].before = value as any;
      } else {
          newChecklist[index].after = value as any;
      }
      setFormData({ ...formData, checklist: newChecklist });
  }

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <AnimatePresence mode="wait">
        {view === 'main' && (
      <motion.div
        key="main"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50 shrink-0">
          <div>
            <h2 className="text-lg font-display font-black uppercase tracking-tight text-zinc-900 dark:text-white">
              Detalhes do Serviço
            </h2>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              {schedule.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {/* 1. Status Banner */}
            <div
            className={`p-5 rounded-2xl border flex items-center gap-4 ${
                schedule.status === "Confirmada" ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                : schedule.status === "Cancelada" ? "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400"
                : schedule.status === "Técnico no local" ? "bg-cyan-50 dark:bg-cyan-900/10 border-cyan-100 dark:border-cyan-900/20 text-cyan-600 dark:text-cyan-400"
                : "bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20 text-blue-600 dark:text-blue-400"
            }`}
            >
            {schedule.status === "Confirmada" ? (
                <CheckCircle2 size={32} />
            ) : schedule.status === "Cancelada" ? (
                <X size={32} />
            ) : (
                <Clock size={32} />
            )}
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
                Status Atual
                </p>
                <p className="text-xl font-black uppercase tracking-tight">
                {schedule.status}
                </p>
            </div>
            </div>

            {/* 2. Main Info Card */}
            <div className="bg-zinc-900 text-white p-6 rounded-3xl relative overflow-hidden">
            <div className="relative z-10">
                <h3 className="text-3xl font-display font-black uppercase tracking-tighter">
                {schedule.vehiclePlate}
                </h3>
                <p className="text-zinc-400 text-xs font-bold uppercase mt-1">
                {schedule.vehicleModel}
                </p>
                {schedule.fipeValue && (
                <p className="text-zinc-500 text-[10px] font-bold uppercase mt-1">
                    Valor FIPE: {schedule.fipeValue}
                </p>
                )}
                <div className="flex gap-2 mt-4">
                <span className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-black uppercase">
                    {schedule.serviceType}
                </span>
                <span className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-black uppercase">
                    {schedule.deviceType}
                </span>
                </div>
            </div>
            <div className="absolute right-[-10px] bottom-[-10px] opacity-10">
                <Activity size={100} />
            </div>
            </div>

            {/* 2.5 Prominent Client Info */}
            <div className="bg-zinc-50 dark:bg-zinc-950/50 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-zinc-500">
                        <User size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Cliente
                        </span>
                    </div>
                </div>
                <div className="flex justify-between items-center gap-2">
                    <p className="text-xl font-bold text-zinc-900 dark:text-white uppercase">
                    {schedule.clientName || "N/A"}
                    </p>
                    <div className="flex gap-2 shrink-0">
                        {schedule.clientPhone && (
                            <>
                                <a href={`tel:${schedule.clientPhone?.replace(/\D/g, '')}`} className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 hover:bg-blue-200" title="Ligar">
                                    <Phone size={18} />
                                </a>
                                <a href={`https://wa.me/55${schedule.clientPhone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200" title="WhatsApp">
                                    <MessageCircle size={18} />
                                </a>
                            </>
                        )}
                    </div>
                </div>
                {schedule.clientPhone && (
                <p className="text-xs font-bold text-zinc-500 mt-1">
                    {schedule.clientPhone}
                </p>
                )}
            </div>

            {/* 3. Grid Details */}
            <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <Calendar size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">
                    Data
                </span>
                </div>
                <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase">
                {getDisplayDate(schedule)}
                </p>
            </div>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <Clock size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">
                    Horário
                </span>
                </div>
                <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase">
                {schedule.confirmedTime || schedule.preferredTime || "--:--"}
                </p>
            </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <User size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">
                    Técnico
                </span>
                </div>
                <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase line-clamp-1">
                    {assignedTech?.name || "N/A"}
                </p>
                </div>
            </div>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <MapPin size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">
                    Regional
                </span>
                </div>
                <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase">
                {regionalName}
                </p>
            </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col justify-center items-center text-center">
                    <div className="flex items-center justify-center gap-2 text-zinc-400 mb-1">
                    <Activity size={14} />
                    <span className="text-[9px] font-black uppercase tracking-widest">
                        Pagamento ao Técnico
                    </span>
                    </div>
                    <p className={`text-xs font-bold uppercase ${schedule.technicianPaid ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {schedule.technicianPaid ? 'Pago' : 'Pendente'}
                    </p>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col justify-center items-center text-center">
                    <div className="flex items-center justify-center gap-2 text-zinc-400 mb-1">
                    <CheckCircle2 size={14} />
                    <span className="text-[9px] font-black uppercase tracking-widest">
                        Vistoria
                    </span>
                    </div>
                    <p className={`text-xs font-bold uppercase ${schedule.needsInspection ? 'text-blue-500' : 'text-zinc-400'}`}>
                    {schedule.needsInspection ? 'Necessária' : 'Não'}
                    </p>
                </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col justify-center items-center text-center">
                <div className="flex items-center justify-center gap-2 text-zinc-400 mb-1">
                <Activity size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">
                    Pagamento no Local (Cliente)
                </span>
                </div>
                <p className={`text-sm font-bold uppercase ${schedule.paymentOnSite ? 'text-amber-500' : 'text-zinc-400'}`}>
                {schedule.paymentOnSite ? 'Sim (Cobrar Adesão)' : 'Não'}
                </p>
                {schedule.paymentOnSite && schedule.adhesionValue ? (
                    <p className="text-xl font-bold text-amber-600 mt-1">
                        R$ {schedule.adhesionValue.toFixed(2).replace('.', ',')}
                    </p>
                ) : null}
            </div>

            {/* Address */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                    <MapPin size={14} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Local</span>
                </div>
                <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">
                    {schedule.locationAddress || "A definir"}
                </p>
                {(schedule.locationLat && schedule.locationLng) ? (
                    <div className="mt-4 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm relative">
                        <a 
                            href={`https://maps.google.com/?q=${schedule.locationLat},${schedule.locationLng}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="absolute top-2 right-2 z-[400] bg-white dark:bg-zinc-900 shadow px-3 py-1.5 rounded-lg text-[10px] font-black text-amber-500 uppercase tracking-widest hover:bg-amber-50 transition-colors flex items-center gap-1"
                        >
                            VER NO MAPA <Activity size={10} />
                        </a>
                        <div className="h-40 bg-zinc-200 dark:bg-zinc-800 relative z-10 w-full">
                            <MapContainer 
                                center={[schedule.locationLat, schedule.locationLng]} 
                                zoom={15} 
                                style={{ height: '100%', width: '100%' }}
                                zoomControl={false}
                                dragging={false}
                                touchZoom={false}
                                scrollWheelZoom={false}
                                doubleClickZoom={false}
                            >
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <Marker position={[schedule.locationLat, schedule.locationLng]} />
                            </MapContainer>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Additional Info Forms */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                <p className="font-bold text-zinc-900 dark:text-white uppercase tracking-tight text-sm">Dados Complementares do Formulário</p>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Chassi</label>
                        <input
                            type="text"
                            value={formData.vehicleChassis}
                            onChange={(e) => setFormData({ ...formData, vehicleChassis: e.target.value })}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all uppercase"
                            placeholder="Chassi"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Cor</label>
                        <input
                            type="text"
                            value={formData.vehicleColor}
                            onChange={(e) => setFormData({ ...formData, vehicleColor: e.target.value })}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                            placeholder="Ex: Prata"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Status Veículo</label>
                        <input
                            type="text"
                            value={formData.vehicleStatus}
                            onChange={(e) => setFormData({ ...formData, vehicleStatus: e.target.value })}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                            placeholder="Ex: Regular"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Sit. Associado</label>
                        <input
                            type="text"
                            value={formData.clientStatus}
                            onChange={(e) => setFormData({ ...formData, clientStatus: e.target.value })}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                            placeholder="Ex: Ativo"
                        />
                    </div>
                </div>
            </div>

            {/* Technician Actions Region */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                <p className="font-bold text-zinc-900 dark:text-white uppercase tracking-tight text-sm">Controles Técnicos</p>
                
                <div className="space-y-3">
                    {['Rastreador', 'Rastreador + Tag'].includes(schedule.deviceType) && (() => {
                        const filteredDevices = availableTags.filter(t => 
                            (t.type !== 'K_TAG' && t.type !== 'XADTAG') &&
                            (t.name.toLowerCase().includes(deviceSearch.toLowerCase()) || 
                             (t.imei || t.id).toLowerCase().includes(deviceSearch.toLowerCase()))
                        );
                        
                        const originalDevice = availableTags.find(t => (t.imei || t.id) === schedule.installedImei);
                        const selectedDevice = schedule.installedImei 
                            ? { id: schedule.installedImei, name: `${originalDevice?.name || schedule.installedImei} - Vinculado`, imei: originalDevice?.imei }
                            : availableTags.find(t => (t.imei || t.id) === formData.installedImei);

                        return (
                        <div className="relative z-[50]">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">IMEI Rastreador (Estoque)</label>
                            
                            <div 
                                onClick={() => setIsDeviceListOpen(!isDeviceListOpen)}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:border-primary-500 transition-colors"
                            >
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-zinc-900 dark:text-white">
                                        {selectedDevice ? ((selectedDevice as any)?.imei || selectedDevice.name) : "Selecione o Rastreador..."}
                                    </span>
                                </div>
                                <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isDeviceListOpen ? 'rotate-180' : ''}`} />
                            </div>

                            <AnimatePresence>
                                {isDeviceListOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[1001]" onClick={() => setIsDeviceListOpen(false)} />
                                        <motion.div 
                                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                            className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-2xl z-[1002] overflow-hidden flex flex-col max-h-[300px]"
                                        >
                                            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                                                <div className="relative">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                                    <input 
                                                        type="text" 
                                                        placeholder="Buscar modelo ou IMEI..." 
                                                        value={deviceSearch}
                                                        onChange={e => setDeviceSearch(e.target.value)}
                                                        className="w-full pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 ring-primary-500/20"
                                                        autoFocus
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                </div>
                                            </div>
                                            <div className="overflow-y-auto custom-scrollbar p-1">
                                                {filteredDevices.length === 0 ? (
                                                    <div className="p-8 text-center">
                                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nenhum rastreador encontrado</p>
                                                    </div>
                                                ) : (
                                                    filteredDevices.map(t => {
                                                        const isSelected = formData.installedImei === (t.imei || t.id);
                                                        return (
                                                            <div 
                                                                key={t.id}
                                                                onClick={() => {
                                                                    setFormData({...formData, installedImei: t.imei || t.id});
                                                                    setIsDeviceListOpen(false);
                                                                    setDeviceSearch("");
                                                                }}
                                                                className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-colors ${
                                                                    isSelected 
                                                                    ? 'bg-primary-500/10 border border-primary-500/20' 
                                                                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border border-transparent'
                                                                } mb-1`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-primary-500 text-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                                                                        <Activity size={14} />
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <p className={`text-sm font-bold ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-900 dark:text-white'}`}>
                                                                                {t.imei || t.name}
                                                                            </p>
                                                                        </div>
                                                                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{t.name}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center gap-1 text-[9px] font-black uppercase text-zinc-500 tracking-widest">
                                                                        <Link size={10} /> LIVRE
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                        );
                    })()}

                    {['Tag', 'Rastreador + Tag'].includes(schedule.deviceType) && (() => {
                        const filteredTags = availableTags.filter(t => 
                            (t.type === 'K_TAG' || t.type === 'XADTAG') &&
                            ((t.accessoryId || '').toLowerCase().includes(tagSearch.toLowerCase()) || 
                             (t.imei || '').toLowerCase().includes(tagSearch.toLowerCase()))
                        );
                        
                        const originalTag = availableTags.find(t => t.id === schedule.installedTagImei);
                        const selectedTag = schedule.installedTagImei 
                            ? { id: schedule.installedTagImei, name: `${originalTag?.name || schedule.installedTagImei} - Vinculada`, accessoryId: originalTag?.accessoryId, imei: originalTag?.imei }
                            : availableTags.find(t => t.id === formData.installedTagImei);

                        return (
                        <div className="relative z-[40]">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">ID da Tag (Serial / IMEI)</label>
                            
                            <div 
                                onClick={() => setIsTagListOpen(!isTagListOpen)}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:border-primary-500 transition-colors"
                            >
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-zinc-900 dark:text-white">
                                        {selectedTag ? (selectedTag as any)?.accessoryId || (selectedTag as any)?.imei || selectedTag.name : "Selecione a TAG..."}
                                    </span>
                                </div>
                                <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isTagListOpen ? 'rotate-180' : ''}`} />
                            </div>

                            <AnimatePresence>
                                {isTagListOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[1001]" onClick={() => setIsTagListOpen(false)} />
                                        <motion.div 
                                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                            className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-2xl z-[1002] overflow-hidden flex flex-col max-h-[300px]"
                                        >
                                            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                                                <div className="relative">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                                    <input 
                                                        type="text" 
                                                        placeholder="Buscar por Serial ou IMEI..." 
                                                        value={tagSearch}
                                                        onChange={e => setTagSearch(e.target.value)}
                                                        className="w-full pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 ring-primary-500/20"
                                                        autoFocus
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                </div>
                                            </div>
                                            <div className="overflow-y-auto custom-scrollbar p-1">
                                                {filteredTags.length === 0 ? (
                                                    <div className="p-8 text-center">
                                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nenhuma tag encontrada</p>
                                                    </div>
                                                ) : (
                                                    filteredTags.map(t => {
                                                        const isSelected = formData.installedTagImei === t.id;
                                                        return (
                                                            <div 
                                                                key={t.id}
                                                                onClick={() => {
                                                                    setFormData({...formData, installedTagImei: t.id});
                                                                    setIsTagListOpen(false);
                                                                    setTagSearch("");
                                                                }}
                                                                className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-colors ${
                                                                    isSelected 
                                                                    ? 'bg-primary-500/10 border border-primary-500/20' 
                                                                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border border-transparent'
                                                                } mb-1`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-primary-500 text-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                                                                        <Activity size={14} />
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <p className={`text-sm font-bold ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-900 dark:text-white'}`}>
                                                                                {t.type === 'XADTAG' ? t.imei : t.accessoryId}
                                                                            </p>
                                                                        </div>
                                                                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{t.name}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center gap-1 text-[9px] font-black uppercase text-zinc-500 tracking-widest">
                                                                        <Link size={10} /> LIVRE
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                        );
                    })()}

                    <div className="flex gap-3">
                        <button 
                            onClick={() => { setChecklistType('before'); setView('checklist'); }}
                            className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl font-bold flex justify-between items-center hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
                        >
                            <span>1º CheckList</span>
                            <CheckCircle2 size={18} className={formData.checklist.some(c => c.before) ? "text-emerald-500" : "text-zinc-300"} />
                        </button>
                        <button 
                            onClick={() => { setChecklistType('after'); setView('checklist'); }}
                            className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-3 rounded-xl font-bold flex justify-between items-center hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                        >
                            <span>2º CheckList</span>
                            <CheckCircle2 size={18} className={formData.checklist.some(c => c.after) ? "text-emerald-500" : "text-zinc-300"} />
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Bottom Actions */}
        <div className="bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 p-4 md:p-6 shrink-0 grid grid-cols-2 gap-3">
            {['Concluída', 'Frustrada', 'Cancelada'].includes(schedule.status) ? (
                <button 
                    onClick={() => printOsDoc(schedule, assignedTech, companies.find((c) => c.id === schedule.companyId))}
                    className="col-span-2 w-full bg-zinc-900 dark:bg-white hover:bg-black dark:hover:bg-zinc-100 text-white dark:text-black font-black uppercase text-xs tracking-widest py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                    Imprimir OS (PDF)
                </button>
            ) : schedule.status !== "Técnico no local" ? (
                <>
                <button 
                    onClick={handleStartService}
                    className="col-span-2 w-full bg-primary-500 hover:bg-primary-600 text-black font-black uppercase text-xs tracking-widest py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                    Iniciar Serviço
                </button>
                <button 
                    onClick={onClose}
                    className="w-full border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold uppercase text-[10px] tracking-widest py-3 rounded-xl transition-all"
                >
                    Voltar
                </button>
                <button 
                    onClick={handleFrustrateService}
                    className="w-full border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold uppercase text-[10px] tracking-widest py-3 rounded-xl transition-all"
                >
                    Frustrar
                </button>
                </>
            ) : (
                <>
                <div className="col-span-2 flex gap-3">
                    <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex flex-col justify-center items-center py-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Tempo de Execução</span>
                        <span className="text-xl font-mono font-bold text-zinc-900 dark:text-white">{formatTime(elapsedTime)}</span>
                    </div>
                    <button 
                        onClick={handleFinishProcess}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 shadow-lg text-white font-black uppercase text-xs tracking-widest py-4 rounded-xl transition-all"
                    >
                        Finalizar Serviço
                    </button>
                </div>
                <button 
                    onClick={onClose}
                    className="w-full border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold uppercase text-[10px] tracking-widest py-3 rounded-xl transition-all"
                >
                    Voltar
                </button>
                <button 
                    onClick={handleFrustrateService}
                    className="w-full border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold uppercase text-[10px] tracking-widest py-3 rounded-xl transition-all"
                >
                    Frustrar
                </button>
                </>
            )}
        </div>
      </motion.div>
        )}

        {/* Checklist View */}
        {view === 'checklist' && (
            <motion.div
                key="checklist"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50 shrink-0">
                    <div>
                        <h2 className="text-lg font-display font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                        {checklistType === 'before' ? 'CheckList Entrada' : 'CheckList Saída'}
                        </h2>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        Placa: {schedule.vehiclePlate}
                        </p>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    {formData.checklist.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                            <span className="text-sm font-bold uppercase">{item.name}</span>
                            <div className="flex gap-1">
                                {['OK', 'N/OK', 'N/A'].map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => updateChecklistItem(idx, opt)}
                                        className={`px-3 py-1.5 text-[10px] font-black uppercase rounded ${
                                            (checklistType === 'before' ? item.before : item.after) === opt
                                            ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600'
                                        }`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-3 shrink-0">
                    <button 
                        onClick={() => setView('main')}
                        className="flex-1 border border-zinc-300 text-zinc-700 py-3 rounded-xl font-bold uppercase text-xs"
                    >
                        Voltar
                    </button>
                    <button 
                        onClick={handleSaveChecklist}
                        className="flex-1 bg-primary-500 text-black py-3 rounded-xl font-bold uppercase text-xs"
                    >
                        Salvar e Voltar
                    </button>
                </div>
            </motion.div>
        )}

        {/* Signature View */}
        {view === 'signature' && (
            <motion.div
                key="signature"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col"
            >
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 shrink-0">
                    <h2 className="text-lg font-display font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                    Assinatura do Cliente
                    </h2>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-relaxed mt-1">
                        Declaro para os devidos fins que o serviço foi testado e aprovado, não havendo avarias provenientes da instalação ou visita técnica.
                    </p>
                </div>
                
                <div className="p-6 flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                    <SignaturePad onSave={handleSaveSignature} onCancel={() => setView('main')} />
                </div>
            </motion.div>
        )}
        {/* Tech Signature View */}
        {view === 'techSignature' && (
            <motion.div
                key="techSignature"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col"
            >
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 shrink-0">
                    <h2 className="text-lg font-display font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                    Sua Assinatura (Técnico)
                    </h2>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-relaxed mt-1">
                        Crie sua assinatura padrão. Ela será salva no seu perfil e utilizada automaticamente nas próximas ordens de serviço.
                    </p>
                </div>
                
                <div className="p-6 flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                    <SignaturePad onSave={handleSaveTechSignature} onCancel={() => setView('signature')} />
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

