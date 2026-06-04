import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, AlertCircle, Eye, EyeOff, Users, Type } from 'lucide-react';
import { AppSettings, AppAnnouncement, CustomRole } from '../../types';
import { storage } from '../../services/storage';
import { useNotification } from '../../contexts/NotificationContext';

export const AnnouncementModule = () => {
    const { addNotification } = useNotification();
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [roles, setRoles] = useState<CustomRole[]>([]);
    
    const [announcement, setAnnouncement] = useState<AppAnnouncement>({
        title: '',
        message: '',
        isActive: false,
        targetRoles: ['all']
    });

    useEffect(() => {
        const load = async () => {
            const s = await storage.getSettings();
            setSettings(s || {} as AppSettings);
            if (s?.announcement) {
                setAnnouncement(s.announcement);
            }
            const allRoles = await storage.getCustomRoles();
            setRoles(allRoles);
        };
        load();
    }, []);

    const handleSave = async () => {
        if (!settings) return;
        const newSettings = { ...settings, announcement };
        await storage.saveSettings(newSettings);
        addNotification('success', 'Salvo', 'Configurações de alerta salvas com sucesso.');
    };

    const toggleRole = (role: string) => {
        let newRoles = [...announcement.targetRoles];
        if (role === 'all') {
            if (newRoles.includes('all')) {
               newRoles = [];
            } else {
               newRoles = ['all'];
            }
        } else {
            if (newRoles.includes('all')) {
                newRoles = newRoles.filter(r => r !== 'all');
            }
            if (newRoles.includes(role)) {
                newRoles = newRoles.filter(r => r !== role);
            } else {
                newRoles.push(role);
            }
        }
        setAnnouncement({ ...announcement, targetRoles: newRoles });
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-20">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">Aviso Global</h2>
                        <p className="text-xs text-zinc-500 font-medium">Exiba alertas importantes para os usuários no sistema.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Status Toggle */}
                    <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 cursor-pointer" onClick={() => setAnnouncement({...announcement, isActive: !announcement.isActive})}>
                        <div className="flex items-center gap-3">
                            {announcement.isActive ? <Eye className="text-emerald-500" size={20} /> : <EyeOff className="text-zinc-500" size={20} />}
                            <div>
                                <p className="text-sm font-bold text-zinc-900 dark:text-white">Alerta Ativo</p>
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">O alerta será exibido na tela inicial.</p>
                            </div>
                        </div>
                        <div className={`w-12 h-6 rounded-full transition-colors relative ${announcement.isActive ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                            <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${announcement.isActive ? 'translate-x-6' : ''}`} />
                        </div>
                    </div>

                    {/* Content Fields */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Título do Alerta</label>
                            <input 
                                type="text" 
                                value={announcement.title}
                                onChange={e => setAnnouncement({...announcement, title: e.target.value})}
                                placeholder="Ex: Manutenção Programada"
                                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:ring-2 ring-primary-500 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Mensagem</label>
                            <textarea 
                                value={announcement.message}
                                onChange={e => setAnnouncement({...announcement, message: e.target.value})}
                                placeholder="Detalhes do aviso..."
                                rows={4}
                                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:ring-2 ring-primary-500 outline-none resize-none"
                            />
                        </div>
                    </div>

                    {/* Color Selection */}
                    <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2">
                            Cor do Alerta
                        </label>
                        <div className="flex gap-3">
                            {[
                                { id: 'orange', class: 'bg-orange-500', name: 'Laranja' },
                                { id: 'red', class: 'bg-red-500', name: 'Vermelho' },
                                { id: 'blue', class: 'bg-blue-500', name: 'Azul' },
                                { id: 'emerald', class: 'bg-emerald-500', name: 'Verde' },
                                { id: 'purple', class: 'bg-purple-500', name: 'Roxo' },
                                { id: 'zinc', class: 'bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900', name: 'Escuro/Claro' }
                            ].map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setAnnouncement({...announcement, color: c.id})}
                                    className={`w-8 h-8 rounded-full ${c.class} ring-2 ring-offset-2 dark:ring-offset-zinc-900 transition-all ${announcement.color === c.id || (!announcement.color && c.id === 'orange') ? 'ring-primary-500 scale-110' : 'ring-transparent opacity-50 hover:opacity-100 hover:scale-110'}`}
                                    title={c.name}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Roles Selection */}
                    <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2">
                            <Users size={14} /> Público Alvo
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => toggleRole('all')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${announcement.targetRoles.includes('all') ? 'bg-primary-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                            >
                                Todos
                            </button>
                            <button
                                onClick={() => toggleRole('admin')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${announcement.targetRoles.includes('admin') ? 'bg-primary-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                            >
                                Admin (Master)
                            </button>
                            <button
                                onClick={() => toggleRole('technician')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${announcement.targetRoles.includes('technician') ? 'bg-primary-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                            >
                                Técnicos
                            </button>
                            <button
                                onClick={() => toggleRole('client')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${announcement.targetRoles.includes('client') ? 'bg-primary-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                            >
                                Clientes
                            </button>
                            {roles.map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => toggleRole(r.id)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${announcement.targetRoles.includes(r.id) ? 'bg-primary-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                                >
                                    {r.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview Button (Save to show) */}
                    <div className="pt-6">
                        <button
                            onClick={handleSave}
                            className="w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-primary-500/20"
                        >
                            <Save size={18} /> Salvar e Aplicar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
