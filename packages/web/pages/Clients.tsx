
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { storage } from '../services/storage';
import { Client, Vehicle } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, Search, User as UserIcon, Phone, Mail, MapPin, 
  Car, ShieldCheck, ShieldX, Edit2, Trash2, X, Plus, Save, ChevronRight, Check,
  KeyRound, RotateCcw, ShieldQuestion, Fingerprint, Lock, CheckSquare, Square, FileSpreadsheet, FileText, ListChecks
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmModal } from '../components/ConfirmModal';
import { Checkbox } from '../components/ui/checkbox';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';
import { useTenant } from '../contexts/TenantContext';
import { formatCPF, isValidCPF } from '../utils/brDocument';
import { exportRowsToXlsx } from '../utils/excel';
import { authenticatedFetch } from '../services/authenticatedFetch';

const MotionDiv = motion.div as any;

export const Clients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Partial<Client>>({});
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<Set<string>>(new Set());
  
  // Selection State
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());

  const { t } = useLanguage();
  const { addNotification } = useNotification();
  const { user: currentUser } = useAuth();
  const { tenantId } = useTenant();

  const loadData = async () => {
    const [c, v] = await Promise.all([storage.getClients(), storage.getVehicles()]);
    setClients(c || []);
    setAllVehicles(v || []);
  };

  useEffect(() => { loadData(); }, []);

  // Função para detectar se o dado está provavelmente encriptado (corrompido visualmente)
  const isCorrupted = (str?: string) => {
    if (!str) return false;
    return str.length > 20 && !str.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(str);
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.cpf.includes(searchTerm)
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, searchTerm]);

  const filteredModalVehicles = useMemo(() => {
    const term = vehicleSearchTerm.toLowerCase().trim();
    if (!term) return allVehicles.slice(0, 50);
    return allVehicles.filter(v => 
      v.plate.toLowerCase().includes(term) || 
      v.model.toLowerCase().includes(term)
    );
  }, [allVehicles, vehicleSearchTerm]);

  const toggleVehicleSelection = (id: string) => {
    const newSelection = new Set(selectedVehicleIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedVehicleIds(newSelection);
  };

  // --- SELECTION LOGIC ---
  const toggleSelectClient = (id: string) => {
      const newSet = new Set(selectedClients);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedClients(newSet);
  };

  const handleSelectAll = () => {
      if (selectedClients.size === filteredClients.length && filteredClients.length > 0) {
          setSelectedClients(new Set());
      } else {
          setSelectedClients(new Set(filteredClients.map(c => c.id)));
      }
  };

  const handleExportSelected = async (format: 'pdf' | 'xlsx') => {
      if (selectedClients.size === 0) return;
      
      const dataToExport = clients.filter(c => selectedClients.has(c.id)).map(c => {
          const vehs = allVehicles.filter(v => v.clientId === c.id).map(v => v.plate).join(', ');
          return {
              "Nome": c.name,
              "CPF": c.cpf,
              "Telefone": c.phone,
              "Email": c.email || '-',
              "Veiculos": vehs || 'Nenhum',
              "Acesso Portal": c.hasAccess ? 'Sim' : 'Não',
              "Cadastro": new Date(c.createdAt).toLocaleDateString()
          };
      });

      if (format === 'xlsx') {
          await exportRowsToXlsx(dataToExport, 'Clientes Selecionados', `clientes_export_${Date.now()}.xlsx`);
      } else {
          const doc = new jsPDF();
          doc.text("Relatório de Clientes", 14, 20);
          autoTable(doc, {
              startY: 30,
              head: [['Nome', 'CPF', 'Telefone', 'Veículos', 'Acesso']],
              body: dataToExport.map(c => [c.Nome, c.CPF, c.Telefone, c.Veiculos, c["Acesso Portal"]]),
              styles: { fontSize: 8 },
              headStyles: { fillColor: [24, 24, 27] }
          });
          doc.save(`clientes_export_${Date.now()}.pdf`);
      }
      
      addNotification('success', 'Exportação Concluída', `${selectedClients.size} clientes exportados.`);
      setSelectedClients(new Set());
  };

  const handleOpenModal = (client?: Client) => {
    if (client) {
      if (isCorrupted(client.name)) {
          addNotification('error', 'Dados Protegidos', 'Este registro está criptografado com uma chave antiga ou diferente. A edição foi bloqueada para prevenir perda de dados.');
          return;
      }
      setSelectedClient(client);
      const linkedIds = allVehicles
        .filter(v => v.clientId === client.id)
        .map(v => v.id);
      setSelectedVehicleIds(new Set(linkedIds));
    } else {
      setSelectedClient({ hasAccess: false });
      setSelectedVehicleIds(new Set());
    }
    setVehicleSearchTerm('');
    setIsModalOpen(true);
  };

  const handleResetPassword = async (type: 'default' | 'cpf') => {
    if (!selectedClient.cpf) return;

    try {
      if (!functions) throw new Error('Serviço de autenticação indisponível.');
      const provision = httpsCallable<
        { tenantId: string; cpf: string; name: string; clientId: string },
        { uid: string }
      >(functions, 'provisionClientAccess');
      await provision({
        tenantId,
        cpf: selectedClient.cpf,
        name: selectedClient.name || 'Cliente',
        clientId: selectedClient.id || '',
      });
      const reset = httpsCallable<{ tenantId: string; cpf: string; mode: 'default' | 'cpf' }, { password: string }>(
        functions, 'resetClientPassword'
      );
      const result = await reset({ tenantId, cpf: selectedClient.cpf, mode: type });
      addNotification('success', 'Senha Redefinida', `A nova senha é: ${result.data.password}`);
    } catch (e: any) {
      addNotification('error', 'Erro', e?.message || 'Não foi possível redefinir a senha no momento.');
    } finally {
      setIsResetModalOpen(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // Idempotência: impede reentrância (duplo-clique / rede lenta) que, com o id
    // gerado via crypto.randomUUID() a cada submit, criava clientes duplicados.
    if (isSaving) return;
    if (!selectedClient.name || !selectedClient.cpf) return;
    if (!isValidCPF(selectedClient.cpf)) {
      addNotification('error', 'CPF inválido', 'Informe um CPF válido. Sequências repetidas não são aceitas.');
      return;
    }

    // id estável: gera UMA vez e fixa no estado, para que retry reuse o mesmo
    // doc (setDoc sobrescreve em vez de duplicar).
    const clientId = selectedClient.id || crypto.randomUUID();
    const cleanCpf = selectedClient.cpf.replace(/\D/g, '');
    const previousClient = clients.find(client => client.id === clientId);
    const wasAccessEnabled = Boolean(previousClient?.hasAccess);

    setIsSaving(true);
    try {
      const clientData: Client = {
        ...selectedClient as Client,
        id: clientId,
        name: selectedClient.name,
        cpf: selectedClient.cpf,
        phone: selectedClient.phone || '',
        createdAt: selectedClient.createdAt || Date.now()
      };
      setSelectedClient(prev => ({ ...prev, id: clientId }));

      // storage.saveClient já registra a auditoria (CREATE/UPDATE Client) —
      // não duplicar o log aqui.
      await storage.saveClient(clientData);

      // O indicador visual só permanece ativado se o provisionamento tiver
      // concluído. Isso elimina o estado "acesso ativado" sem conta utilizável.
      if (clientData.hasAccess && !wasAccessEnabled) {
          if (!functions) throw new Error('Serviço de criação de acesso indisponível.');
          const provision = httpsCallable<
            { tenantId: string; cpf: string; name: string; clientId: string; resetInitialPassword?: boolean },
            { uid: string; email: string; created: boolean; initialPassword: string | null }
          >(functions, 'provisionClientAccess');
          try {
            const result = await provision({ tenantId, cpf: cleanCpf, name: clientData.name, clientId, resetInitialPassword: true });
            if (result.data.initialPassword) {
              addNotification('success', 'Acesso Criado', `Login: ${result.data.email} — senha inicial: ${result.data.initialPassword}`);
            }
          } catch (error) {
            await storage.saveClient({ ...clientData, hasAccess: false });
            throw error;
          }
      }
      if (!clientData.hasAccess && wasAccessEnabled) {
        if (!functions) throw new Error('Serviço de revogação de acesso indisponível.');
        const revoke = httpsCallable<{ tenantId: string; cpf: string }, { ok: boolean }>(functions, 'revokeClientAccess');
        try { await revoke({ tenantId, cpf: cleanCpf }); }
        catch (error) { await storage.saveClient({ ...clientData, hasAccess: true }); throw error; }
      }

      const updatePromises = allVehicles.map(async (v) => {
        const isSelected = selectedVehicleIds.has(v.id);
        const wasMine = v.clientId === clientId;
        if (isSelected && !wasMine) await storage.saveVehicle({ ...v, clientId });
        else if (!isSelected && wasMine) await storage.saveVehicle({ ...v, clientId: undefined });
      });

      await Promise.all(updatePromises);
      const reindexResponse = await authenticatedFetch(`/api/vehicles/reindex-client/${encodeURIComponent(clientId)}`, { method: 'POST' });
      const reindexPayload = await reindexResponse.json();
      if (!reindexResponse.ok) throw new Error(reindexPayload.error || 'Falha ao atualizar o índice de pesquisa da frota.');
      addNotification('success', 'Sucesso', 'Perfil e frota do cliente atualizados.');
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Falha ao salvar cliente:', err);
      addNotification('error', 'Erro', err?.message || 'Não foi possível salvar o cliente. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const c = clients.find(client => client.id === id);
    const linkedVehicles = allVehicles.filter(v => v.clientId === id);
    const unlinkPromises = linkedVehicles.map(v => storage.saveVehicle({ ...v, clientId: undefined }));
    await Promise.all(unlinkPromises);
    await storage.deleteClient(id);
    
    if (currentUser && c) {
        storage.logAction(currentUser, 'DELETE', 'Client', `Removeu cliente: ${c.name}`, id);
    }

    addNotification('info', 'Cliente Removido', 'Cadastro excluído e frota desvinculada.');
    loadData();
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white tracking-tight uppercase">Gestão de Clientes</h1>
          <p className="text-zinc-500 mt-1 font-medium">Controle de associados e permissões de acesso ao portal.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-primary-500 text-black px-8 py-3 rounded-2xl flex items-center gap-2 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary-500/20 hover:scale-105 transition-all"
        >
          <Plus size={18} strokeWidth={3} /> Adicionar Cliente
        </button>
      </div>

      {/* BARRA DE CONTROLE E PESQUISA */}
      <div className="sticky top-4 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-2 pl-4 rounded-[28px] border border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col md:flex-row gap-3 items-center transition-all">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-0 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou CPF..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="w-full pl-8 pr-4 py-3 bg-transparent border-none text-sm font-bold outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400" 
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end overflow-hidden px-2 border-l border-zinc-100 dark:border-zinc-800 pl-4">
            <AnimatePresence mode="popLayout">
                {selectedClients.size > 0 && (
                    <MotionDiv 
                        initial={{ opacity: 0, x: 20 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        exit={{ opacity: 0, x: 20 }}
                        className="flex items-center gap-2"
                    >
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-primary-500/10 text-primary-600 rounded-xl border border-primary-500/20">
                            <ListChecks size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{selectedClients.size}</span>
                        </div>
                        
                        <button onClick={() => handleExportSelected('pdf')} className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all">
                            <FileText size={14} /> PDF
                        </button>
                        <button onClick={() => handleExportSelected('xlsx')} className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all">
                            <FileSpreadsheet size={14} /> Excel
                        </button>
                        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1" />
                    </MotionDiv>
                )}
            </AnimatePresence>

            <button 
                onClick={handleSelectAll} 
                className={`px-6 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center gap-2 transition-all border ${
                    selectedClients.size === filteredClients.length && filteredClients.length > 0 
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-transparent shadow-md' 
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
            >
                {selectedClients.size === filteredClients.length && filteredClients.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                {selectedClients.size === filteredClients.length && filteredClients.length > 0 ? 'Desmarcar' : 'Todos'}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map(client => {
          const clientVehicles = allVehicles.filter(v => v.clientId === client.id);
          const dataCorrupted = isCorrupted(client.name);
          const isSelected = selectedClients.has(client.id);

          return (
            <div 
                key={client.id} 
                className={`bg-white dark:bg-zinc-850 p-8 rounded-[40px] border shadow-sm group transition-all relative overflow-hidden flex flex-col justify-between min-h-[420px] cursor-pointer ${
                    isSelected ? 'border-primary-500 ring-4 ring-primary-500/10' : 
                    dataCorrupted ? 'border-red-500/30' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
                onClick={() => toggleSelectClient(client.id)}
            >
              
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-4 rounded-2xl ${dataCorrupted ? 'bg-red-500/10 text-red-500' : client.hasAccess ? 'bg-primary-500 text-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'} shadow-lg transition-colors`}>
                    {dataCorrupted ? <Lock size={24} /> : <UserIcon size={24} />}
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    {client.hasAccess && !dataCorrupted && (
                      <button 
                        onClick={() => { setSelectedClient(client); setIsResetModalOpen(true); }}
                        className="p-2.5 text-zinc-400 hover:text-primary-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
                        title="Resetar Senha"
                      >
                        <KeyRound size={18}/>
                      </button>
                    )}
                    <button 
                        onClick={() => handleOpenModal(client)} 
                        className={`p-2.5 rounded-xl transition-all ${dataCorrupted ? 'text-zinc-300 cursor-not-allowed opacity-50' : 'text-zinc-400 hover:text-primary-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                        disabled={dataCorrupted}
                        title={dataCorrupted ? "Edição bloqueada: Dados de outra sessão" : "Editar"}
                    >
                        <Edit2 size={18}/>
                    </button>
                    <button onClick={() => handleDelete(client.id)} className="p-2.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"><Trash2 size={18}/></button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                    <h3 className={`text-xl font-display font-black uppercase tracking-tight truncate leading-tight ${dataCorrupted ? 'text-zinc-400 break-all whitespace-normal text-[10px] font-mono' : 'text-zinc-900 dark:text-white'}`}>
                        {client.name}
                    </h3>
                    {isSelected && <div className="bg-primary-500 text-white rounded-full p-1"><Check size={12} strokeWidth={4}/></div>}
                </div>
                {dataCorrupted && <span className="text-[9px] text-red-500 font-bold uppercase mt-1 block">Erro de Decriptação - Chave Inválida</span>}
                
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">CPF:</span>
                    <span className={`text-[10px] font-mono font-bold ${dataCorrupted ? 'text-zinc-400 truncate w-24' : 'text-zinc-600 dark:text-zinc-300'}`}>{client.cpf}</span>
                </div>

                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400 font-bold group/item">
                    <div className="w-8 h-8 rounded-lg bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-primary-500 border border-zinc-100 dark:border-zinc-800 shadow-sm"><Phone size={14} /></div>
                    <span className={`group-hover:text-zinc-900 dark:group-hover:text-white transition-colors ${dataCorrupted ? 'truncate w-32 font-mono text-[9px]' : ''}`}>{client.phone || 'Sem telefone'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400 font-bold group/item">
                    <div className="w-8 h-8 rounded-lg bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-primary-500 border border-zinc-100 dark:border-zinc-800 shadow-sm"><Mail size={14} /></div>
                    <span className={`group-hover:text-zinc-900 dark:group-hover:text-white transition-colors truncate ${dataCorrupted ? 'truncate w-32 font-mono text-[9px]' : ''}`}>{client.email || 'Sem e-mail'}</span>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">
                        <span>Veículos Vinculados</span>
                        <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-900 dark:text-white">{clientVehicles.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {clientVehicles.map(v => (
                            <span key={v.id} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-xl text-[10px] font-black text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 uppercase tracking-tight">{v.plate}</span>
                        ))}
                        {clientVehicles.length === 0 && <span className="italic text-[10px] text-zinc-400 font-medium">Nenhum veículo ativo</span>}
                    </div>
                </div>
              </div>

              <div className="mt-8">
                  <div className={`
                    w-full py-4 px-6 rounded-2xl flex items-center justify-between border transition-all
                    ${dataCorrupted
                        ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-50'
                        : client.hasAccess 
                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-800 dark:border-white shadow-xl' 
                            : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600 border-zinc-100 dark:border-zinc-800'}
                  `}>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.15em]">Portal do Cliente</span>
                        <span className="text-[8px] font-bold uppercase opacity-60">{client.hasAccess ? 'Acesso Ativado' : 'Acesso Bloqueado'}</span>
                    </div>
                    {client.hasAccess ? <ShieldCheck size={20} className={dataCorrupted ? 'text-zinc-400' : 'text-primary-500'} /> : <ShieldX size={20} />}
                  </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL RESET SENHA */}
      {isResetModalOpen && (
        <div className="modal-shell">
          <MotionDiv initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-zinc-900 rounded-[30px] md:rounded-[40px] w-full max-w-md p-6 md:p-10 border border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[95vh] overflow-y-auto custom-scrollbar flex flex-col">
             <div className="flex justify-between items-center mb-8 shrink-0">
                <div className="flex items-center gap-3 text-primary-500">
                   <KeyRound size={28} className="md:w-8 md:h-8" />
                   <h2 className="text-xl md:text-2xl font-display font-black uppercase tracking-tight">Reset de Senha</h2>
                </div>
                <button onClick={() => setIsResetModalOpen(false)} className="text-zinc-400 hover:text-zinc-600"><X /></button>
             </div>

             <div className="p-6 bg-zinc-50 dark:bg-zinc-950 rounded-3xl border border-zinc-100 dark:border-zinc-800 mb-8 shrink-0">
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Cliente Selecionado</p>
                <h4 className="text-lg font-black text-zinc-900 dark:text-white uppercase leading-tight">{selectedClient.name}</h4>
                <p className="text-xs font-mono text-zinc-500 mt-1">{selectedClient.cpf}</p>
             </div>

             <div className="grid grid-cols-1 gap-4 shrink-0">
                <button 
                  onClick={() => handleResetPassword('default')}
                  className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                >
                  <RotateCcw size={18} /> Padrão (123456)
                </button>
                
                <button 
                  onClick={() => handleResetPassword('cpf')}
                  className="w-full py-5 bg-primary-500 text-black rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                >
                  <Fingerprint size={18} /> 6 Primeiros do CPF
                </button>
             </div>

             <p className="mt-8 text-center text-[9px] font-bold text-zinc-400 uppercase leading-relaxed px-4 shrink-0">
                * A alteração é imediata. O cliente deverá usar a nova credencial no próximo acesso.
             </p>
          </MotionDiv>
        </div>
      )}

      {/* MODAL FICHA CLIENTE */}
      {isModalOpen && (
        <div className="modal-shell">
          <div className="bg-white dark:bg-zinc-900 rounded-[30px] md:rounded-[40px] w-full max-w-5xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* HEADER FIXED */}
            <div className="flex justify-between items-center p-6 md:p-8 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
               <h2 className="text-2xl md:text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Ficha do Cliente</h2>
               <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors"><X size={24}/></button>
            </div>
            
            {/* CONTENT SCROLLABLE */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
                <form id="client-form" onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16">
                    <div className="space-y-6 md:space-y-8">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                            <UserIcon size={14}/> Informações Cadastrais
                        </h3>
                        <div className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Nome Completo</label>
                                <input type="text" required value={selectedClient.name || ''} onChange={e => setSelectedClient({...selectedClient, name: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500 transition-all" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">CPF (Somente Números)</label>
                                    <input type="text" required inputMode="numeric" maxLength={14} value={selectedClient.cpf || ''} onChange={e => setSelectedClient({...selectedClient, cpf: formatCPF(e.target.value)})} placeholder="000.000.000-00" className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Telefone</label>
                                    <input type="text" value={selectedClient.phone || ''} onChange={e => setSelectedClient({...selectedClient, phone: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500" placeholder="(00) 00000-0000" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">E-mail</label>
                                <input type="email" value={selectedClient.email || ''} onChange={e => setSelectedClient({...selectedClient, email: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500" placeholder="cliente@provedor.com" />
                            </div>
                            <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
                               <div className="group bg-zinc-100/50 dark:bg-zinc-950 p-5 rounded-[24px] border border-zinc-200 dark:border-zinc-800">
                                   <Checkbox checked={selectedClient.hasAccess || false} onChange={checked => setSelectedClient({...selectedClient, hasAccess: checked})}>
                                     <div className="flex flex-col ml-1">
                                        <span className="text-[11px] font-black uppercase text-zinc-700 dark:text-white tracking-tight">Liberar Portal do Cliente</span>
                                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">Acesso via CPF e senha inicial</span>
                                     </div>
                                   </Checkbox>
                               </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 md:space-y-8">
                       <div className="flex justify-between items-center">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                              <Car size={14}/> Gestão de Acesso (Placas)
                          </h3>
                          <span className="bg-primary-500/10 text-primary-600 text-[10px] font-black px-2 py-0.5 rounded-lg uppercase">{selectedVehicleIds.size} Selecionados</span>
                       </div>
                       <div className="bg-white dark:bg-zinc-950 rounded-[32px] border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden shadow-inner">
                          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                            <div className="relative">
                              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                              <input type="text" placeholder="Buscar placa para vincular..." value={vehicleSearchTerm} onChange={e => setVehicleSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:border-primary-500 transition-all"/>
                            </div>
                          </div>
                          <div className="max-h-[350px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                              {filteredModalVehicles.length === 0 ? (
                                <div className="py-12 text-center opacity-30 flex flex-col items-center gap-2">
                                    <Car size={32} />
                                    <span className="text-[10px] font-black uppercase">Nenhum veículo disponível</span>
                                </div>
                              ) : (
                                filteredModalVehicles.map(v => {
                                  const isSelected = selectedVehicleIds.has(v.id);
                                  const belongsToOther = v.clientId && v.clientId !== selectedClient.id;
                                  return (
                                    <button key={v.id} type="button" onClick={() => toggleVehicleSelection(v.id)} className={`w-full p-4 rounded-2xl text-left transition-all border flex items-center justify-between group ${isSelected ? 'bg-primary-500 border-primary-600 shadow-md' : 'bg-transparent border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-100 dark:hover:bg-zinc-800'}`}>
                                      <div className="flex items-center gap-4">
                                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isSelected ? 'bg-black/10 text-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:text-primary-500'}`}><Car size={18} /></div>
                                         <div className="flex flex-col">
                                            <span className={`text-sm font-black uppercase leading-none ${isSelected ? 'text-black' : 'text-zinc-900 dark:text-white'}`}>{v.plate}</span>
                                            <span className={`text-[9px] font-bold uppercase mt-1 tracking-tight ${isSelected ? 'text-black/60' : 'text-zinc-500'}`}>{v.model} {belongsToOther && <span className="ml-2 text-red-500">• Outro Cliente</span>}</span>
                                         </div>
                                      </div>
                                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${isSelected ? 'bg-black border-black text-primary-500' : 'border-zinc-200 dark:border-zinc-800 text-transparent'}`}><Check size={14} strokeWidth={4} /></div>
                                    </button>
                                  );
                                })
                              )}
                          </div>
                       </div>
                    </div>
                </form>
            </div>

            {/* FOOTER FIXED */}
            <div className="p-6 md:p-8 border-t border-zinc-100 dark:border-zinc-800 shrink-0 bg-zinc-50/50 dark:bg-zinc-950 rounded-b-[30px] md:rounded-b-[40px]">
               <button form="client-form" type="submit" disabled={isSaving} className="w-full py-5 md:py-6 bg-primary-500 text-black rounded-[24px] md:rounded-[32px] font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-primary-500/30 active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed">
                  <Save size={24} /> {isSaving ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
               </button>
            </div>

          </div>
        </div>
      )}

      <ConfirmModal 
          isOpen={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          onConfirm={() => clientToDelete && handleDelete(clientToDelete)}
          title="Excluir Cliente"
          message="Deseja excluir este cliente? Os veículos vinculados CONTINUARÃO no sistema?"
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          type="danger"
      />
    </div>
  );
};
