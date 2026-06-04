
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Plus, Save, Megaphone, CheckCircle2, Wrench, AlertTriangle, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../services/storage';
import { ConfirmModal } from './ConfirmModal';
import { SystemUpdate } from '../types';
import { GoogleGenAI } from "@google/genai";
import { useNotification } from '../contexts/NotificationContext';

const MotionDiv = motion.div as any;

interface ChangelogModalProps {
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ onClose }) => {
  const { user, isAdmin } = useAuth();
  const { addNotification } = useNotification();
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [formData, setFormData] = useState<Partial<SystemUpdate>>({
    type: 'feature',
    date: Date.now()
  });

  useEffect(() => {
    loadUpdates();
  }, []);

  const loadUpdates = async () => {
    setLoading(true);
    const data = await storage.getSystemUpdates();
    setUpdates(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.content || !formData.version) {
        addNotification('error', 'Erro', 'Preencha todos os campos obrigatórios.');
        return;
    }

    const id = formData.id || crypto.randomUUID();
    const newUpdate: SystemUpdate = {
        id: id,
        title: formData.title,
        content: formData.content,
        version: formData.version,
        type: formData.type as any || 'feature',
        date: formData.date || Date.now()
    };

    await storage.saveSystemUpdate(newUpdate);
    
    // Atualiza a lista localmente
    setUpdates(prev => {
        const exists = prev.some(u => u.id === id);
        if (exists) {
            return prev.map(u => u.id === id ? newUpdate : u);
        }
        return [newUpdate, ...prev];
    });

    setIsAdding(false);
    setFormData({ type: 'feature', date: Date.now() });
    addNotification('success', 'Sucesso', 'Novidade salva no sistema.');
  };

  const handleEdit = (item: SystemUpdate) => {
      setFormData(item);
      setIsAdding(true);
  };

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const handleDelete = (id: string) => {
      setItemToDelete(id);
      setIsConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
      if (!itemToDelete) return;
      
      try {
          await storage.deleteSystemUpdate(itemToDelete);
          setUpdates(prev => prev.filter(u => u.id !== itemToDelete));
          addNotification('info', 'Removido', 'Item excluído do mural.');
      } catch (e) {
          addNotification('error', 'Erro', 'Falha ao excluir.');
      } finally {
          setIsConfirmDeleteOpen(false);
          setItemToDelete(null);
      }
  };

  const generateWithAI = async () => {
    if (!isAdmin) return;
    setGenerating(true);
    try {
        const logs = await storage.getAuditLogs(20); // Pega últimos 20 logs
        const logText = logs.map(l => `- ${l.action} em ${l.entity}: ${l.details}`).join('\n');
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Você é um Technical Writer. Com base nos logs de auditoria abaixo, escreva um Release Note curto e amigável para os usuários do sistema K-TAG.
            Foques em melhorias e correções. Não mencione detalhes técnicos de banco de dados. Use markdown simples.
            Retorne JSON no formato: { title: "Titulo Impactante", content: "Texto do release note", version: "vX.X.X", type: "feature" | "fix" | "announcement" }
            
            Logs:
            ${logText}`
        });

        const text = response.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            setFormData({
                id: undefined, // Garante criação de novo
                title: data.title,
                content: data.content,
                version: data.version || 'v1.0.x',
                type: data.type || 'feature',
                date: Date.now()
            });
            setIsAdding(true);
        } else {
            throw new Error("Formato inválido da IA");
        }

    } catch (e) {
        console.error(e);
        addNotification('error', 'Erro IA', 'Não foi possível gerar as notas automaticamente.');
    } finally {
        setGenerating(false);
    }
  };

  const getTypeIcon = (type: string) => {
      switch(type) {
          case 'feature': return <Sparkles size={16} className="text-emerald-500"/>;
          case 'fix': return <Wrench size={16} className="text-amber-500"/>;
          default: return <Megaphone size={16} className="text-blue-500"/>;
      }
  };

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="changelog-modal-title">
      <MotionDiv
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="modal-card sm:max-w-2xl"
      >
        {/* Header */}
        <div className="modal-card-header p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50">
            <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-primary-500 rounded-xl text-black shadow-lg shadow-primary-500/20 shrink-0">
                    <Megaphone size={20} strokeWidth={2.5}/>
                </div>
                <div className="min-w-0">
                    <h2 id="changelog-modal-title" className="text-lg sm:text-xl font-display font-black uppercase tracking-tight text-zinc-900 dark:text-white truncate">Novidades & Updates</h2>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">O que há de novo no sistema</p>
                </div>
            </div>
            <button type="button" aria-label="Fechar" onClick={onClose} className="shrink-0 p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 rounded-xl transition-all"><X size={20}/></button>
        </div>

        {/* Content */}
        <div className="modal-card-body custom-scrollbar p-5 sm:p-6 space-y-6">
            
            {/* Admin Controls */}
            {isAdmin && !isAdding && (
                <div className="flex gap-2 mb-4">
                    <button onClick={() => { setFormData({ type: 'feature', date: Date.now() }); setIsAdding(true); }} className="flex-1 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all">
                        <Plus size={16}/> Adicionar Manualmente
                    </button>
                    <button onClick={generateWithAI} disabled={generating} className="flex-1 py-3 bg-primary-500 text-black rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-primary-400 transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50">
                        {generating ? <RefreshCw className="animate-spin" size={16}/> : <Sparkles size={16}/>} Gerar com IA
                    </button>
                </div>
            )}

            {/* Add/Edit Form */}
            {isAdding && (
                <div className="bg-zinc-50 dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 animate-in slide-in-from-top-2">
                    <div className="flex justify-between">
                        <h3 className="text-xs font-black uppercase tracking-widest">{formData.id ? 'Editar Novidade' : 'Nova Atualização'}</h3>
                        <button onClick={() => setIsAdding(false)} className="text-zinc-400 hover:text-red-500"><X size={16}/></button>
                    </div>
                    <input type="text" placeholder="Título (Ex: Novo Módulo de Mapas)" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold outline-none"/>
                    <div className="flex gap-2">
                        <input type="text" placeholder="Versão (v1.0.0)" value={formData.version || ''} onChange={e => setFormData({...formData, version: e.target.value})} className="flex-1 px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-mono outline-none"/>
                        <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="flex-1 px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold outline-none">
                            <option value="feature">✨ Novidade</option>
                            <option value="fix">🔧 Correção</option>
                            <option value="announcement">📢 Anúncio</option>
                        </select>
                    </div>
                    <textarea placeholder="Descrição das mudanças..." rows={4} value={formData.content || ''} onChange={e => setFormData({...formData, content: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium outline-none"/>
                    <button onClick={handleSave} className="w-full py-3 bg-emerald-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all"><Save size={16}/> Salvar</button>
                </div>
            )}

            {/* Timeline */}
            <div className="space-y-6 relative">
                {updates.length === 0 && !loading && (
                    <div className="text-center py-10 opacity-40">
                        <Megaphone size={48} className="mx-auto mb-2 text-zinc-400"/>
                        <p className="text-xs font-bold text-zinc-500 uppercase">Nenhuma novidade registrada</p>
                    </div>
                )}

                {updates.map((item, idx) => (
                    <div key={item.id} className="relative pl-8 border-l-2 border-zinc-100 dark:border-zinc-800 last:border-0 pb-6 group">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                            <div className={`w-1.5 h-1.5 rounded-full ${item.type === 'feature' ? 'bg-emerald-500' : item.type === 'fix' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                        </div>
                        
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 ${
                                        item.type === 'feature' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 
                                        item.type === 'fix' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 
                                        'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                    }`}>
                                        {getTypeIcon(item.type)} {item.type === 'feature' ? 'NOVIDADE' : item.type === 'fix' ? 'CORREÇÃO' : 'AVISO'}
                                    </span>
                                    <span className="text-[10px] font-mono text-zinc-400">{new Date(item.date).toLocaleDateString()}</span>
                                </div>
                                {isAdmin && (
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEdit(item)} className="text-zinc-400 hover:text-blue-500"><Edit2 size={14}/></button>
                                        <button onClick={() => handleDelete(item.id)} className="text-zinc-400 hover:text-red-500"><Trash2 size={14}/></button>
                                    </div>
                                )}
                            </div>
                            
                            <h3 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                                {item.title} <span className="text-xs font-mono text-zinc-400 font-normal px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">{item.version}</span>
                            </h3>
                            
                            <div className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line mt-2 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                                {item.content}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </MotionDiv>

      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="Remover Novidade"
        message="Tem certeza que deseja remover esta novidade? Esta ação não pode ser desfeita."
        type="danger"
      />
    </div>
  );
};
