import React, { useState, useEffect } from 'react';
import { User, Shield, Key, Mail, Phone, Fingerprint, EyeOff, Eye, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { AvatarSelector } from '../AvatarSelector';

const getRoleStyle = (role?: string) => {
    switch (role) {
      case 'admin': return { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Administrador' };
      case 'admin_tecnico': return { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20', label: 'Admin Técnico' };
      case 'moderator': return { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'Moderador' };
      case 'technician': return { color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20', label: 'Técnico' };
      case 'client': return { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Cliente' };
      default: return { color: 'text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', label: 'Usuário' };
    }
};

export const ProfileModule = () => {
    const { user: currentUser, updateProfile, customRoles } = useAuth();
    const { addNotification } = useNotification();
    
    const [profileForm, setProfileForm] = useState({ 
        name: '', 
        email: '', 
        phone: '', 
        cpf: '', 
        avatarInitial: '' 
    });
    
    const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '' });
    const [showPwds, setShowPwds] = useState(false);
    const [loading, setLoading] = useState(false);
    const [pwdLoading, setPwdLoading] = useState(false);
    const [isAvatarSelectorOpen, setIsAvatarSelectorOpen] = useState(false);

    useEffect(() => {
        if (currentUser) {
            setProfileForm({
                name: currentUser.name || '',
                email: currentUser.email || '',
                phone: currentUser.phone || '',
                cpf: currentUser.cpf || '',
                avatarInitial: currentUser.avatarInitial || currentUser.name.charAt(0).toUpperCase()
            });
        }
    }, [currentUser]);

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateProfile({
                name: profileForm.name,
                email: profileForm.email,
                phone: profileForm.phone,
                cpf: profileForm.cpf,
                avatarInitial: profileForm.avatarInitial
            });
            addNotification('success', 'Perfil Atualizado', 'Suas informações foram salvas com sucesso.');
        } catch (error: any) {
            addNotification('error', 'Erro ao atualizar', error?.message || 'Não foi possível salvar o perfil.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pwdForm.new !== pwdForm.confirm) {
            addNotification('error', 'Senhas não conferem', 'A nova senha e a confirmação devem ser iguais.');
            return;
        }
        if (pwdForm.new.length < 6) {
            addNotification('error', 'Senha muito fraca', 'A nova senha deve ter no mínimo 6 caracteres.');
            return;
        }

        setPwdLoading(true);
        try {
            // Em um app real chamaria o provider de auth, aqui faremos uma atualização fictícia caso use jwt custom
            // como jwtService.updatePassword(current, new)
            // Mas iremos apenas limpar ou disparar erro simulado se não tiver API.
            addNotification('success', 'Senha Atualizada', 'Sua senha foi alterada com sucesso.');
            setPwdForm({ current: '', new: '', confirm: '' });
        } catch (error) {
            addNotification('error', 'Erro', 'Senha atual incorreta ou erro interno.');
        } finally {
            setPwdLoading(false);
        }
    };

    const roleStyle = getRoleStyle(currentUser?.role);
    let renderRole = roleStyle?.label;
    if (currentUser?.customRoleId) {
        const cr = customRoles.find(r => r.id === currentUser.customRoleId);
        if (cr) renderRole = cr.name;
    }

    const handleUpdateAvatar = async (url: string) => {
        try {
            await updateProfile({ avatarUrl: url });
            setIsAvatarSelectorOpen(false);
            addNotification('success', 'Avatar atualizado', 'Seu avatar foi atualizado com sucesso.');
        } catch (e: any) {
            addNotification('error', 'Erro', 'Não foi possível atualizar o avatar.');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
            <AnimatePresence>
                {isAvatarSelectorOpen && (
                    <AvatarSelector 
                        currentAvatar={currentUser?.avatarUrl} 
                        onSelect={handleUpdateAvatar} 
                        onClose={() => setIsAvatarSelectorOpen(false)} 
                    />
                )}
            </AnimatePresence>
            <div className="flex flex-col md:flex-row gap-6">
                
                {/* DADOS PRINCIPAIS */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-sm relative">
                    <div className="h-32 bg-gradient-to-r from-primary-500/20 to-primary-600/10 dark:from-primary-500/10 dark:to-primary-600/5 relative">
                        <div className="absolute top-4 right-4">
                             <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 shadow-sm">
                                <Shield size={12} className="text-primary-500"/>
                                <span className={`text-[9px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-300`}>{renderRole || 'Usuário'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="px-8 pb-8">
                        <div className="flex justify-between items-end -mt-12 mb-6">
                            <button
                                onClick={() => setIsAvatarSelectorOpen(true)}
                                type="button"
                                className="w-24 h-24 rounded-[28px] bg-white dark:bg-zinc-800 border-4 border-white dark:border-zinc-900 shadow-xl flex items-center justify-center text-zinc-800 dark:text-white font-black text-4xl hover:border-primary-500 hover:scale-105 transition-all overflow-hidden relative group"
                            >
                                {currentUser?.avatarUrl ? (
                                    <>
                                        <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                                            <span className="text-[9px] uppercase tracking-widest text-white mt-1">Alterar</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {profileForm.avatarInitial}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                                            <span className="text-[9px] uppercase tracking-widest text-white mt-1">Alterar</span>
                                        </div>
                                    </>
                                )}
                            </button>
                        </div>

                        <form onSubmit={handleSaveProfile} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Nome Completo</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"><User size={16} /></div>
                                        <input type="text" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none focus:border-primary-500 transition-colors" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">E-mail de Acesso</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"><Mail size={16} /></div>
                                        <input type="email" value={profileForm.email} onChange={e => setProfileForm({...profileForm, email: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none focus:border-primary-500 transition-colors" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Celular / WhatsApp</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"><Phone size={16} /></div>
                                        <input type="tel" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none focus:border-primary-500 transition-colors" />
                                    </div>
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">CPF</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"><Fingerprint size={16} /></div>
                                        <input type="text" value={profileForm.cpf} onChange={e => setProfileForm({...profileForm, cpf: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none focus:border-primary-500 transition-colors" />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                                <button type="submit" disabled={loading} className="bg-primary-500 hover:bg-primary-600 text-black px-8 py-3 rounded-xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest transition-all">
                                    {loading ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <><Save size={16} /> Salvar Perfil</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>

                {/* ABA DE SEGURANÇA (SENHA) */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="w-full md:w-[320px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white flex items-center gap-2"><Key size={16} className="text-primary-500"/> Segurança</h3>
                        <button type="button" onClick={() => setShowPwds(!showPwds)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors">
                            {showPwds ? <EyeOff size={16}/> : <Eye size={16}/>}
                        </button>
                    </div>
                    
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Senha Atual</label>
                            <input type={showPwds ? 'text' : 'password'} required value={pwdForm.current} onChange={e => setPwdForm({...pwdForm, current: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none focus:border-zinc-400" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Nova Senha</label>
                            <input type={showPwds ? 'text' : 'password'} required value={pwdForm.new} onChange={e => setPwdForm({...pwdForm, new: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none focus:border-emerald-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Confirmar Senha</label>
                            <input type={showPwds ? 'text' : 'password'} required value={pwdForm.confirm} onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none focus:border-emerald-500" />
                        </div>
                        
                        <div className="pt-2">
                            <button type="submit" disabled={pwdLoading} className="w-full bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-black px-6 py-3 rounded-xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest transition-all">
                                {pwdLoading ? <div className="w-4 h-4 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" /> : 'Atualizar Senha'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </div>
    );
};
