import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, ShieldCheck, 
  Users, ChevronLeft, UserCircle, Sliders, Database, Bell
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { SystemApisModule } from '../components/settings/SystemApisModule';
import { ProfileModule } from '../components/settings/ProfileModule';
import { PermissionsModule } from '../components/settings/PermissionsModule';
import { AnnouncementModule } from '../components/settings/AnnouncementModule';
import { Users as UsersModule } from './Users';
import { motion, AnimatePresence } from 'framer-motion';

export const Settings = () => {
    const { isAdmin } = useAuth();
    const [activeModule, setActiveModule] = useState<'profile' | 'system' | 'roles' | 'users' | 'announcement' | null>(null);

    // Filter out cards that shouldn't be accessible
    // Actually the logic is inside render, let's keep it

    if (activeModule) {
        return (
            <div className="h-full flex flex-col pt-10 px-4 md:px-8 max-w-7xl mx-auto w-full">
                <button 
                  onClick={() => setActiveModule(null)}
                  className="flex items-center gap-2 text-zinc-500 hover:text-primary-500 font-black uppercase text-[10px] tracking-widest mb-6 transition-colors w-fit"
                >
                    <ChevronLeft size={16} /> Voltar para Preferências
                </button>
                
                <div className="flex-1 overflow-y-auto pb-8">
                   {activeModule === 'profile' && <ProfileModule />}
                   {activeModule === 'system' && isAdmin && <SystemApisModule />}
                   {activeModule === 'roles' && isAdmin && <PermissionsModule />}
                   {activeModule === 'announcement' && isAdmin && <AnnouncementModule />}
                   {activeModule === 'users' && isAdmin && (
                       <div className="h-full overflow-y-auto">
                           <UsersModule />
                       </div>
                   )}
                </div>
            </div>
        );
    }

    return (
        <div className="pt-10 px-4 md:px-8 max-w-7xl mx-auto w-full pb-20">
            <div className="mb-12">
                <h1 className="text-3xl md:text-5xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Preferências</h1>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-2 max-w-2xl text-sm md:text-base">
                    Gerencie configurações da sua conta, parâmetros do sistema, usuários da plataforma e defina rigorosamente as regras e matrizes de permissão.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                
                {/* PROFILE CARD */}
                <motion.div 
                   whileHover={{ scale: 1.02 }}
                   whileTap={{ scale: 0.98 }}
                   onClick={() => setActiveModule('profile')}
                   className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm cursor-pointer hover:border-primary-500/50 hover:shadow-primary-500/10 transition-all flex flex-col justify-between group md:col-span-2 lg:col-span-2 aspect-video md:aspect-auto"
                >
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center">
                            <UserCircle size={28} />
                        </div>
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronLeft size={16} className="rotate-180" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase text-zinc-900 dark:text-white tracking-tight mb-2">Meu Perfil</h2>
                        <p className="text-xs text-zinc-500 font-medium">Atualize seus dados pessoais, senha e preferências de notificação do sistema.</p>
                    </div>
                </motion.div>

                {/* SYSTEM & API CARD */}
                {isAdmin && (
                    <motion.div 
                       whileHover={{ scale: 1.02 }}
                       whileTap={{ scale: 0.98 }}
                       onClick={() => setActiveModule('system')}
                       className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm cursor-pointer hover:border-primary-500/50 hover:shadow-primary-500/10 transition-all flex flex-col justify-between group md:col-span-1 lg:col-span-2"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl flex items-center justify-center">
                                <Sliders size={28} />
                            </div>
                            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronLeft size={16} className="rotate-180" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase text-zinc-900 dark:text-white tracking-tight mb-2">Sistema & APIs</h2>
                            <p className="text-xs text-zinc-500 font-medium">Proxy K-TAG, Gateways de Pagamento, Mapas, Regionais e Parâmetros.</p>
                        </div>
                    </motion.div>
                )}

                {isAdmin && (
                    <>
                        {/* ANNOUNCEMENT CARD */}
                        <motion.div 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveModule('announcement')}
                        className="bg-orange-500 rounded-[32px] p-8 shadow-sm cursor-pointer hover:bg-orange-600 transition-all flex flex-col justify-between group md:col-span-1 lg:col-span-2 text-white"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-14 h-14 bg-white/20 text-white rounded-2xl flex items-center justify-center">
                                    <Bell size={28} />
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronLeft size={16} className="rotate-180 text-white" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tight mb-2 text-white">Alertas do Sistema</h2>
                                <p className="text-xs text-white/80 font-medium">Crie anúncios globais que aparecem na tela dos usuários.</p>
                            </div>
                        </motion.div>

                        {/* ROLES & PERMISSIONS CARD */}
                        <motion.div 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveModule('roles')}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm cursor-pointer hover:border-emerald-500/50 hover:shadow-emerald-500/10 transition-all flex flex-col justify-between group md:col-span-2 lg:col-span-2"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center">
                                    <ShieldCheck size={28} />
                                </div>
                                <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronLeft size={16} className="rotate-180" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-xl font-black uppercase text-zinc-900 dark:text-white tracking-tight mb-2">Acessos & Permissões</h2>
                                <p className="text-xs text-zinc-500 font-medium">Crie cargos personalizados e defina as permissões da matriz RBAC.</p>
                            </div>
                        </motion.div>

                        {/* USERS CARD */}
                        <motion.div 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveModule('users')}
                        className="bg-primary-500 dark:bg-primary-600 rounded-[32px] p-8 shadow-sm cursor-pointer hover:bg-primary-600 dark:hover:bg-primary-700 transition-all flex flex-col justify-between group md:col-span-1 lg:col-span-2 text-white"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-14 h-14 bg-white/20 text-white rounded-2xl flex items-center justify-center">
                                    <Users size={28} />
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronLeft size={16} className="rotate-180 text-white" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tight mb-2 text-white">Usuários Administrativos</h2>
                                <p className="text-xs text-white/80 font-medium">Painel de listagem e gerenciamento de usuários de backoffice.</p>
                            </div>
                        </motion.div>
                    </>
                )}
            </div>
        </div>
    );
};
