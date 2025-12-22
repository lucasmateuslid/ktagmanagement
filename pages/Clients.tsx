import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { storage } from '../services/storage';
import { Client, Vehicle } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { 
  Users, Search, User, Phone, Mail, MapPin, 
  Car, ShieldCheck, ShieldX, Edit2, Trash2, X, Plus, Save, ChevronRight
} from 'lucide-react';

export const Clients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Partial<Client>>({});
  
  const { t } = useLanguage();
  const { addNotification } = useNotification();

  const loadData = async () => {
    const [c, v] = await Promise.all([storage.getClients(), storage.getVehicles()]);
    setClients(c || []);
    setVehicles(v || []);
  };

  useEffect(() => { loadData(); }, []);

  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.cpf.includes(searchTerm)
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, searchTerm]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient.name || !selectedClient.cpf) return;

    const clientData: Client = {
      id: selectedClient.id || crypto.randomUUID(),
      name: selectedClient.name,
      cpf: selectedClient.cpf,
      phone: selectedClient.phone || '',
      email: selectedClient.email,
      address: selectedClient.address,
      hasAccess: selectedClient.hasAccess ?? false,
      createdAt: selectedClient.createdAt || Date.now()
    };

    await storage.saveClient(clientData);
    addNotification('success', 'Sucesso', 'Dados do cliente atualizados.');
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este cliente? Veículos vinculados perderão a referência.')) return;
    await storage.deleteClient(id);
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
          onClick={() => { setSelectedClient({ hasAccess: false }); setIsModalOpen(true); }}
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
          const clientVehicles = vehicles.filter(v => v.clientId === client.id);
          return (
            <div key={client.id} className="bg-white dark:bg-zinc-850 p-8 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-sm group hover:border-primary-500/50 transition-all relative overflow-hidden flex flex-col justify-between min-h-[420px]">
              
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-4 rounded-2xl ${client.hasAccess ? 'bg-primary-500 text-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'} shadow-lg`}>
                    <User size={24} />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setSelectedClient(client); setIsModalOpen(true); }} className="p-2.5 text-zinc-400 hover:text-primary-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"><Edit2 size={18}/></button>
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

              {/* Botão de Portal - Contrast Corrigido */}
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

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[40px] w-full max-w-lg p-10 shadow-2xl relative border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Ficha do Cliente</h2>
               <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors"><X size={24}/></button>
            </div>
            <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 gap-5">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Nome Completo</label>
                        <input type="text" required value={selectedClient.name || ''} onChange={e => setSelectedClient({...selectedClient, name: e.target.value})} className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500 transition-all" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">CPF (Apenas números)</label>
                          <input type="text" required value={selectedClient.cpf || ''} onChange={e => setSelectedClient({...selectedClient, cpf: e.target.value})} className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500 transition-all" />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Telefone</label>
                          <input type="text" value={selectedClient.phone || ''} onChange={e => setSelectedClient({...selectedClient, phone: e.target.value})} className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500 transition-all" />
                      </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">E-mail</label>
                        <input type="email" value={selectedClient.email || ''} onChange={e => setSelectedClient({...selectedClient, email: e.target.value})} className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500 transition-all" />
                    </div>
                    
                    <div className="pt-6 mt-2 border-t border-zinc-100 dark:border-zinc-800">
                       <label className="flex items-center gap-4 cursor-pointer group bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                          <div className="relative shrink-0">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={selectedClient.hasAccess || false} 
                              onChange={e => setSelectedClient({...selectedClient, hasAccess: e.target.checked})}
                            />
                            <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full peer-checked:bg-primary-500 transition-all"></div>
                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition-all"></div>
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[11px] font-black uppercase text-zinc-700 dark:text-white tracking-tight">Liberar Acesso ao Portal</span>
                             <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">Login via CPF e senha inicial (6 primeiros dígitos)</span>
                          </div>
                       </label>
                    </div>
                </div>
                <button type="submit" className="w-full py-5 bg-primary-500 text-black rounded-[20px] font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-primary-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-4">
                    <Save size={18} /> Salvar Alterações
                </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};