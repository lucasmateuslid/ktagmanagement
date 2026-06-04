
import React, { useState, useEffect, useRef } from 'react';
import { hinovaService } from '../services/hinova';
import { motion, AnimatePresence } from 'framer-motion';
import { Schedule, Technician, Company, DeviceType, User } from '../types';
import { 
  X, User as UserIcon, Calendar, Clock, MapPin, 
  Phone, Building2, Tag, Milestone, Map as MapIcon, 
  DollarSign, Send, Copy, MessageCircle, ExternalLink,
  Edit2, Trash2, Save, CheckCircle2, ShieldCheck,
  Activity, Wrench, FileText, Play, RotateCcw, AlertTriangle, Check, Wallet, Camera, Search
} from 'lucide-react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ConfirmModal } from './ConfirmModal';
import { useNotification } from '../contexts/NotificationContext';
import { MapComponent } from './MapComponent';
import { Checkbox } from './ui/checkbox';
import { LocationHistory, defaultChecklistItems, ChecklistStatus } from '../types';

import { getDisplayDate } from '../pages/schedules/utils/scheduleTimeUtils';

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
    const navigate = useNavigate();
    const { addNotification } = useNotification();
    const isPrivileged = currentUser?.role === 'admin' || currentUser?.role === 'moderator';
    
    const [isUserEditing, setIsUserEditing] = useState(false);
    const [isEditingPayment, setIsEditingPayment] = useState(false);
    const [isFinishing, setIsFinishing] = useState(false);
    const [scannerActive, setScannerActive] = useState<'imei' | 'tag' | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [hinovaStatus, setHinovaStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    
    // Cleanup scanner on unmount or when scannerActive changes
    useEffect(() => {
        if (scannerActive) {
            scannerRef.current = new Html5Qrcode(scannerActive === 'imei' ? "readerImei" : "readerTag");
            scannerRef.current.start(
                { facingMode: "environment" },
                { 
                    fps: 10, 
                    qrbox: 250
                },
                (decodedText) => {
                    if (scannerActive === 'imei') setFormData({...formData, installedImei: decodedText});
                    else setFormData({...formData, installedTagImei: decodedText});
                    
                    if (scannerRef.current && scannerRef.current.isScanning) {
                        scannerRef.current.stop().then(() => setScannerActive(null)).catch(console.error);
                    } else {
                        setScannerActive(null);
                    }
                },
                (error) => console.warn(error)
            );
        }
        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current = null;
                }).catch(console.error);
            } else {
                scannerRef.current = null;
            }
        };
    }, [scannerActive]);
    
    // State for editing form
    const [formData, setFormData] = useState({
        date: schedule.confirmedDate || schedule.preferredDate,
        time: schedule.confirmedTime || schedule.preferredTime,
        technicianId: schedule.technicianId || '',
        companyId: schedule.companyId || '',
        deviceType: schedule.deviceType,
        serviceType: schedule.serviceType || 'Instalação',
        needsInspection: schedule.needsInspection ?? false,
        paymentOnSite: schedule.paymentOnSite ?? false,
        isRemoteLocation: schedule.isRemoteLocation ?? false,
        displacementKm: schedule.displacementKm || 0,
        displacementValue: schedule.displacementValue || 0,
        adhesionValue: schedule.adhesionValue || 0,
        technicianPaid: schedule.technicianPaid ?? false,
        technicianPaymentAmount: schedule.technicianPaymentAmount || 0,
        technicianPaymentDate: schedule.technicianPaymentDate || new Date().toISOString().split('T')[0],
        amountReceivedByTechnician: schedule.amountReceivedByTechnician || 0,
        locationAddress: schedule.locationAddress,
        notes: schedule.notes || '',
        clientName: schedule.clientName || '',
        clientPhone: schedule.clientPhone || '',
        vehiclePlate: schedule.vehiclePlate || '',
        vehicleModel: schedule.vehicleModel || '',
        fipeValue: schedule.fipeValue || '',
        installedImei: schedule.installedImei || '',
        installedTagImei: schedule.installedTagImei || '',
        osNumber: schedule.osNumber || '',
        osDetails: schedule.osDetails || '',
        osSignature: schedule.osSignature || '',
        checklist: schedule.checklist && schedule.checklist.length > 0 ? schedule.checklist : defaultChecklistItems.map(name => ({ name, before: '' as ChecklistStatus, after: '' as ChecklistStatus }))
    });

    const handleHinovaLookup = async () => {
        if (hinovaStatus === 'loading') return;
    
        if (!formData.vehiclePlate || formData.vehiclePlate.length < 7) {
            addNotification('info', 'Hinova', 'Digite uma placa válida.');
            return;
        }
        
        setHinovaStatus('loading');
        try {
            const result = await hinovaService.searchVehicle(formData.vehiclePlate);
            if (result && result.vehicle) {
                setFormData(prev => ({
                    ...prev,
                    vehicleModel: result.vehicle.model || prev.vehicleModel,
                    fipeValue: result.price || (result.vehicle.fipeCode ? `Código FIPE: ${result.vehicle.fipeCode}` : prev.fipeValue),
                    clientName: result.client.name || '', 
                    clientPhone: result.client.phone || ''
                }));
                setHinovaStatus('success');
                addNotification('success', 'Hinova', 'Dados do veículo e cliente importados do SGA.');
            } else {
                setHinovaStatus('error');
                addNotification('error', 'Hinova', 'Veículo não encontrado na base externa.');
            }
        } catch (e: any) {
            setHinovaStatus('error');
            addNotification('error', 'API SGA', e.message);
        } finally {
            setTimeout(() => setHinovaStatus('idle'), 3000);
        }
      };

    const generateOsPdf = (type: 'os' | 'receipt') => {
        const doc = new jsPDF();
        const tech = technicians.find(t => t.id === schedule.technicianId);
        const company = companies.find(c => c.id === schedule.companyId);

        doc.setFontSize(20);
        if (type === 'os') {
            doc.text('Ordem de Serviço', 14, 22);
        } else {
            doc.text('Recibo de Serviço', 14, 22);
        }

        doc.setFontSize(10);
        doc.text(`Data: ${new Date().toLocaleDateString()}`, 14, 30);
        doc.text(`OS Número: ${schedule.osNumber || 'N/A'}`, 14, 36);
        doc.text(`Status: ${schedule.status}`, 14, 42);

        autoTable(doc, {
            startY: 50,
            head: [['Informações do Serviço', '']],
            body: [
                ['Cliente', schedule.clientName || schedule.requesterName || 'N/A'],
                ['Telefone', schedule.clientPhone || 'N/A'],
                ['Veículo', `${schedule.vehicleModel || 'N/A'} - ${schedule.vehiclePlate || 'N/A'}`],
                ['Serviço', schedule.serviceType || 'N/A'],
                ['Equipamento', schedule.deviceType || 'N/A'],
                ['IMEI Instalado', schedule.installedImei || 'N/A'],
                ['ID Tag Instalada', schedule.installedTagImei || 'N/A'],
                ['Técnico', tech?.name || 'N/A'],
                ['Regional', company?.name || 'N/A'],
                ['Local', schedule.locationAddress || 'N/A'],
            ],
            theme: 'striped',
            headStyles: { fillColor: [16, 185, 129] }
        });

        let finalY = (doc as any).lastAutoTable.finalY || 50;

        if (type === 'os') {
            if (schedule.checklist && schedule.checklist.length > 0) {
                autoTable(doc, {
                    startY: finalY + 10,
                    head: [['Checklist', 'Antes', 'Após']],
                    body: schedule.checklist.map(item => [
                        item.name,
                        item.before || '-',
                        item.after || '-'
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [16, 185, 129] },
                    styles: { fontSize: 8, cellPadding: 1 }
                });
                finalY = (doc as any).lastAutoTable.finalY || finalY;
            }

            doc.text('Detalhes da Execução:', 14, finalY + 10);
            const splitDetails = doc.splitTextToSize(schedule.osDetails || 'Nenhum detalhe informado.', 180);
            doc.text(splitDetails, 14, finalY + 16);

            doc.text('Assinatura do Cliente/Responsável:', 14, finalY + 40);
            doc.line(14, finalY + 48, 100, finalY + 48);
            doc.text(schedule.osSignature || '___________________________________', 14, finalY + 54);
        } else {
            doc.text('Valor do Serviço:', 14, finalY + 10);
            doc.text(`R$ ${(schedule.technicianPaymentAmount || 0).toFixed(2)}`, 14, finalY + 16);
            
            doc.text('Assinatura do Técnico:', 14, finalY + 40);
            doc.line(14, finalY + 48, 100, finalY + 48);
            doc.text(tech?.name || '___________________________________', 14, finalY + 54);
        }

        doc.save(`${type === 'os' ? 'OS' : 'Recibo'}_${schedule.vehiclePlate || 'Servico'}.pdf`);
    };

    useEffect(() => {
        setFormData({
            date: schedule.confirmedDate || schedule.preferredDate,
            time: schedule.confirmedTime || schedule.preferredTime,
            technicianId: schedule.technicianId || '',
            companyId: schedule.companyId || '',
            deviceType: schedule.deviceType,
            serviceType: schedule.serviceType || 'Instalação',
            needsInspection: schedule.needsInspection ?? false,
            paymentOnSite: schedule.paymentOnSite ?? false,
            isRemoteLocation: schedule.isRemoteLocation ?? false,
            displacementKm: schedule.displacementKm || 0,
            displacementValue: schedule.displacementValue || 0,
            adhesionValue: schedule.adhesionValue || 0,
            technicianPaid: schedule.technicianPaid ?? false,
            technicianPaymentAmount: schedule.technicianPaymentAmount || 0,
            technicianPaymentDate: schedule.technicianPaymentDate || new Date().toISOString().split('T')[0],
            amountReceivedByTechnician: schedule.amountReceivedByTechnician || 0,
            locationAddress: schedule.locationAddress,
            notes: schedule.notes || '',
            clientName: schedule.clientName || '',
            clientPhone: schedule.clientPhone || '',
            vehiclePlate: schedule.vehiclePlate || '',
            vehicleModel: schedule.vehicleModel || '',
            fipeValue: schedule.fipeValue || '',
            installedImei: schedule.installedImei || '',
            installedTagImei: schedule.installedTagImei || '',
            osNumber: schedule.osNumber || '',
            osDetails: schedule.osDetails || '',
            osSignature: schedule.osSignature || '',
            checklist: schedule.checklist && schedule.checklist.length > 0 ? schedule.checklist : defaultChecklistItems.map(name => ({ name, before: '' as ChecklistStatus, after: '' as ChecklistStatus }))
        });
    }, [schedule]);

    const availableTechnicians = technicians.filter(t => {
        if (!t.active) return false;
        // Se o técnico não tem serviços definidos, assume que faz tudo (ou podemos mudar isso)
        if (!t.services || t.services.length === 0) return true;
        
        // "Não precisa" não filtra técnico
        if (formData.deviceType === 'Não precisa') return true;

        return t.services.includes(formData.deviceType);
    });
    const responsibleCompany = companies.find(c => c.id === schedule.companyId);
    const assignedTech = technicians.find(t => t.id === schedule.technicianId);

    const serviceLocation: LocationHistory = {
        id: 'service-loc',
        tagId: 'service-tag',
        lat: schedule.locationLat,
        lon: schedule.locationLng,
        conf: 1,
        status: 1,
        timestamp: Date.now(),
        isodatetime: new Date().toISOString()
    };

    // --- FLUXO DE AÇÕES DO ADMINISTRADOR ---
    const handleWorkflowAction = (actionType: 'verify' | 'budget' | 'confirm' | 'reschedule' | 'onsite' | 'finish' | 'cancel' | 'delete' | 'frustrate') => {
        let newStatus = schedule.status;
        let historyAction = '';
        let historyDetails = '';

        const currentUserName = currentUser?.name || 'Admin';

        switch (actionType) {
            case 'frustrate':
                newStatus = 'Frustrada';
                historyAction = 'Frustrada';
                historyDetails = 'Visita técnica frustrada.';
                break;
            case 'verify':
                newStatus = 'Em análise';
                historyAction = 'Verificando';
                historyDetails = `${currentUserName} iniciou a verificação.`;
                break;
            case 'budget':
                newStatus = 'Em orçamento';
                historyAction = 'Em Orçamento';
                historyDetails = 'Enviado para análise de custos.';
                break;
            case 'confirm':
                // Validação básica antes de confirmar
                if (!formData.date || !formData.time || !formData.technicianId) {
                    addNotification('error', 'Dados Incompletos', 'Defina Data, Hora e Técnico para confirmar.');
                    return;
                }
                newStatus = 'Confirmada';
                historyAction = 'Confirmada';
                historyDetails = `Agendado para ${getDisplayDate({ confirmedDate: formData.date } as Schedule)} às ${formData.time}`;
                break;
            case 'onsite':
                const isPontoFixo = technicians.find(t => t.id === schedule.technicianId)?.serviceLocationType === 'Ponto Fixo';
                newStatus = isPontoFixo ? 'Cliente no local' : 'Técnico no local';
                historyAction = isPontoFixo ? 'Cliente no local' : 'Técnico no local';
                historyDetails = isPontoFixo ? 'Técnico informou chegada do cliente' : 'Técnico informou chegada ao local';
                break;
            case 'reschedule':
                // Volta para "Em análise" (Pendente) conforme solicitado
                newStatus = 'Em análise'; 
                historyAction = 'Reagendar';
                historyDetails = 'Solicitação retornada para pendente (Reagendamento necessário).';
                break;
            case 'finish':
                if (!isFinishing) {
                    setIsFinishing(true);
                    return;
                }

                // Validate IMEI/ID based on deviceType
                if (schedule.deviceType === 'Tag' && !formData.installedTagImei) {
                    addNotification('error', 'Erro', 'Informe o ID da Tag.');
                    return;
                }
                if (schedule.deviceType === 'Rastreador' && !formData.installedImei) {
                    addNotification('error', 'Erro', 'Informe o IMEI do Rastreador.');
                    return;
                }
                if (schedule.deviceType === 'Rastreador + Tag' && (!formData.installedImei || !formData.installedTagImei)) {
                    addNotification('error', 'Erro', 'Informe o IMEI do Rastreador e o ID da Tag.');
                    return;
                }

                newStatus = 'Aguardando Vínculo';
                historyAction = 'Aguardando Vínculo';
                historyDetails = 'Equipamento informado, aguardando confirmação de vínculo.';
                break;
            case 'cancel':
                setConfirmCancelOpen(true);
                return;
            case 'delete':
                if (!onDelete) return;
                setConfirmDeleteOpen(true);
                return;
        }

        const updatedSchedule: Schedule = {
            ...schedule,
            status: newStatus,
            // Atualiza campos do form junto com a mudança de status
            confirmedDate: formData.date,
            confirmedTime: formData.time,
            technicianId: formData.technicianId || undefined,
            companyId: formData.companyId || undefined,
            deviceType: formData.deviceType,
            serviceType: formData.serviceType,
            needsInspection: formData.needsInspection,
            paymentOnSite: formData.paymentOnSite,
            isRemoteLocation: formData.isRemoteLocation,
            displacementKm: formData.displacementKm,
            displacementValue: formData.displacementValue,
            adhesionValue: formData.adhesionValue,
            technicianPaid: formData.technicianPaid,
            technicianPaymentAmount: formData.technicianPaymentAmount,
            technicianPaymentDate: formData.technicianPaymentDate,
            amountReceivedByTechnician: formData.amountReceivedByTechnician,
            locationAddress: formData.locationAddress,
            notes: formData.notes,
            clientName: formData.clientName,
            clientPhone: formData.clientPhone,
            vehiclePlate: formData.vehiclePlate,
            vehicleModel: formData.vehicleModel,
            fipeValue: formData.fipeValue,
            installedImei: formData.installedImei,
            installedTagImei: formData.installedTagImei,
            // Log de histórico
            history: [...schedule.history, {
                action: historyAction,
                actionBy: currentUserName,
                timestamp: Date.now(),
                details: historyDetails,
                statusSnapshot: newStatus
            }]
        };

        onUpdate(updatedSchedule);
        addNotification('success', historyAction, 'Status atualizado com sucesso.');
    };

    const handleConfirmCancel = () => {
        const currentUserName = currentUser?.name || 'Admin';
        const updatedSchedule: Schedule = {
            ...schedule,
            status: 'Cancelada',
            history: [...schedule.history, {
                action: 'Cancelada',
                actionBy: currentUserName,
                timestamp: Date.now(),
                details: `Cancelado por ${currentUserName}`,
                statusSnapshot: 'Cancelada'
            }]
        };
        onUpdate(updatedSchedule);
        setConfirmCancelOpen(false);
        addNotification('success', 'Cancelada', 'Solicitação cancelada com sucesso.');
    };

    const handleConfirmDelete = () => {
        if (onDelete) {
            onDelete(schedule.id);
            setConfirmDeleteOpen(false);
        }
    };

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
            serviceType: formData.serviceType,
            needsInspection: formData.needsInspection,
            paymentOnSite: formData.paymentOnSite,
            notes: formData.notes, 
            clientName: formData.clientName,
            clientPhone: formData.clientPhone,
            vehiclePlate: formData.vehiclePlate,
            vehicleModel: formData.vehicleModel,
            fipeValue: formData.fipeValue,
            installedImei: formData.installedImei,
            installedTagImei: formData.installedTagImei,
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

    const handleUserPaymentSave = () => {
        const updatedSchedule: Schedule = {
            ...schedule,
            technicianPaid: formData.technicianPaid,
            technicianPaymentAmount: formData.technicianPaymentAmount,
            technicianPaymentDate: formData.technicianPaymentDate,
            amountReceivedByTechnician: formData.amountReceivedByTechnician,
            history: [...schedule.history, { 
                action: 'Atualizou', 
                actionBy: currentUser?.name || 'Usuário', 
                timestamp: Date.now(), 
                details: 'Atualizou informações de pagamento do técnico' 
            }]
        };
        onUpdate(updatedSchedule);
        setIsEditingPayment(false);
        addNotification('success', 'Atualizado', 'Informações de pagamento salvas.');
    };

    // Salvar Apenas Dados (sem mudar status)
    const handleAdminDataSave = () => {
        const updatedSchedule: Schedule = {
            ...schedule,
            confirmedDate: formData.date,
            confirmedTime: formData.time,
            technicianId: formData.technicianId || undefined,
            companyId: formData.companyId || undefined,
            deviceType: formData.deviceType,
            serviceType: formData.serviceType,
            needsInspection: formData.needsInspection,
            paymentOnSite: formData.paymentOnSite,
            isRemoteLocation: formData.isRemoteLocation,
            displacementKm: formData.displacementKm,
            displacementValue: formData.displacementValue,
            adhesionValue: formData.adhesionValue,
            technicianPaid: formData.technicianPaid,
            technicianPaymentAmount: formData.technicianPaymentAmount,
            technicianPaymentDate: formData.technicianPaymentDate,
            amountReceivedByTechnician: formData.amountReceivedByTechnician,
            locationAddress: formData.locationAddress,
            notes: formData.notes,
            clientName: formData.clientName,
            clientPhone: formData.clientPhone,
            vehiclePlate: formData.vehiclePlate,
            vehicleModel: formData.vehicleModel,
            fipeValue: formData.fipeValue,
            installedImei: formData.installedImei,
            installedTagImei: formData.installedTagImei,
            history: [...schedule.history, {
                action: 'Editou',
                actionBy: currentUser?.name || 'Admin',
                timestamp: Date.now(),
                details: 'Atualizou dados de agendamento'
            }]
        };
        onUpdate(updatedSchedule);
        addNotification('success', 'Atualizado', 'Dados salvos.');
    };

    const handleCopyClientMessage = () => {
        const dateRaw = formData.date;
        const dateDisplay = dateRaw ? getDisplayDate({ confirmedDate: dateRaw } as Schedule) : 'A definir';
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
        const dateDisplay = dateRaw ? getDisplayDate({ confirmedDate: dateRaw } as Schedule) : 'A definir';
        const timeDisplay = formData.time || '--:--';
        
        const regionalName = companies.find(c => c.id === formData.companyId)?.name || 'N/A';
        const clientInfo = schedule.clientName 
            ? `${schedule.clientName}${schedule.clientPhone ? ` (${schedule.clientPhone})` : ''}` 
            : schedule.requesterName;

        const mapLink = (schedule.locationLat && schedule.locationLng)
            ? `https://www.google.com/maps?q=${schedule.locationLat},${schedule.locationLng}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.locationAddress)}`;

        const msg = `*NOVA SOLICITAÇÃO TÉCNICA*\n\n` +
            `🏢 *Regional:* ${regionalName}\n` +
            `🚗 *Veículo:* ${schedule.vehicleModel}\n` +
            `🪪 *Placa:* ${schedule.vehiclePlate}\n` +
            `👤 *Cliente:* ${clientInfo}\n` +
            `📡 *Equipamento:* ${formData.deviceType}\n` +
            `🔧 *Serviço:* ${schedule.serviceType}\n` +
            `📋 *Necessita de vistoria?* ${formData.needsInspection ? 'Sim' : 'Não'}\n` +
            `💰 *Pagamento no local?* ${formData.paymentOnSite ? 'Sim' : 'Não'}\n` +
            `📝 *Observações:* ${formData.notes || 'Nenhuma'}\n` +
            `📅 *Data Pref:* ${dateDisplay} às ${timeDisplay}\n` +
            `📍 *Local:* ${formData.locationAddress}\n` +
            `🗺 *Google Maps:* ${mapLink}`;

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
        const dateDisplay = dateRaw ? getDisplayDate({ confirmedDate: dateRaw } as Schedule) : 'A definir';
        const timeDisplay = formData.time || '--:--';

        const regionalName = companies.find(c => c.id === formData.companyId)?.name || 'N/A';
        const clientInfo = schedule.clientName 
            ? `${schedule.clientName}${schedule.clientPhone ? ` (${schedule.clientPhone})` : ''}` 
            : schedule.requesterName;

        const mapLink = (schedule.locationLat && schedule.locationLng)
            ? `https://www.google.com/maps?q=${schedule.locationLat},${schedule.locationLng}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.locationAddress)}`;

        const msg = `*NOVA SOLICITAÇÃO TÉCNICA*\n\n` +
            `🏢 *Regional:* ${regionalName}\n` +
            `🚗 *Veículo:* ${schedule.vehicleModel}\n` +
            `🪪 *Placa:* ${schedule.vehiclePlate}\n` +
            `👤 *Cliente:* ${clientInfo}\n` +
            `📡 *Equipamento:* ${formData.deviceType}\n` +
            `🔧 *Serviço:* ${schedule.serviceType}\n` +
            `📋 *Necessita de vistoria?* ${formData.needsInspection ? 'Sim' : 'Não'}\n` +
            `💰 *Pagamento no local?* ${formData.paymentOnSite ? 'Sim' : 'Não'}\n` +
            `📝 *Observações:* ${formData.notes || 'Nenhuma'}\n` +
            `📅 *Data Pref:* ${dateDisplay} às ${timeDisplay}\n` +
            `📍 *Local:* ${formData.locationAddress}\n` +
            `🗺 *Google Maps:* ${mapLink}`;
            
        const url = `https://wa.me/55${selectedTech.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    };

    // Lógica para determinar quem está verificando atualmente
    const lastVerifier = [...schedule.history].reverse().find(h => h.action === 'Verificando' || h.action === 'Assumiu');
    const isBeingVerifiedByMe = lastVerifier && lastVerifier.actionBy === currentUser?.name;
    const isBeingVerifiedByOther = lastVerifier && lastVerifier.actionBy !== currentUser?.name;

    if (isPrivileged) {
        return (
            <div className="modal-shell">
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
                                
                                {/* CARD INFO */}
                                <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-full pr-4">
                                            <p className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-widest mb-1">Solicitante</p>
                                            <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase mb-2">{schedule.requesterName}</p>
                                            
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                <div>
                                                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider mb-1 block">Nome do Cliente</label>
                                                    <input type="text" value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} className="w-full bg-white dark:bg-zinc-900 px-2 py-1.5 rounded-lg text-xs font-bold outline-none border border-zinc-200 dark:border-zinc-800 focus:border-primary-500" placeholder="Opcional" />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider mb-1 block">Telefone do Cliente</label>
                                                    <input type="text" value={formData.clientPhone} onChange={e => setFormData({...formData, clientPhone: e.target.value})} className="w-full bg-white dark:bg-zinc-900 px-2 py-1.5 rounded-lg text-xs font-bold outline-none border border-zinc-200 dark:border-zinc-800 focus:border-primary-500" placeholder="Opcional" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 shrink-0">
                                            <Clock size={12} className="text-zinc-400"/>
                                            <span className="text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-300">{new Date(schedule.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    <div className="h-px bg-zinc-200 dark:bg-zinc-800 w-full mb-4" />

                                    <div className="mb-2 flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-widest">Veículo</span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase ${
                                            schedule.status === 'Concluída' ? 'bg-emerald-100 text-emerald-700' :
                                            schedule.status === 'Cancelada' ? 'bg-red-100 text-red-700' :
                                            'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                                        }`}>
                                            {schedule.serviceType} • {schedule.status}
                                        </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        <div>
                                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider mb-1 block">Placa</label>
                                            <input type="text" value={formData.vehiclePlate} onChange={e => setFormData({...formData, vehiclePlate: e.target.value.toUpperCase()})} className="w-full bg-white dark:bg-zinc-900 px-2 py-1.5 rounded-lg text-sm font-black uppercase outline-none border border-zinc-200 dark:border-zinc-800 focus:border-primary-500" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider mb-1 block">Modelo</label>
                                            <input type="text" value={formData.vehicleModel} onChange={e => setFormData({...formData, vehicleModel: e.target.value.toUpperCase()})} className="w-full bg-white dark:bg-zinc-900 px-2 py-1.5 rounded-lg text-xs font-bold uppercase outline-none border border-zinc-200 dark:border-zinc-800 focus:border-primary-500" />
                                        </div>
                                        {formData.fipeValue && (
                                            <div className="col-span-2">
                                                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider mb-1 block">Valor FIPE</label>
                                                <input type="text" value={formData.fipeValue} onChange={e => setFormData({...formData, fipeValue: e.target.value})} className="w-full bg-white dark:bg-zinc-900 px-2 py-1.5 rounded-lg text-xs font-bold outline-none border border-zinc-200 dark:border-zinc-800 focus:border-primary-500" />
                                            </div>
                                        )}
                                    </div>

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
                                                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2 mb-1"><Wrench size={12}/> Tipo Serviço</label>
                                                <select value={formData.serviceType} onChange={e => setFormData({...formData, serviceType: e.target.value as any})} className="w-full bg-zinc-100 dark:bg-zinc-950 px-2 py-1.5 rounded-lg text-xs font-bold outline-none border border-transparent focus:border-primary-500">
                                                    <option value="Instalação">Instalação</option>
                                                    <option value="Manutenção">Manutenção</option>
                                                    <option value="Retirada">Retirada</option>
                                                    <option value="Vistoria">Vistoria</option>
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
                                        <div className="flex flex-col gap-3">
                                            <Checkbox checked={formData.needsInspection} onChange={(checked) => setFormData({...formData, needsInspection: checked})}>
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Necessita Vistoria</span>
                                            </Checkbox>
                                            <Checkbox checked={formData.paymentOnSite} onChange={(checked) => setFormData({...formData, paymentOnSite: checked})}>
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Pagamento no Local</span>
                                            </Checkbox>
                                        </div>
                                    </div>

                                    <div className="mt-4 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-start gap-3">
                                        <MapPin size={16} className="text-red-500 shrink-0 mt-0.5"/>
                                        <div className="w-full">
                                            <input type="text" value={formData.locationAddress} onChange={e => setFormData({...formData, locationAddress: e.target.value})} className="w-full bg-transparent border-none p-0 text-xs font-bold text-zinc-700 dark:text-zinc-300 focus:ring-0 focus:outline-none"/>
                                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(schedule.locationAddress)}`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-[#f59e0b] uppercase tracking-widest inline-flex items-center gap-1 hover:underline mt-1">Ver no Mapa <ExternalLink size={10}/></a>
                                        </div>
                                    </div>

                                    {/* Mini Mapa Admin */}
                                    <div className="mt-4 h-40 w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-inner">
                                        <MapComponent 
                                            locations={[serviceLocation]} 
                                            highlightedTagId="service-tag"
                                        />
                                    </div>
                                    
                                    {(schedule.installedImei || schedule.installedTagImei) && (
                                        <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 mb-2">
                                                <ShieldCheck size={14}/>
                                                <span className="text-[9px] font-black uppercase tracking-widest">Equipamentos Instalados</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {schedule.installedImei && (
                                                    <div>
                                                        <span className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-500 tracking-wider mb-1 block">Rastreador</span>
                                                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">{schedule.installedImei}</p>
                                                    </div>
                                                )}
                                                {schedule.installedTagImei && (
                                                    <div>
                                                        <span className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-500 tracking-wider mb-1 block">Tag</span>
                                                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">{schedule.installedTagImei}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="mt-4">
                                        <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2 mb-1"><FileText size={12}/> Observações</label>
                                        <textarea 
                                            value={formData.notes} 
                                            onChange={e => setFormData({...formData, notes: e.target.value})} 
                                            className="w-full bg-zinc-50 dark:bg-zinc-950 px-3 py-2 rounded-xl text-xs font-medium outline-none border border-zinc-200 dark:border-zinc-800 focus:border-primary-500 min-h-[80px]"
                                            placeholder="Observações do serviço..."
                                        />
                                    </div>
                                </div>

                                {/* LOCAL DISTANTE & ORÇAMENTO */}
                                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-3xl border border-amber-100 dark:border-amber-900/20">
                                    <Checkbox checked={formData.isRemoteLocation} onChange={checked => setFormData({...formData, isRemoteLocation: checked})}>
                                        <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 tracking-widest flex items-center gap-2"><Milestone size={14}/> Local Distante (Ativar Orçamento)</span>
                                    </Checkbox>

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

                                {/* Inputs de Controle e FINANCEIRO */}
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

                                    {/* Pagamento ao Técnico */}
                                    {formData.technicianId && (
                                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                                            <Checkbox checked={formData.amountReceivedByTechnician > 0} onChange={checked => setFormData({...formData, amountReceivedByTechnician: checked ? (formData.amountReceivedByTechnician || 1) : 0})}>
                                                <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-widest flex items-center gap-2"><Wallet size={14}/> Pagamento ao Técnico</span>
                                            </Checkbox>

                                            {formData.amountReceivedByTechnician > 0 && (
                                                <div className="grid grid-cols-2 gap-4 mt-4 animate-in slide-in-from-top-2">
                                                    <div>
                                                        <label className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-500 mb-1 block">Valor Recebido (R$)</label>
                                                        <div className="relative">
                                                            <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400"/>
                                                            <input type="number" step="0.01" value={formData.amountReceivedByTechnician} onChange={e => setFormData({...formData, amountReceivedByTechnician: parseFloat(e.target.value)})} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-950 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs font-bold outline-none focus:border-emerald-500" placeholder="R$ 0,00"/>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-500 mb-1 block">Data do Pagamento</label>
                                                        <input type="date" value={formData.technicianPaymentDate} onChange={e => setFormData({...formData, technicianPaymentDate: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs font-bold outline-none focus:border-emerald-500" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

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
                                    
                                    {/* --- WORKFLOW ACTIONS --- */}
                                    <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                                        <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-2">Ações de Fluxo</p>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {/* 1. SE SOLICITADA -> VERIFICAR */}
                                            {schedule.status === 'Solicitada' && (
                                                <button onClick={() => handleWorkflowAction('verify')} className="py-4 bg-primary-500 text-black rounded-xl font-black uppercase text-xs tracking-widest hover:scale-[1.01] transition-all flex items-center justify-center gap-2 shadow-lg">
                                                    <ShieldCheck size={16}/> Verificar & Assumir
                                                </button>
                                            )}

                                            {/* 2. SE EM ANÁLISE -> CONFIRMAR OU ORÇAR */}
                                            {['Solicitada', 'Em análise'].includes(schedule.status) && (
                                                <>
                                                    <button onClick={() => handleWorkflowAction('confirm')} className="py-4 bg-emerald-500 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shadow-lg">
                                                        <CheckCircle2 size={16}/> Confirmar Agendamento
                                                    </button>
                                                    
                                                    {schedule.status === 'Em análise' && isBeingVerifiedByOther && (
                                                        <button onClick={() => handleWorkflowAction('verify')} className="py-4 bg-amber-500 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-amber-600 transition-all flex items-center justify-center gap-2 shadow-sm">
                                                            <Activity size={16}/> Assumir (De: {lastVerifier?.actionBy})
                                                        </button>
                                                    )}

                                                    <button onClick={() => handleWorkflowAction('budget')} className="py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-700">
                                                        <DollarSign size={16}/> Enviar p/ Orçamento
                                                    </button>
                                                </>
                                            )}

                                            {/* 3. SE ORÇAMENTO -> APROVAR (CONFIRMAR) */}
                                            {schedule.status === 'Em orçamento' && (
                                                <button onClick={() => handleWorkflowAction('confirm')} className="py-4 bg-emerald-500 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shadow-lg col-span-2">
                                                    <CheckCircle2 size={16}/> Aprovar Orçamento
                                                </button>
                                            )}

                                            {/* 4. SE AGENDADA OU TÉCNICO NO LOCAL -> AÇÕES DE CAMPO */}
                                            {['Confirmada', 'Reagendada', 'Autorizada', 'Técnico no local', 'Cliente no local'].includes(schedule.status) && !isFinishing && (
                                                <>
                                                    {/* Botão Técnico no Local (apenas se ainda não estiver) */}
                                                    {schedule.status !== 'Técnico no local' && schedule.status !== 'Cliente no local' && (
                                                        <button onClick={() => handleWorkflowAction('onsite')} className="py-4 bg-blue-500 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg">
                                                            <MapPin size={16}/> {technicians.find(t => t.id === schedule.technicianId)?.serviceLocationType === 'Ponto Fixo' ? 'Cliente no Local' : 'Técnico no Local'}
                                                        </button>
                                                    )}

                                                    {/* Botão Finalizar (Sempre visível nesta etapa agora) */}
                                                    <button onClick={() => handleWorkflowAction('finish')} className="py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg">
                                                        <Check size={16} strokeWidth={3}/> Finalizar Serviço
                                                    </button>

                                                    <button onClick={() => handleWorkflowAction('reschedule')} className="py-4 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all flex items-center justify-center gap-2 border border-amber-200 dark:border-amber-800">
                                                        <RotateCcw size={16}/> Reagendar
                                                    </button>
                                                    <button onClick={() => handleWorkflowAction('frustrate')} className="py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-700">
                                                        <AlertTriangle size={16}/> Frustrada
                                                    </button>
                                                </>
                                            )}

                                            {/* IMEI Inputs for Finishing */}
                                            {isFinishing && (
                                                <div className="col-span-1 md:col-span-2 space-y-4 bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
                                                    <h4 className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest">Informações de Conclusão</h4>
                                                    
                                                    {(formData.deviceType === 'Rastreador' || formData.deviceType === 'Rastreador + Tag') && (
                                                        <input type="text" value={formData.installedImei} onChange={e => setFormData({...formData, installedImei: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold text-sm outline-none" placeholder="IMEI do Rastreador" />
                                                    )}
                                                    {(formData.deviceType === 'Tag' || formData.deviceType === 'Rastreador + Tag') && (
                                                        <input type="text" value={formData.installedTagImei} onChange={e => setFormData({...formData, installedTagImei: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold text-sm outline-none" placeholder="ID da Tag" />
                                                    )}

                                                    <div className="flex gap-2 pt-2">
                                                        <button onClick={() => setIsFinishing(false)} className="flex-1 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase">Cancelar</button>
                                                        <button onClick={() => handleWorkflowAction('finish')} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase shadow-lg flex items-center justify-center gap-2"><CheckCircle2 size={16}/> Confirmar Conclusão</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                            {/* 5. Ações para Aguardando Vínculo (Admin) */}
                                            {schedule.status === 'Aguardando Vínculo' && (
                                                <div className="mt-4 p-4 border border-violet-200 dark:border-violet-900/30 bg-violet-50 dark:bg-violet-900/10 rounded-2xl flex flex-col gap-3">
                                                    <div className="flex items-start gap-3">
                                                        <Activity className="text-violet-500 mt-0.5" size={16} />
                                                        <div>
                                                            <h4 className="text-[10px] font-black uppercase text-violet-700 dark:text-violet-400 tracking-widest">Aguardando Vínculo</h4>
                                                            <p className="text-xs font-medium text-violet-600 dark:text-violet-300 mt-1">O técnico finalizou o serviço. Confirme o vínculo do equipamento ao veículo.</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => {
                                                        const updated = {
                                                            ...schedule,
                                                            status: 'Concluída' as const,
                                                            history: [...schedule.history, { 
                                                                action: 'Vínculo Confirmado', 
                                                                actionBy: currentUser?.name || 'Consultor', 
                                                                timestamp: Date.now(), 
                                                                details: 'Vínculo de equipamento confirmado pelo consultor, finalizando serviço' 
                                                            }]
                                                        };
                                                        onUpdate(updated);
                                                        addNotification('success', 'Vínculo Confirmado', 'Serviço concluído com sucesso.');
                                                    }} className="py-3 bg-violet-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-violet-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20">
                                                        <CheckCircle2 size={16}/> Confirmar Equipamento Vinculado
                                                    </button>
                                                </div>
                                            )}

                                            {/* AÇÕES DESTRUTIVAS E GERAIS */}
                                            <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                                <button onClick={handleAdminDataSave} className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
                                                    <Save size={14}/> Salvar Dados
                                                </button>
                                                
                                                {schedule.status !== 'Cancelada' && schedule.status !== 'Concluída' && schedule.status !== 'Aguardando Vínculo' && (
                                                    <button onClick={() => handleWorkflowAction('cancel')} className="flex-1 py-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-200 dark:hover:bg-red-900/40 transition-all flex items-center justify-center gap-2">
                                                        <AlertTriangle size={14}/> Cancelar Serviço
                                                    </button>
                                                )}
                                            
                                            {onDelete && (
                                                <button onClick={() => handleWorkflowAction('delete')} className="p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all" title="Excluir Registro">
                                                    <Trash2 size={16}/>
                                                </button>
                                            )}
                                        </div>
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

                <ConfirmModal
                    isOpen={confirmCancelOpen}
                    onClose={() => setConfirmCancelOpen(false)}
                    onConfirm={handleConfirmCancel}
                    title="Cancelar Solicitação"
                    message="Deseja realmente cancelar esta solicitação? Esta ação não pode ser desfeita."
                    type="danger"
                />

                <ConfirmModal
                    isOpen={confirmDeleteOpen}
                    onClose={() => setConfirmDeleteOpen(false)}
                    onConfirm={handleConfirmDelete}
                    title="Excluir Registro"
                    message="ATENÇÃO: Isso excluirá o registro permanentemente. Continuar?"
                    type="danger"
                />
            </div>
        );
    }

    // Render User/Standard View (Updated - Detailed & Merged)
    return (
        <div className="modal-shell">
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
                    {/* User Edit Form */}
                    {isUserEditing ? (
                        <div className="space-y-4 bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1 block">Nome do Cliente</label>
                                    <input type="text" value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none" placeholder="Opcional" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1 block">Telefone do Cliente</label>
                                    <input type="text" value={formData.clientPhone} onChange={e => setFormData({...formData, clientPhone: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none" placeholder="Opcional" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1 block">Placa do Veículo</label>
                                    <input type="text" value={formData.vehiclePlate} onChange={e => setFormData({...formData, vehiclePlate: e.target.value.toUpperCase()})} className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-black uppercase outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1 block">Modelo do Veículo</label>
                                    <input type="text" value={formData.vehicleModel} onChange={e => setFormData({...formData, vehicleModel: e.target.value.toUpperCase()})} className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold uppercase outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1 block">Endereço</label>
                                <input type="text" value={formData.locationAddress} onChange={e => setFormData({...formData, locationAddress: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none"/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1 block">Tipo de Serviço</label>
                                    <select value={formData.serviceType} onChange={e => setFormData({...formData, serviceType: e.target.value as any})} className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none">
                                        <option value="Instalação">Instalação</option>
                                        <option value="Manutenção">Manutenção</option>
                                        <option value="Retirada">Retirada</option>
                                        <option value="Vistoria">Vistoria</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1 block">Tipo de Equipamento</label>
                                    <select value={formData.deviceType} onChange={e => setFormData({...formData, deviceType: e.target.value as any})} className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none">
                                        <option value="Rastreador">Rastreador</option>
                                        <option value="Tag">Tag</option>
                                        <option value="Rastreador + Tag">Rastreador + Tag</option>
                                        <option value="Não precisa">Não precisa</option>
                                    </select>
                                </div>
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
                            <div>
                                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1 block">Observações</label>
                                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none min-h-[80px]" placeholder="Informações adicionais..."/>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setIsUserEditing(false)} className="flex-1 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase">Cancelar</button>
                                <button onClick={handleUserSave} className="flex-1 py-3 bg-primary-500 text-black rounded-xl font-bold text-xs uppercase shadow-lg">Salvar</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* 1. Status Banner */}
                            <div className={`p-5 rounded-2xl border flex items-center gap-4 ${
                                schedule.status === 'Confirmada' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20 text-emerald-600 dark:text-emerald-400' :
                                schedule.status === 'Cancelada' ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400' :
                                'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20 text-blue-600 dark:text-blue-400'
                            }`}>
                                {schedule.status === 'Confirmada' ? <CheckCircle2 size={32}/> : schedule.status === 'Cancelada' ? <X size={32}/> : <Clock size={32}/>}
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Status Atual</p>
                                    <p className="text-xl font-black uppercase tracking-tight">{schedule.status}</p>
                                </div>
                            </div>

                            {/* 2. Main Info Card */}
                            <div className="bg-zinc-900 text-white p-6 rounded-3xl relative overflow-hidden">
                                <div className="relative z-10">
                                    <h3 className="text-3xl font-display font-black uppercase tracking-tighter">{schedule.vehiclePlate}</h3>
                                    <p className="text-zinc-400 text-xs font-bold uppercase mt-1">{schedule.vehicleModel}</p>
                                    {schedule.fipeValue && (
                                        <p className="text-zinc-500 text-[10px] font-bold uppercase mt-1">Valor FIPE: {schedule.fipeValue}</p>
                                    )}
                                    <div className="flex gap-2 mt-4">
                                        <span className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-black uppercase">{schedule.serviceType}</span>
                                        <span className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-black uppercase">{schedule.deviceType}</span>
                                    </div>
                                </div>
                                <div className="absolute right-[-10px] bottom-[-10px] opacity-10"><Activity size={100}/></div>
                            </div>

                            {/* 3. Grid Details */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-2 text-zinc-400 mb-1">
                                        <Calendar size={14}/>
                                        <span className="text-[9px] font-black uppercase tracking-widest">Data</span>
                                    </div>
                                    <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase">
                                        {getDisplayDate(schedule)}
                                    </p>
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-2 text-zinc-400 mb-1">
                                        <Clock size={14}/>
                                        <span className="text-[9px] font-black uppercase tracking-widest">Horário</span>
                                    </div>
                                    <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase">
                                        {schedule.confirmedTime || schedule.preferredTime || '--:--'}
                                    </p>
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 col-span-2 sm:col-span-1">
                                    <div className="flex items-center gap-2 text-zinc-400 mb-1">
                                        <Wrench size={14}/>
                                        <span className="text-[9px] font-black uppercase tracking-widest">Técnico</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {assignedTech && <div className="w-2 h-2 rounded-full" style={{backgroundColor: assignedTech.color}}/>}
                                        <p className={`text-sm font-bold uppercase ${assignedTech ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 italic'}`}>
                                            {assignedTech ? assignedTech.name : 'A definir'}
                                        </p>
                                    </div>
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 col-span-2 sm:col-span-1">
                                    <div className="flex items-center gap-2 text-zinc-400 mb-1">
                                        <UserIcon size={14}/>
                                        <span className="text-[9px] font-black uppercase tracking-widest">Cliente</span>
                                    </div>
                                    <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase">
                                        {schedule.clientName || schedule.requesterName}
                                    </p>
                                    {schedule.clientPhone && (
                                        <p className="text-[10px] font-mono text-zinc-500 mt-1">{schedule.clientPhone}</p>
                                    )}
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 col-span-2 sm:col-span-1">
                                    <div className="flex items-center gap-2 text-zinc-400 mb-1">
                                        <Building2 size={14}/>
                                        <span className="text-[9px] font-black uppercase tracking-widest">Regional</span>
                                    </div>
                                    <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase">
                                        {responsibleCompany?.name || 'Não informada'}
                                    </p>
                                </div>
                                {isEditingPayment ? (
                                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 col-span-2 sm:col-span-1">
                                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 mb-3">
                                            <Wallet size={14}/>
                                            <span className="text-[9px] font-black uppercase tracking-widest">Pagamento ao Técnico</span>
                                        </div>
                                        <div className="space-y-3">
                                            <Checkbox checked={formData.amountReceivedByTechnician > 0} onChange={checked => setFormData({...formData, amountReceivedByTechnician: checked ? (formData.amountReceivedByTechnician || 1) : 0})}>
                                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Pago</span>
                                            </Checkbox>
                                            
                                            {formData.amountReceivedByTechnician > 0 && (
                                                <div className="grid grid-cols-1 gap-2">
                                                    <div>
                                                        <label className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-500 mb-1 block">Valor (R$)</label>
                                                        <input type="number" step="0.01" value={formData.amountReceivedByTechnician} onChange={e => setFormData({...formData, amountReceivedByTechnician: parseFloat(e.target.value)})} className="w-full px-2 py-1.5 bg-white dark:bg-zinc-950 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-xs font-bold outline-none focus:border-emerald-500" placeholder="0,00"/>
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-500 mb-1 block">Data</label>
                                                        <input type="date" value={formData.technicianPaymentDate} onChange={e => setFormData({...formData, technicianPaymentDate: e.target.value})} className="w-full px-2 py-1.5 bg-white dark:bg-zinc-950 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-xs font-bold outline-none focus:border-emerald-500" />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex gap-2 pt-2">
                                                <button onClick={() => setIsEditingPayment(false)} className="flex-1 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg font-bold text-[10px] uppercase">Cancelar</button>
                                                <button onClick={handleUserPaymentSave} className="flex-1 py-2 bg-emerald-500 text-white rounded-lg font-bold text-[10px] uppercase shadow-md">Salvar</button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (schedule.amountReceivedByTechnician && schedule.amountReceivedByTechnician > 0) ? (
                                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 col-span-2 sm:col-span-1 relative group">
                                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 mb-1">
                                            <Wallet size={14}/>
                                            <span className="text-[9px] font-black uppercase tracking-widest">Pagamento ao Técnico</span>
                                        </div>
                                        <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300 uppercase">
                                            R$ {(schedule.amountReceivedByTechnician || 0).toFixed(2)}
                                        </p>
                                        {schedule.technicianPaymentDate && (
                                            <p className="text-[10px] font-mono text-emerald-700 dark:text-emerald-500 mt-1">
                                                {new Date(schedule.technicianPaymentDate).toLocaleDateString()}
                                            </p>
                                        )}
                                        {currentUser?.role !== 'technician' && (
                                            <button 
                                                onClick={() => {
                                                    setFormData({...formData, amountReceivedByTechnician: schedule.amountReceivedByTechnician || 0, technicianPaymentDate: schedule.technicianPaymentDate || new Date().toISOString().split('T')[0]});
                                                    setIsEditingPayment(true);
                                                }} 
                                                className="absolute top-2 right-2 p-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Edit2 size={12}/>
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 col-span-2 sm:col-span-1 flex flex-col justify-center">
                                        <div className="flex items-center gap-2 text-zinc-400 mb-2">
                                            <Wallet size={14}/>
                                            <span className="text-[9px] font-black uppercase tracking-widest">Pagamento ao Técnico</span>
                                        </div>
                                        {currentUser?.role !== 'technician' ? (
                                            <button 
                                                onClick={() => {
                                                    setFormData({...formData, amountReceivedByTechnician: schedule.amountReceivedByTechnician || 0, technicianPaymentDate: schedule.technicianPaymentDate || new Date().toISOString().split('T')[0]});
                                                    setIsEditingPayment(true);
                                                }} 
                                                className="w-full py-2 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-200 dark:hover:bg-emerald-900/40 transition-all"
                                            >
                                                Adicionar Pagamento
                                            </button>
                                        ) : (
                                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Pendente</p>
                                        )}
                                    </div>
                                )}
                                    <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 col-span-2">
                                        <div className="flex items-center gap-2 text-zinc-400 mb-1">
                                            <MapPin size={14}/>
                                            <span className="text-[9px] font-black uppercase tracking-widest">Local</span>
                                        </div>
                                        <p className="text-xs font-bold text-zinc-900 dark:text-white line-clamp-2" title={schedule.locationAddress}>
                                            {schedule.locationAddress}
                                        </p>
                                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(schedule.locationAddress)}`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-[#f59e0b] uppercase tracking-widest inline-flex items-center gap-1 hover:underline mt-2">Ver no Mapa <ExternalLink size={10}/></a>
                                        
                                        {/* Mini Mapa User */}
                                        <div className="mt-3 h-40 w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                            <MapComponent 
                                                locations={[serviceLocation]} 
                                                highlightedTagId="service-tag"
                                            />
                                        </div>
                                    </div>
                                {(schedule.installedImei || schedule.installedTagImei) && (
                                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 col-span-2">
                                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 mb-2">
                                            <ShieldCheck size={14}/>
                                            <span className="text-[9px] font-black uppercase tracking-widest">Equipamentos Instalados</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {schedule.installedImei && (
                                                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                                                    <span className="opacity-70 font-medium">Rastreador:</span> {schedule.installedImei}
                                                </p>
                                            )}
                                            {schedule.installedTagImei && (
                                                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                                                    <span className="opacity-70 font-medium">Tag:</span> {schedule.installedTagImei}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Aguardando Vínculo Action */}
                            {schedule.status === 'Aguardando Vínculo' && currentUser?.role !== 'technician' && (
                                <div className="mb-4 p-4 border border-violet-200 dark:border-violet-900/30 bg-violet-50 dark:bg-violet-900/10 rounded-2xl flex flex-col gap-3">
                                    <div className="flex items-start gap-3">
                                        <Activity className="text-violet-500 mt-0.5" size={16} />
                                        <div>
                                            <h4 className="text-[10px] font-black uppercase text-violet-700 dark:text-violet-400 tracking-widest">Aguardando Vínculo</h4>
                                            <p className="text-xs font-medium text-violet-600 dark:text-violet-300 mt-1">O técnico finalizou o serviço. Confirme o vínculo do equipamento ao veículo.</p>
                                        </div>
                                    </div>
                                    <button onClick={() => {
                                        const updated = {
                                            ...schedule,
                                            status: 'Concluída' as const,
                                            history: [...schedule.history, { 
                                                action: 'Vínculo Confirmado', 
                                                actionBy: currentUser?.name || 'Consultor', 
                                                timestamp: Date.now(), 
                                                details: 'Vínculo de equipamento confirmado pelo consultor, finalizando serviço' 
                                            }]
                                        };
                                        onUpdate(updated);
                                        addNotification('success', 'Vínculo Confirmado', 'Serviço concluído com sucesso.');
                                    }} className="py-3 bg-violet-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-violet-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20">
                                        <CheckCircle2 size={16}/> Confirmar Equipamento Vinculado
                                    </button>
                                </div>
                            )}

                            {/* 4. Notes */}
                            {schedule.notes && (
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-2xl">
                                    <div className="flex items-center gap-2 text-blue-500 mb-2">
                                        <FileText size={14}/>
                                        <span className="text-[9px] font-black uppercase tracking-widest">Observações</span>
                                    </div>
                                    <p className="text-xs text-blue-900 dark:text-blue-100 font-medium">{schedule.notes}</p>
                                </div>
                            )}

                            {/* 5. History Timeline (Merged Feature) */}
                            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-4">Histórico de Atividades</h4>
                                <div className="space-y-4 pl-2">
                                    {schedule.history.slice().reverse().map((h, i) => (
                                        <div key={i} className="relative pl-6 border-l border-zinc-200 dark:border-zinc-800 last:border-0 pb-2">
                                            <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700 border-2 border-white dark:border-zinc-900" />
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-black uppercase text-zinc-900 dark:text-white">{h.action}</span>
                                                    <span className="text-[9px] font-mono text-zinc-400">{new Date(h.timestamp).toLocaleDateString()} às {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">Por: {h.actionBy}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Edit Button (Conditional) */}
                            {['Solicitada', 'Em análise', 'Em orçamento', 'Autorizada', 'Confirmada'].includes(schedule.status) && currentUser?.role !== 'technician' && (
                                <button onClick={() => {
                                    onClose();
                                    navigate('/schedule/new', { state: { editSchedule: schedule } });
                                }} className="w-full py-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-black uppercase text-zinc-500 hover:text-primary-500 hover:border-primary-500 transition-all flex items-center justify-center gap-2">
                                    <Edit2 size={16}/> Editar Informações
                                </button>
                            )}

                            {/* Technician Action Buttons */}
                            {currentUser?.role === 'technician' && (
                                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                                    {['Confirmada', 'Reagendada', 'Autorizada'].includes(schedule.status) && (
                                        <button 
                                            onClick={() => {
                                                const isPontoFixo = technicians.find(t => t.id === schedule.technicianId)?.serviceLocationType === 'Ponto Fixo';
                                                const newStatus = isPontoFixo ? 'Cliente no local' : 'Técnico no local';
                                                const actionText = isPontoFixo ? 'Cliente no local' : 'Chegou no local';
                                                const detailsText = isPontoFixo ? 'Técnico informou chegada do cliente' : 'Técnico informou chegada ao local';
                                                
                                                const updated = {
                                                    ...schedule,
                                                    status: newStatus as any,
                                                    history: [...schedule.history, { action: actionText, actionBy: currentUser?.name || 'Técnico', timestamp: Date.now(), details: detailsText }]
                                                };
                                                onUpdate(updated);
                                            }}
                                            className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                                        >
                                            <MapPin size={16}/> {technicians.find(t => t.id === schedule.technicianId)?.serviceLocationType === 'Ponto Fixo' ? 'Cliente no Local' : 'Cheguei no Local'}
                                        </button>
                                    )}
                                    
                                    {(schedule.status === 'Técnico no local' || schedule.status === 'Cliente no local') && (
                                        <div className="space-y-3 p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-2xl">
                                            <h4 className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-500 tracking-widest mb-2">Finalizar Serviço</h4>
                                            
                                            {isFinishing ? (
                                                <div className="space-y-3">
                                                    {(schedule.deviceType === 'Rastreador' || schedule.deviceType === 'Rastreador + Tag') && (
                                                        <div className="flex gap-2">
                                                            <input type="text" value={formData.installedImei} onChange={e => setFormData({...formData, installedImei: e.target.value})} className="flex-1 px-4 py-3 bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold text-sm outline-none" placeholder="IMEI do Rastreador" />
                                                            <button onClick={() => setScannerActive('imei')} className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl"><Camera size={20}/></button>
                                                        </div>
                                                    )}
                                                    {(schedule.deviceType === 'Tag' || schedule.deviceType === 'Rastreador + Tag') && (
                                                        <div className="flex gap-2">
                                                            <input type="text" value={formData.installedTagImei} onChange={e => setFormData({...formData, installedTagImei: e.target.value})} className="flex-1 px-4 py-3 bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold text-sm outline-none" placeholder="ID da Tag" />
                                                            <button onClick={() => setScannerActive('tag')} className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl"><Camera size={20}/></button>
                                                        </div>
                                                    )}
                                                    
                                                    {scannerActive && (
                                                        <div className="fixed inset-0 z-[6000] bg-black flex flex-col items-center justify-center p-4">
                                                            <div id={scannerActive === 'imei' ? "readerImei" : "readerTag"} className="w-full max-w-md aspect-square bg-black"></div>
                                                            <button onClick={() => {
                                                                if (scannerRef.current && scannerRef.current.isScanning) {
                                                                    scannerRef.current.stop().then(() => setScannerActive(null)).catch(console.error);
                                                                } else {
                                                                    setScannerActive(null);
                                                                }
                                                            }} className="mt-4 px-6 py-3 bg-zinc-700 text-white rounded-xl font-black uppercase">Cancelar</button>
                                                        </div>
                                                    )}

                                                    <div className="space-y-2 pt-2 border-t border-emerald-200 dark:border-emerald-800">
                                                        <h5 className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Ordem de Serviço</h5>
                                                        <input type="text" value={formData.osNumber} onChange={e => setFormData({...formData, osNumber: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold text-sm outline-none" placeholder="Número da OS (Opcional)" />
                                                        <textarea value={formData.osDetails} onChange={e => setFormData({...formData, osDetails: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold text-sm outline-none resize-none h-24" placeholder="Detalhes do serviço executado..." />
                                                        
                                                        <div className="mt-4">
                                                            <h5 className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 mb-2">Checklist do Veículo</h5>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {formData.checklist.map((item, index) => (
                                                                    <div key={index} className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-emerald-800/50 rounded-xl p-3 flex flex-col gap-2">
                                                                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{item.name}</span>
                                                                        <div className="flex justify-between items-center gap-4">
                                                                            <div className="flex flex-col gap-1">
                                                                                <span className="text-[9px] font-black uppercase text-zinc-400">Antes</span>
                                                                                <div className="flex gap-1">
                                                                                    {['OK', 'N/OK', 'N/A'].map(status => (
                                                                                        <button 
                                                                                            key={`before-${status}`}
                                                                                            onClick={() => {
                                                                                                const newChecklist = [...formData.checklist];
                                                                                                newChecklist[index] = { ...newChecklist[index], before: status as ChecklistStatus };
                                                                                                setFormData({...formData, checklist: newChecklist});
                                                                                            }}
                                                                                            className={`px-2 py-1 rounded text-[9px] font-bold transition-colors ${item.before === status ? 'bg-emerald-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                                                                                        >
                                                                                            {status}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex flex-col gap-1">
                                                                                <span className="text-[9px] font-black uppercase text-zinc-400">Após</span>
                                                                                <div className="flex gap-1">
                                                                                    {['OK', 'N/OK', 'N/A'].map(status => (
                                                                                        <button 
                                                                                            key={`after-${status}`}
                                                                                            onClick={() => {
                                                                                                const newChecklist = [...formData.checklist];
                                                                                                newChecklist[index] = { ...newChecklist[index], after: status as ChecklistStatus };
                                                                                                setFormData({...formData, checklist: newChecklist});
                                                                                            }}
                                                                                            className={`px-2 py-1 rounded text-[9px] font-bold transition-colors ${item.after === status ? 'bg-emerald-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                                                                                        >
                                                                                            {status}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <input type="text" value={formData.osSignature} onChange={e => setFormData({...formData, osSignature: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold text-sm outline-none mt-4" placeholder="Nome do Responsável (Assinatura)" />
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <button onClick={() => setIsFinishing(false)} className="flex-1 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase">Cancelar</button>
                                                        <button 
                                                            onClick={() => {
                                                                if (schedule.deviceType === 'Tag' && !formData.installedTagImei) { addNotification('error', 'Erro', 'Informe o ID da Tag.'); return; }
                                                                if (schedule.deviceType === 'Rastreador' && !formData.installedImei) { addNotification('error', 'Erro', 'Informe o IMEI do Rastreador.'); return; }
                                                                if (schedule.deviceType === 'Rastreador + Tag' && (!formData.installedImei || !formData.installedTagImei)) { addNotification('error', 'Erro', 'Informe o IMEI do Rastreador e o ID da Tag.'); return; }

                                                                const updated = {
                                                                    ...schedule,
                                                                    status: 'Aguardando Vínculo' as const,
                                                                    installedImei: formData.installedImei,
                                                                    installedTagImei: formData.installedTagImei,
                                                                    osNumber: formData.osNumber,
                                                                    osDetails: formData.osDetails,
                                                                    osSignature: formData.osSignature,
                                                                    checklist: formData.checklist,
                                                                    history: [...schedule.history, { action: 'Finalizou', actionBy: currentUser?.name || 'Técnico', timestamp: Date.now(), details: 'Técnico finalizou o serviço, aguardando vínculo' }]
                                                                };
                                                                onUpdate(updated);
                                                                setIsFinishing(false);
                                                                // Do not close immediately so they can generate PDF
                                                                // onClose();
                                                            }}
                                                            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                                                        >
                                                            <CheckCircle2 size={16}/> Confirmar Finalização
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => setIsFinishing(true)}
                                                    className="w-full mt-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                                                >
                                                    <CheckCircle2 size={16}/> Confirmar Finalização
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {schedule.status === 'Concluída' && (
                                        <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-2xl">
                                            <h4 className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-500 tracking-widest mb-2">Documentos</h4>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => generateOsPdf('os')}
                                                    className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                                                >
                                                    <FileText size={16}/> Gerar OS
                                                </button>
                                                <button 
                                                    onClick={() => generateOsPdf('receipt')}
                                                    className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-zinc-800/20"
                                                >
                                                    <FileText size={16}/> Gerar Recibo
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </MotionDiv>
        </div>
    );
};
