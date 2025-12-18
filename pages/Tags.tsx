
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { storage } from '../services/storage';
import { Tag, Vehicle } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Edit2, Save, X, Upload, CheckSquare, Square, Wifi, Search, Car, AlertTriangle, Factory, Filter, Activity } from 'lucide-react';

export const Tags = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Tag>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();
  const { addNotification } = useNotification();
  const { user } = useAuth();

  const loadData = async () => {
    const [loadedTags, loadedVehicles] = await Promise.all([
      storage.getTags(),
      storage.getVehicles()
    ]);
    setTags(loadedTags);
    setVehicles(loadedVehicles);
  };

  useEffect(() => {
    loadData();
  }, []);

  const unlinkedCount = tags.length - vehicles.filter(v => v.tagId).length;
  const isStockLow = unlinkedCount <= 80;

  const filteredTags = tags.filter(tag => {
    const term = searchTerm.toLowerCase();
    const linkedVehicle = vehicles.find(v => v.tagId === tag.id);
    return (
      tag.name.toLowerCase().includes(term) ||
      tag.accessoryId.toLowerCase().includes(term) ||
      (tag.macAddress && tag.macAddress.toLowerCase().includes(term)) ||
      (linkedVehicle && linkedVehicle.plate.toLowerCase().includes(term))
    );
  });

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedTags(newSelected);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!formData.id;
    const newTag: Tag = {
      id: formData.id || crypto.randomUUID(),
      name: formData.name!,
      accessoryId: formData.accessoryId!,
      hashedAdvKey: formData.hashedAdvKey!,
      privateKey: formData.privateKey!,
      macAddress: formData.macAddress,
      createdAt: formData.createdAt || Date.now(),
    };
    await storage.saveTag(newTag);
    storage.logAction(user, isEdit ? 'UPDATE' : 'CREATE', 'Tag', `${isEdit ? 'Atualizou' : 'Criou'} tag ${newTag.name}`, newTag.id);
    loadData();
    setIsModalOpen(false);
    setFormData({});
    addNotification('success', 'Sucesso', 'Tag salva com sucesso.');
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('deleteConfirm'))) return;
    await storage.deleteTag(id);
    addNotification('success', 'Removido', 'Tag excluída.');
    loadData();
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white tracking-tight uppercase">{t('tagManagement')}</h1>
          <p className="text-zinc-500 text-sm mt-1 font-medium">Controle de estoque e chaves de criptografia K-Tag.</p>
        </div>
        <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl flex items-center gap-2 font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
            >
              <Upload size={16} /> {t('importCSV')}
            </button>
            <button
              onClick={() => { setFormData({}); setIsModalOpen(true); }}
              className="bg-primary-500 hover:bg-primary-400 text-black px-6 py-3 rounded-2xl flex items-center gap-2 font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-primary-500/20"
            >
              <Plus size={18} strokeWidth={3} /> {t('addTag')}
            </button>
        </div>
      </div>

      <input type="file" ref={fileInputRef} onChange={(e) => {}} accept=".csv" className="hidden" />

      {/* Global Filter Bar */}
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder={t('searchTags')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-zinc-900 dark:text-white"
          />
        </div>
        <div className="flex gap-2">
            <div className="px-5 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                <Activity size={14} className="text-emerald-500" />
                <span className="text-[10px] font-black uppercase text-zinc-500">{tags.length} Total</span>
            </div>
            {selectedTags.size > 0 && (
                <button className="px-5 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
                    <Trash2 size={14} /> Excluir ({selectedTags.size})
                </button>
            )}
        </div>
      </div>

      {isStockLow && (
        <div className="bg-amber-500 text-black p-4 rounded-3xl flex items-center justify-between font-black uppercase tracking-widest text-[10px] shadow-lg shadow-amber-500/20">
          <div className="flex items-center gap-3"><AlertTriangle size={20}/> Atenção: Estoque de Tags Livres em Nível Crítico ({unlinkedCount})</div>
          <button className="underline">Solicitar Reposição</button>
        </div>
      )}

      {/* Grid of Tags */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTags.map((tag) => {
          const isSelected = selectedTags.has(tag.id);
          const vehicle = vehicles.find(v => v.tagId === tag.id);
          return (
            <div 
              key={tag.id} 
              onClick={() => toggleSelect(tag.id)}
              className={`bg-white dark:bg-zinc-900 p-8 rounded-[32px] border transition-all cursor-pointer group relative overflow-hidden ${isSelected ? 'border-primary-500 ring-2 ring-primary-500/10' : 'border-zinc-200 dark:border-zinc-800 hover:border-primary-500/50'}`}
            >
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl transition-colors ${isSelected ? 'bg-primary-500 text-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:text-primary-500'}`}>
                  <Wifi size={24} />
                </div>
                <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setFormData(tag); setIsModalOpen(true); }} className="p-2 text-zinc-400 hover:text-primary-500 transition-colors"><Edit2 size={18}/></button>
                    <button onClick={(e) => handleDelete(tag.id, e)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                </div>
              </div>

              <h3 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight truncate">{tag.name}</h3>
              <p className="text-[10px] font-mono text-zinc-500 mt-1 uppercase tracking-widest">SN: {tag.accessoryId}</p>

              <div className="mt-6 space-y-3">
                 <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                    <div className="flex justify-between text-[10px] font-black uppercase text-zinc-400 mb-1">
                        <span>Status de Vínculo</span>
                        {vehicle ? <span className="text-primary-500">ATIVO</span> : <span>LIVRE</span>}
                    </div>
                    {vehicle ? (
                        <div className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-200">
                            <Car size={14} className="text-primary-500" /> {vehicle.plate} - {vehicle.model}
                        </div>
                    ) : <div className="text-sm font-bold text-zinc-400 italic">Aguardando instalação</div>}
                 </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Reestilizado */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-lg p-10 shadow-2xl relative border border-zinc-200 dark:border-zinc-800 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Configurar Tag</h2>
               <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400"><X size={24}/></button>
            </div>
            <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Apelido da Tag</label>
                        <input type="text" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500 transition-all" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Accessory ID (Serial)</label>
                        <input type="text" required value={formData.accessoryId || ''} onChange={e => setFormData({...formData, accessoryId: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-zinc-900 dark:text-white outline-none focus:border-primary-500 transition-all" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Hashed Key</label>
                        <input type="text" required value={formData.hashedAdvKey || ''} onChange={e => setFormData({...formData, hashedAdvKey: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-xs text-zinc-900 dark:text-white outline-none focus:border-primary-500 transition-all" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Private Key</label>
                        <input type="password" required value={formData.privateKey || ''} onChange={e => setFormData({...formData, privateKey: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-zinc-900 dark:text-white outline-none focus:border-primary-500 transition-all" />
                    </div>
                </div>
                <button type="submit" className="w-full py-4 bg-primary-500 text-black rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary-500/20 active:scale-95 transition-all">
                    Finalizar Configuração
                </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
