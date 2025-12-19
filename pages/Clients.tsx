
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { storage } from '../services/storage';
import { Client, Vehicle } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { 
  Users, Search, User, Phone, Mail, MapPin, 
  Car, ShieldCheck, ShieldX, Edit2, Trash2, X, Plus, Save
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
    setClients(c);
    setVehicles(v);
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
          <p className="text-zinc-500 mt-1 font-medium">Controle de associados e permissões de acesso.</p>
        </div>
        <button 
          onClick={() => { setSelectedClient({ hasAccess: false }); setIsModalOpen(true); }}
          className="bg-primary-500 text-black px-8 py-3 rounded-2xl flex items-center gap-2 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary-500/20"
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
            className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20 transition-all text-zinc-900 dark:text-white" 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map(client => {
          const clientVehicles = vehicles.filter(v => v.clientId === client.id);
          return (
            <div key={client.id} className="bg-white dark:bg-zinc-900 p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm group hover:border-primary-500/50 transition-all relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl ${client.hasAccess ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                  <User size={24} />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setSelectedClient(client); setIsModalOpen(true); }} className="p-2 text-zinc-300 hover:text-primary-500 transition-colors"><Edit2 size={18}/></button>
                  <button onClick={() => handleDelete(client.id)} className="p-2 text-zinc-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                </div>
              </div>

              <h3 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight truncate">{client.name}</h3>
              <p className="text-[10px] font-mono text-zinc-400 mt-1 font-bold">CPF: {client.cpf}</p>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-xs text-zinc-500 font-bold">
                  <Phone size={14} className="text-zinc-400" /> {client.phone || 'Sem telefone'}
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500 font-bold">
                  <Mail size={14} className="text-zinc-400" /> {client.email || 'Sem e-mail'}
                </div>
                
                <div className="pt-4 border-t border-zinc-50 dark:border-zinc-800/50 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    <span>Veículos</span>
                    <span className="text-zinc-900 dark:text-white">{clientVehicles.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {clientVehicles.map(v => (
                      <span key={v.id} className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px] font-black text-zinc-500 border border-zinc-200 dark:border-zinc-700 uppercase">{v.plate}</span>
                    ))}
                    {clientVehicles.length === 0 && <span className="italic text-[9px] text-zinc-400">Nenhum veículo vinculado</span>}
                  </div>
                </div>

                <div className={`mt-4 px-4 py-2 rounded-xl flex items-center justify-between border ${client.hasAccess ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600' : 'bg-zinc-50 border-zinc-100 text-zinc-400'}`}>
                  <span className="text-[9px] font-black uppercase tracking-widest">Portal do Cliente</span>
                  {client.hasAccess ? <ShieldCheck size={14} /> : <ShieldX size={14} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-lg p-10 shadow-2xl relative border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Editar Cliente</h2>
               <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400"><X size={24}/></button>
            </div>
            <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500">Nome Completo</label>
                        <input type="text" required value={selectedClient.name || ''} onChange={e => setSelectedClient({...selectedClient, name: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-zinc-500">CPF (Apenas números)</label>
                          <input type="text" required value={selectedClient.cpf || ''} onChange={e => setSelectedClient({...selectedClient, cpf: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-sm" />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-zinc-500">Telefone</label>
                          <input type="text" value={selectedClient.phone || ''} onChange={e => setSelectedClient({...selectedClient, phone: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500">E-mail</label>
                        <input type="email" value={selectedClient.email || ''} onChange={e => setSelectedClient({...selectedClient, email: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm" />
                    </div>
                    
                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                       <label className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={selectedClient.hasAccess || false} 
                              onChange={e => setSelectedClient({...selectedClient, hasAccess: e.target.checked})}
                            />
                            <div className="w-12 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full peer-checked:bg-emerald-500 transition-all"></div>
                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-6 transition-all"></div>
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[11px] font-black uppercase text-zinc-700 dark:text-white">Liberar Acesso ao Portal</span>
                             <span className="text-[9px] text-zinc-500 font-bold uppercase">Permite login via CPF e 6 primeiros dígitos</span>
                          </div>
                       </label>
                    </div>
                </div>
                <button type="submit" className="w-full py-4 bg-primary-500 text-black rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary-500/20 active:scale-95 transition-all">
                    Salvar Alterações
                </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
