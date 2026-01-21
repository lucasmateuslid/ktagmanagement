
import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { Technician } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Users, Plus, Trash2, CheckCircle, XCircle, Save, Phone, Palette } from 'lucide-react';

export const Technicians = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Technician>>({ active: true, color: '#3b82f6' });

  const loadData = async () => {
    const data = await storage.getTechnicians();
    setTechnicians(data);
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    const tech: Technician = {
        id: formData.id || crypto.randomUUID(),
        name: formData.name,
        phone: formData.phone,
        active: formData.active ?? true,
        color: formData.color
    };

    await storage.saveTechnician(tech);
    addNotification('success', 'Sucesso', 'Técnico salvo com sucesso.');
    setIsModalOpen(false);
    loadData();
  };

  const toggleStatus = async (tech: Technician) => {
      await storage.saveTechnician({ ...tech, active: !tech.active });
      loadData();
  };

  if (user?.role !== 'admin') return <div className="p-10 text-center text-zinc-500 uppercase font-black">Acesso Restrito</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div>
            <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Equipe Técnica</h1>
            <p className="text-zinc-500 mt-1 font-medium text-xs">Gestão de instaladores e técnicos de campo.</p>
        </div>
        <button onClick={() => { setFormData({ active: true, color: '#3b82f6' }); setIsModalOpen(true); }} className="bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl flex items-center gap-2 font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all shadow-xl">
            <Plus size={16} /> Novo Técnico
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {technicians.map(tech => (
            <div key={tech.id} className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-lg" style={{ backgroundColor: tech.color }}>
                        {tech.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-black text-zinc-900 dark:text-white uppercase text-sm">{tech.name}</h3>
                        <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-bold mt-0.5">
                            <Phone size={10} /> {tech.phone}
                        </div>
                    </div>
                </div>
                <button onClick={() => toggleStatus(tech)} className={`p-2 rounded-xl transition-all ${tech.active ? 'text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200'}`}>
                    {tech.active ? <CheckCircle size={20} /> : <XCircle size={20} />}
                </button>
            </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 w-full max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl">
                <h2 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase mb-6">Cadastro de Técnico</h2>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nome Completo</label>
                        <input type="text" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Telefone</label>
                        <input type="text" required value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none" placeholder="(00) 00000-0000" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Cor na Agenda</label>
                        <div className="flex gap-2 mt-2">
                            {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(c => (
                                <button key={c} type="button" onClick={() => setFormData({...formData, color: c})} className={`w-8 h-8 rounded-full border-2 ${formData.color === c ? 'border-white ring-2 ring-zinc-900 dark:ring-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl font-black uppercase text-[10px] text-zinc-500 hover:text-zinc-900">Cancelar</button>
                        <button type="submit" className="flex-1 py-3 bg-primary-500 text-black rounded-xl font-black uppercase text-[10px] shadow-lg hover:scale-105 transition-all">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};
