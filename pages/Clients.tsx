
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { storage } from '../services/storage';
import { Client, Vehicle, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, Search, User as UserIcon, Phone, Mail, MapPin, 
  Car, ShieldCheck, ShieldX, Edit2, Trash2, X, Plus, Save, ChevronRight, Check,
  KeyRound, RotateCcw, ShieldQuestion, Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Clients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Partial<Client>>({});
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<Set<string>>(new Set());
  
  const { t } = useLanguage();
  const { addNotification } = useNotification();
  const { user: currentUser } = useAuth();

  const loadData = async () => {
    const [c, v] = await Promise.all([storage.getClients(), storage.getVehicles()]);
    setClients(c || []);
    setAllVehicles(v || []);
  };

  useEffect(() => { loadData(); }, []);

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

  // Fix: Added missing toggleVehicleSelection function
  const toggleVehicleSelection = (id: string) => {
    const newSelection = new Set(selectedVehicleIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedVehicleIds(newSelection);
  };

  const handleOpenModal = (client?: Client) => {
    if (client) {
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
    
    const cleanCpf = selectedClient.cpf.replace(/\D/g, '');
    const clientEmail = `${cleanCpf}@client.ktag`;
    
    // Busca a conta de usuário vinculada
    const userAccount = await storage.findUserByEmail(clientEmail);
    
    if (!userAccount) {
      addNotification('error', 'Erro', 'Este cliente ainda não possui uma conta de acesso ativa.');
      setIsResetModalOpen(false);
      return;
    }

    let newPassword = '';
    if (type === 'default') {
      newPassword = '123456';
    } else {
      newPassword = cleanCpf.substring(0, 6);
    }

    try {
      await storage.updateUserProfile(userAccount.id, { password: newPassword });
      storage.logAction(currentUser, 'UPDATE', 'Client', `Resetou a senha do cliente ${selectedClient.name} (${type})`, userAccount.id);
      addNotification('success', 'Senha Redefinida', `A nova senha é: ${newPassword}`);
    } catch (e) {
      addNotification('error', 'Erro', 'Não foi possível redefinir a senha no momento.');
    } finally {
      setIsResetModalOpen(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient.name || !selectedClient.cpf) return;

    const clientId = selectedClient.id || crypto.randomUUID();
    const cleanCpf = selectedClient.cpf.replace(/\D/g, '');
    
    const clientData: Client = {
      ...selectedClient as Client,
      id: clientId,
      name: selectedClient.name,
      cpf: selectedClient.cpf,
      phone: selectedClient.phone || '',
      createdAt: selectedClient.createdAt || Date.now()
    };

    await storage.saveClient(clientData);

    // Se o acesso for habilitado, garante que existe um usuário no USERS_DB
    if (clientData.hasAccess) {
        const clientEmail = `${cleanCpf}@client.ktag`;
        const existingUser = await storage.findUserByEmail(clientEmail);
        
        if (!existingUser) {
            const newUser: User = {
                id: crypto.randomUUID(),
                name: clientData.name,
                email: clientEmail,
                cpf: cleanCpf,
                password: cleanCpf.substring(0, 6), // Senha inicial: 6 primeiros dígitos
                role: 'client',
                status: 'approved',
                createdAt: Date.now()
            };
            await storage.registerUserRequest(newUser);
        }
    }

    const updatePromises = allVehicles.map(async (v) => {
      const isSelected = selectedVehicleIds.has(v.id);
      const wasMine = v.clientId === clientId;
      if (isSelected && !wasMine) await storage.saveVehicle({ ...v, clientId });
      else if (!isSelected && wasMine) await storage.saveVehicle({ ...v, clientId: undefined });
    });

    await Promise.all(updatePromises);
    addNotification('success', 'Sucesso', 'Perfil e frota do cliente atualizados.');
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este cliente? Os veículos vinculados CONTINUARÃO no sistema.')) return;
    const linkedVehicles = allVehicles.filter(v => v.clientId === id);
    const unlinkPromises = linkedVehicles.map(v => storage.saveVehicle({ ...v, clientId: undefined }));
    await Promise.all(unlinkPromises);
    await storage.deleteClient(id);
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

      <div className="bg-white dark:bg-zinc-900 p-3 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou CPF..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20 transition-all text-zinc-900 dark:text-white font-bold" 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map(client => {
          const clientVehicles = allVehicles.filter(v => v.clientId === client.id);
          return (
            <div key={client.id} className="bg-white dark:bg-zinc-850 p-8 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-sm group hover:border-primary-500/50 transition-all relative overflow-hidden flex flex-col justify-between min-h-[420px]">
              
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-4 rounded-2xl ${client.hasAccess ? 'bg-primary-500 text-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'} shadow-lg transition-colors`}>
                    <UserIcon size={24} />
                  </div>
                  <div className="flex gap-1">
                    {client.hasAccess && (
                      <button 
                        onClick={() => { setSelectedClient(client); setIsResetModalOpen(true); }}
                        className="p-2.5 text-zinc-400 hover:text-primary-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
                        title="Resetar Senha"
                      >
                        <KeyRound size={18}/>
                      </button>
                    )}
                    <button onClick={() => handleOpenModal(client)} className="p-2.5 text-zinc-400 hover:text-primary-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"><Edit2 size={18}/></button>
                    <button onClick={() => handleDelete(client.id)} className="p-2.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"><Trash2 size={18}/></button>
                  </div>
                </div>

                <h3 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight truncate leading-tight">{client.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">CPF:</span>
                    <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-300 font-bold">{client.cpf}</span>
                </div>

                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400 font-bold group/item">
                    <div className="w-8 h-8 rounded-lg bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-primary-500 border border-zinc-100 dark:border-zinc-800 shadow-sm"><Phone size={14} /></div>
                    <span className="group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{client.phone || 'Sem telefone'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400 font-bold group/item">
                    <div className="w-8 h-8 rounded-lg bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-primary-500 border border-zinc-100 dark:border-zinc-800 shadow-sm"><Mail size={14} /></div>
                    <span className="group-hover:text-zinc-900 dark:group-hover:text-white transition-colors truncate">{client.email || 'Sem e-mail'}</span>
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
                    ${client.hasAccess 
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-800 dark:border-white shadow-xl' 
                        : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600 border-zinc-100 dark:border-zinc-800'}
                  `}>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.15em]">Portal do Cliente</span>
                        <span className="text-[8px] font-bold uppercase opacity-60">{client.hasAccess ? 'Acesso Ativado' : 'Acesso Bloqueado'}</span>
                    </div>
                    {client.hasAccess ? <ShieldCheck size={20} className="text-primary-500" /> : <ShieldX size={20} />}
                  </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL RESET SENHA */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-zinc-900 rounded-[40px] w-full max-w-md p-10 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
             <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3 text-primary-500">
                   <KeyRound size={32} />
                   <h2 className="text-2xl font-display font-black uppercase tracking-tight">Reset de Senha</h2>
                </div>
                <button onClick={() => setIsResetModalOpen(false)} className="text-zinc-400 hover:text-zinc-600"><X /></button>
             </div>

             <div className="p-6 bg-zinc-50 dark:bg-zinc-950 rounded-3xl border border-zinc-100 dark:border-zinc-800 mb-8">
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Cliente Selecionado</p>
                <h4 className="text-lg font-black text-zinc-900 dark:text-white uppercase leading-tight">{selectedClient.name}</h4>
                <p className="text-xs font-mono text-zinc-500 mt-1">{selectedClient.cpf}</p>
             </div>

             <div className="grid grid-cols-1 gap-4">
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

             <p className="mt-8 text-center text-[9px] font-bold text-zinc-400 uppercase leading-relaxed px-4">
                * A alteração é imediata. O cliente deverá usar a nova credencial no próximo acesso.
             </p>
          </motion.div>
        </div>
      )}

      {/* MODAL FICHA CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 md:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-[30px] md:rounded-[40px] w-full max-w-5xl p-6 md:p-12 shadow-2xl relative border border-zinc-200 dark:border-zinc-800 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8 md:mb-12">
               <h2 className="text-2xl md:text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Ficha do Cliente</h2>
               <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16">
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
                                <input type="text" required value={selectedClient.cpf || ''} onChange={e => setSelectedClient({...selectedClient, cpf: e.target.value.replace(/\D/g, '')})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500" />
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
                           <label className="flex items-center gap-4 cursor-pointer group bg-zinc-100/50 dark:bg-zinc-950 p-5 rounded-[24px] border border-zinc-200 dark:border-zinc-800">
                              <div className="relative shrink-0">
                                <input type="checkbox" className="sr-only peer" checked={selectedClient.hasAccess || false} onChange={e => setSelectedClient({...selectedClient, hasAccess: e.target.checked})}/>
                                <div className="w-12 h-7 bg-zinc-300 dark:bg-zinc-800 rounded-full peer-checked:bg-emerald-500 transition-all"></div>
                                <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full peer-checked:translate-x-5 transition-all shadow-sm"></div>
                              </div>
                              <div className="flex flex-col">
                                 <span className="text-[11px] font-black uppercase text-zinc-700 dark:text-white tracking-tight">Liberar Portal do Cliente</span>
                                 <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">Acesso via CPF e senha inicial</span>
                              </div>
                           </label>
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
                   <button type="submit" className="w-full py-5 md:py-6 bg-primary-500 text-black rounded-[24px] md:rounded-[32px] font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-primary-500/30 active:scale-95 transition-all flex items-center justify-center gap-4">
                      <Save size={24} /> SALVAR ALTERAÇÕES
                   </button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
