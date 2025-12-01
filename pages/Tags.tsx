
import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../services/storage';
import { Tag } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Plus, Trash2, Edit2, Key, Save, X, Upload, CheckSquare, Square, Wifi } from 'lucide-react';

export const Tags = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Tag>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const loadTags = async () => {
    const loaded = await storage.getTags();
    setTags(loaded);
  };

  useEffect(() => {
    loadTags();
  }, []);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTags(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedTags.size === tags.length) {
      setSelectedTags(new Set());
    } else {
      setSelectedTags(new Set(tags.map(t => t.id)));
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Stop card selection
    e?.nativeEvent.stopImmediatePropagation();

    if (confirm(t('deleteConfirm'))) {
      // Optimistic Update: Remove from UI immediately
      setTags(prev => prev.filter(t => t.id !== id));
      setSelectedTags(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      // Perform actual delete
      await storage.deleteTag(id);
      
      // DO NOT CALL loadTags() HERE. 
      // It causes a race condition where the DB returns the old item before deletion propagates.
    }
  };

  const handleMassDelete = async () => {
    const count = selectedTags.size;
    if (count === 0) return;
    
    if (confirm(t('massDeleteConfirm'))) {
      const idsToDelete = Array.from(selectedTags);

      // Optimistic Update
      setTags(prev => prev.filter(t => !selectedTags.has(t.id)));
      setSelectedTags(new Set());
      
      await storage.deleteTags(idsToDelete);
      // DO NOT CALL loadTags() HERE.
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.accessoryId || !formData.hashedAdvKey || !formData.privateKey) {
      alert('All fields are required');
      return;
    }

    const newTag: Tag = {
      id: formData.id || crypto.randomUUID(),
      name: formData.name,
      accessoryId: formData.accessoryId,
      hashedAdvKey: formData.hashedAdvKey,
      privateKey: formData.privateKey,
      macAddress: formData.macAddress,
      createdAt: formData.createdAt || Date.now(),
    };

    // Optimistic Add/Update
    if (formData.id) {
        setTags(prev => prev.map(t => t.id === newTag.id ? newTag : t));
    } else {
        setTags(prev => [...prev, newTag]);
    }

    await storage.saveTag(newTag);
    // Only reload on save to ensure consistency, delete relies on optimistic
    loadTags(); 
    setIsModalOpen(false);
    setFormData({});
  };

  const openEdit = (tag: Tag, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFormData(tag);
    setIsModalOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) processCSV(text);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processCSV = async (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      alert("Invalid CSV: Empty or missing header.");
      return;
    }

    const headerLine = lines[0];
    const separator = headerLine.includes(';') ? ';' : ',';
    
    let count = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 5) continue;

      const accessoryId = cols[0];
      const keyName = cols[1];
      const mac = cols[2];
      const privateKey = cols[3];
      const hashedAdvKey = cols[4];

      if (!accessoryId || !privateKey || !hashedAdvKey) continue;

      const newTag: Tag = {
        id: crypto.randomUUID(),
        name: keyName || `Tag ${accessoryId}`,
        accessoryId: accessoryId,
        macAddress: mac,
        privateKey: privateKey,
        hashedAdvKey: hashedAdvKey,
        createdAt: Date.now()
      };
      
      await storage.saveTag(newTag);
      count++;
    }

    loadTags();
    alert(t('importSuccess'));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('tagManagement')}</h1>
          <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-1 rounded-full">
            {tags.length}
          </span>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          {selectedTags.size > 0 && (
            <button
              onClick={handleMassDelete}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors mr-auto md:mr-0 animate-pulse z-20 relative cursor-pointer"
            >
              <Trash2 size={18} /> {t('deleteSelected')} ({selectedTags.size})
            </button>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".csv,.txt" 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors flex-1 md:flex-none justify-center"
          >
            <Upload size={18} /> {t('importCSV')}
          </button>
          <button
            onClick={() => { setFormData({}); setIsModalOpen(true); }}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors flex-1 md:flex-none justify-center"
          >
            <Plus size={18} /> {t('addTag')}
          </button>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <button 
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 transition-colors"
          >
            {selectedTags.size === tags.length && tags.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
            {t('selectAll')}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {tags.map((tag) => {
          const isSelected = selectedTags.has(tag.id);
          return (
            <div 
              key={tag.id} 
              className={`
                relative rounded-xl shadow-sm border p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer
                ${isSelected 
                  ? 'bg-primary-50 border-primary-500 dark:bg-primary-900/20 dark:border-primary-500' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-primary-300 dark:hover:border-primary-700'}
              `}
              onClick={(e) => {
                toggleSelect(tag.id);
              }}
            >
              <div className="absolute top-4 right-4 z-0">
                 <div className={`
                    w-5 h-5 rounded border flex items-center justify-center
                    ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}
                 `}>
                    {isSelected && <CheckSquare size={14} className="text-white" />}
                 </div>
              </div>

              <div>
                <div className="flex justify-between items-start mb-4 pr-8">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg text-primary-600">
                    <Wifi size={24} />
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{tag.name}</h3>
                <p className="text-xs text-slate-500 font-mono mb-4">SN: {tag.accessoryId}</p>
                
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-md">
                   {tag.macAddress && (
                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">
                      <span className="font-semibold text-xs uppercase text-slate-500">{t('macAddress')}</span>
                      <span className="font-mono text-xs">{tag.macAddress}</span>
                    </div>
                   )}
                  <div className="flex justify-col gap-1 flex-col">
                    <span className="font-semibold text-xs uppercase text-slate-500">{t('hashedKey')}</span>
                    <span className="font-mono text-[10px] break-all text-slate-500">{tag.hashedAdvKey}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                 <span className="text-xs text-slate-400">{new Date(tag.createdAt).toLocaleDateString()}</span>
                 
                 <div className="flex gap-1 z-10 relative" onClick={e => {
                   e.stopPropagation();
                   e.nativeEvent.stopImmediatePropagation();
                 }}>
                    <button 
                      onClick={(e) => openEdit(tag, e)} 
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-primary-600 transition-colors relative z-20 cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={(e) => handleDelete(tag.id, e)} 
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-slate-400 hover:text-red-600 transition-colors relative z-20 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                 </div>
              </div>
            </div>
          );
        })}

        {tags.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            {t('noTags')}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {formData.id ? t('editTag') : t('newTag')}
              </h2>
              <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('tagName')}</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('accessoryId')}</label>
                <input
                  type="text"
                  required
                  value={formData.accessoryId || ''}
                  onChange={e => setFormData({ ...formData, accessoryId: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('macAddress')}</label>
                <input
                  type="text"
                  value={formData.macAddress || ''}
                  onChange={e => setFormData({ ...formData, macAddress: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hashedKey')}</label>
                <input
                  type="text"
                  required
                  value={formData.hashedAdvKey || ''}
                  onChange={e => setFormData({ ...formData, hashedAdvKey: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('privateKey')}</label>
                <input
                  type="password"
                  required
                  value={formData.privateKey || ''}
                  onChange={e => setFormData({ ...formData, privateKey: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mt-4"
              >
                <Save size={20} /> {t('saveTag')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
