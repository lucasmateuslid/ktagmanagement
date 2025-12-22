import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { storage } from '../services/storage';
import { Tag, Vehicle } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Edit2, Save, X, Upload, CheckSquare, Square, Wifi, Search, Car, AlertTriangle, Activity, BatteryCharging, Calendar, Check } from 'lucide-react';

export const Tags = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Tag>>({ batteryWarrantyYears: 1 });
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

  const filteredTags = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return tags.filter(tag => {
      const linkedVehicle = vehicles.find(v => v.tagId === tag.id);
      return (
        tag.name.toLowerCase().includes(term) ||
        tag.accessoryId.toLowerCase().includes(term) ||
        (tag.macAddress && tag.macAddress.toLowerCase().includes(term)) ||
        (linkedVehicle && linkedVehicle.plate.toLowerCase().includes(term))
      );
    });
  }, [tags, searchTerm, vehicles]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedTags(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTags.size === filteredTags.length && filteredTags.length > 0) {
      setSelectedTags(new Set());
    } else {
      setSelectedTags(new Set(filteredTags.map(t => t.id)));
    }
  };

  const handleBulkWarrantyUpdate = async (years: number) => {
    if (selectedTags.size === 0) return;
    
    const count = selectedTags.size;
    const idsToUpdate: string[] = Array.from(selectedTags);
    
    await Promise.all(idsToUpdate.map(async (id) => {
        const tag = tags.find(t => t.id === id);
        if (tag) {
            await storage.saveTag({ ...tag, batteryWarrantyYears: years });
        }
    }));

    storage.logAction(user, 'UPDATE', 'Tag', `Atualizou em massa ${count} tags para ${years} anos de garantia`);
    addNotification('success', 'Atualização em Massa', `${count} tags atualizadas para ${years} anos.`);
    setSelectedTags(new Set());
    await loadData();
  };

  const handleBulkDelete = async () => {
    if (selectedTags.size === 0 || !confirm(`Deseja realmente excluir as ${selectedTags.size} tags selecionadas?`)) return;
    
    const ids: string[] = Array.from(selectedTags);
    await storage.deleteTags(ids);
    storage.logAction(user, 'DELETE', 'Tag', `Excluiu ${ids.length} tags em massa`);
    addNotification('success', 'Removido', `${ids.length} tags excluídas.`);
    setSelectedTags(new Set());
    await loadData();
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
      batteryWarrantyYears: formData.batteryWarrantyYears || 1,
      warrantyStartedAt: formData.warrantyStartedAt,
      createdAt: formData.createdAt || Date.now(),
    };
    await storage.saveTag(newTag);
    // Trigger de Auditoria
    storage.logAction(user, isEdit ? 'UPDATE' : 'CREATE', 'Tag', `${isEdit ? 'Atualizou' : 'Registrou'} tag ${newTag.name} (SN: ${newTag.accessoryId})`, newTag.id);
    
    await loadData();
    setIsModalOpen(false);
    setFormData({ batteryWarrantyYears: 1 });
    addNotification('success', 'Sucesso', 'Tag salva com sucesso.');
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tag = tags.find(t => t.id === id);
    if (!confirm(t('deleteConfirm'))) return;
    await storage.deleteTag(id);
    
    // Trigger de Auditoria
    storage.logAction(user, 'DELETE', 'Tag', `Removeu tag ${tag?.name} (SN: ${tag?.accessoryId})`, id);
    
    addNotification('success', 'Removido', 'Tag excluída.');
    await loadData();
  };

  const getWarrantyInfo = (tag: Tag) => {
    if (!tag.warrantyStartedAt || !tag.batteryWarrantyYears) return null;
    
    const startDate = new Date(tag.warrantyStartedAt);
    const expiryDate = new Date(tag.warrantyStartedAt);
    expiryDate.setFullYear(startDate.getFullYear() + tag.batteryWarrantyYears);
    
    const isExpired = Date.now() > expiryDate.getTime();
    const diffTime = expiryDate.getTime() - Date.now();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      expiryDate,
      isExpired,
      daysRemaining: diffDays > 0 ? diffDays : 0
    };
  };

  return (
    <div className="space-y-8 pb-20">
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
              onClick={() => { setFormData({ batteryWarrantyYears: 1 }); setIsModalOpen(true); }}
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
            <button 
                onClick={handleSelectAll}
                className={`px-5 py-2.5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all border ${selectedTags.size === filteredTags.length && filteredTags.length > 0 ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'}`}
            >
                {selectedTags.size === filteredTags.length && filteredTags.length > 0 ? <CheckSquare size={14} /> : <Square size={14} />}
                {selectedTags.size === filteredTags.length && filteredTags.length > 0 ? 'Limpar Seleção' : 'Selecionar Tudo'}
            </button>
            <div className="px-5 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                <Activity size={14} className="text-emerald-500" />
                <span className="text-[10px] font-black uppercase text-zinc-500">{filteredTags.length} / {tags.length}</span>
            </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedTags.size > 0 && (
          <div className="bg-[#18181b] text-white p-5 rounded-full flex items-center justify-between shadow-2xl animate-in slide-in-from-top-4 duration-300 border border-white/5 mx-auto w-full max-w-6xl">
              <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary-500 text-black flex items-center justify-center font-black text-sm shadow-lg shadow-primary-500/20">
                      {selectedTags.size}
                  </div>
                  <div className="hidden sm:block">
                      <h4 className="font-display font-black uppercase tracking-tight text-xs leading-none">Ações em Massa</h4>
                      <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">Aplicar configurações para as tags selecionadas</p>
                  </div>
              </div>

              <div className="flex items-center gap-4">
                  <div className="flex items-center bg-zinc-900/50 p-1 rounded-full border border-white/10">
                      <span className="px-4 text-[9px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
                        <BatteryCharging size={12} className="text-zinc-600"/> Garantia:
                      </span>
                      <div className="flex gap-1">
                        {[1, 2, 3].map(yr => (
                            <button 
                              key={yr} 
                              onClick={() => handleBulkWarrantyUpdate(yr)}
                              className={`px-4 py-2 rounded-full text-[10px] font-black transition-all uppercase tracking-widest hover:bg-primary-500 hover:text-black`}
                            >
                              {yr}A
                            </button>
                        ))}
                      </div>
                  </div>
                  
                  <button 
                    onClick={handleBulkDelete}
                    className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2 transition-all shadow-lg shadow-red-500/20 active:scale-95"
                  >
                    <Trash2 size={14} /> Excluir Seleção
                  </button>

                  <button 
                    onClick={() => setSelectedTags(new Set())}
                    className="p-2 text-zinc-500 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
              </div>
          </div>
      )}

      {isStockLow && (
        <div className="bg-amber-500 text-black p-4 rounded-3xl flex items-center justify-between font-black uppercase tracking-widest text-[10px] shadow-lg shadow-amber-500/20">
          <div className="flex items-center gap-3"><AlertTriangle size={20}/> Atenção: Estoque de Tags Livres em Nível Crítico ({unlinkedCount})</div>
          <button className="underline">Solicitar Reposição</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredTags.map((tag) => {
          const isSelected = selectedTags.has(tag.id);
          const vehicle = vehicles.find(v => v.tagId === tag.id);
          const warranty = getWarrantyInfo(tag);

          return (
            <div 
              key={tag.id} 
              onClick={() => toggleSelect(tag.id)}
              className={`bg-white dark:bg-zinc-900 p-8 rounded-[32px] border transition-all cursor-pointer group relative overflow-hidden ${isSelected ? 'border-primary-500 ring-1 ring-primary-500' : 'border-zinc-200 dark:border-zinc-800'}`}
            >
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl transition-all shadow-sm ${isSelected ? 'bg-primary-500 text-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:text-primary-500'}`}>
                  <Wifi size={24} />
                </div>
                <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); setFormData(tag); setIsModalOpen(true); }} className="p-2 text-zinc-300 hover:text-primary-500 transition-colors"><Edit2 size={18}/></button>
                    <button onClick={(e) => handleDelete(tag.id, e)} className="p-2 text-zinc-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight truncate">{tag.name}</h3>
                <p className="text-[10px] font-mono text-zinc-400 mt-1 uppercase tracking-[0.2em] font-bold">SN: {tag.accessoryId}</p>
              </div>

              <div className="mt-8 space-y-4">
                 <div className="p-5 bg-zinc-50 dark:bg-zinc-950/50 rounded-[24px] border border-zinc-100 dark:border-zinc-800/50">
                    <div className="flex justify-between text-[10px] font-black uppercase text-zinc-400 mb-3 tracking-widest">
                        <span>Status de Vínculo</span>
                        {vehicle ? <span className="text-primary-500">ATIVO</span> : <span className="text-zinc-300">LIVRE</span>}
                    </div>
                    {vehicle ? (
                        <div className="flex items-center gap-3 text-sm font-bold text-zinc-700 dark:text-zinc-200">
                            <div className="p-1.5 bg-primary-500/10 rounded-lg text-primary-500"><Car size={14} /></div>
                            <span className="uppercase">{vehicle.plate} - {vehicle.model}</span>
                        </div>
                    ) : <div className="text-[11px] font-bold text-zinc-400 italic">Aguardando instalação</div>}
                 </div>

                 <div className={`p-5 rounded-[24px] border transition-colors ${warranty ? (warranty.isExpired ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/20') : 'bg-zinc-50 dark:bg-zinc-950/50 border-zinc-100 dark:border-zinc-800/50'}`}>
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-black uppercase text-zinc-400 flex items-center gap-1 tracking-widest"><BatteryCharging size={12}/> Garantia Bateria</span>
                        <span className="text-[10px] font-black text-zinc-500">{tag.batteryWarrantyYears} anos</span>
                    </div>
                    {warranty ? (
                        <div className="mt-1">
                            {warranty.isExpired ? (
                                <p className="text-[11px] font-black text-red-500 uppercase tracking-tight">Expirada em {warranty.expiryDate.toLocaleDateString()}</p>
                            ) : (
                                <div className="flex justify-between items-center">
                                    <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">{warranty.daysRemaining} dias restantes</p>
                                    <span className="text-[9px] font-bold text-zinc-400">Exp: {warranty.expiryDate.toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-[11px] font-bold text-zinc-400 italic">Aguardando ativação no veículo</p>
                    )}
                 </div>
              </div>
            </div>
          );
        })}
      </div>

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
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Garantia Bateria</label>
                        <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                            {[1, 2, 3].map(years => (
                                <button 
                                    key={years}
                                    type="button" 
                                    onClick={() => setFormData({...formData, batteryWarrantyYears: years})}
                                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${formData.batteryWarrantyYears === years ? 'bg-primary-500 text-black shadow-lg' : 'text-zinc-500'}`}
                                >
                                    {years} Ano{years > 1 ? 's' : ''}
                                </button>
                            ))}
                        </div>
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