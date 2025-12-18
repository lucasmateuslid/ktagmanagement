
import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid, Map, ShieldAlert, Tags, CarFront, FileText,
  Users, ClipboardList, Settings, Menu, LogOut, Sun, Moon,
  ChevronLeft, ChevronRight, Bell, Check, Trash2, X, Eye
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import AiAssistant from './AiAssistant';

const { Link, useLocation } = ReactRouterDOM as any;

const BRAND_CONFIGS: Record<string, any> = {
  default: { name: 'TAG', logo: 'K' },
  alorastreamento: { name: 'TAG', logo: 'A' }
};

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotification();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const brand = useMemo(() => BRAND_CONFIGS[user?.companySlug || 'default'] || BRAND_CONFIGS.default, [user]);

  // Filtragem de Menu Baseada em Permissões
  const menuSections = useMemo(() => {
    const role = user?.role || 'user';
    
    const sections = [
      { 
        title: t('dashboard'), 
        items: [
          { label: 'Dashboard', path: '/', icon: LayoutGrid }, 
          { label: 'Mapa ao Vivo', path: '/map', icon: Map }
        ] 
      },
      { 
        title: 'Operações', 
        items: [
          { label: 'Segurança', path: '/security', icon: ShieldAlert }, 
          { label: 'Veículos', path: '/vehicles', icon: CarFront },
          // Apenas Moderadores e Admins gerenciam Tags
          ...(role === 'admin' || role === 'moderator' ? [{ label: 'Tags / Estoque', path: '/tags', icon: Tags }] : [])
        ] 
      },
      { 
        title: 'Gestão', 
        items: [
          // Moderadores e Admins veem Relatórios e Audit Logs
          ...(role === 'admin' || role === 'moderator' ? [
            { label: 'Relatórios', path: '/reports', icon: FileText },
            { label: 'Audit Logs', path: '/audit', icon: ClipboardList }
          ] : []),
          // Apenas Admin gerencia usuários
          ...(role === 'admin' ? [{ label: 'Usuários', path: '/users', icon: Users }] : [])
        ] 
      },
      { 
        title: 'Sistema', 
        items: [{ label: 'Configurações', path: '/settings', icon: Settings }] 
      },
    ];

    return sections.filter(s => s.items.length > 0);
  }, [user, t]);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans antialiased">
      {/* Sidebar Desktop */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 260 }}
        className="hidden md:flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 relative z-50 shadow-xl"
      >
        {/* Minimalist Logo Area */}
        <div className="h-16 md:h-20 flex items-center px-5 border-b border-zinc-100 dark:border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black font-display font-black text-lg transition-colors">
              {brand.logo}
            </div>
            {!collapsed && (
              <span className="font-display font-bold text-lg text-zinc-900 dark:text-white tracking-tight">
                {brand.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 px-3 py-6 overflow-y-auto space-y-8 custom-scrollbar">
          {menuSections.map(section => (
            <div key={section.title}>
              {!collapsed && <h3 className="px-3 mb-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">{section.title}</h3>}
              <div className="space-y-1">
                {section.items.map(item => (
                  <Link key={item.path} to={item.path}>
                    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${location.pathname === item.path ? 'bg-primary-500/10 text-primary-500 font-bold' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'}`}>
                      <item.icon size={20} />
                      {!collapsed && <span className="text-sm truncate">{item.label}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button onClick={toggleTheme} className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-primary-500 transition-colors">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={logout} className="p-2.5 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
          <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all bg-zinc-50 dark:bg-zinc-900/50 mt-2">
            {collapsed ? <ChevronRight size={16} /> : <span className="text-[10px] font-black uppercase">Recolher Menu</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="h-16 md:h-20 flex items-center justify-between px-6 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-900 sticky top-0 z-[60]">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-600">
              <Menu size={20} />
            </button>
            <div className="hidden md:block">
               <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">Ambiente de Produção</h2>
               <p className="text-[10px] font-bold text-zinc-500 mt-0.5">Sincronizado com Hinova SGA v2</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             {/* Notification Bell */}
             <div className="relative" ref={notificationRef}>
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-3 rounded-2xl transition-all relative border outline-none ${unreadCount > 0 ? 'bg-primary-500 text-black border-primary-500' : 'bg-zinc-100 dark:bg-zinc-900 border-transparent text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                >
                  <Bell size={20} className={unreadCount > 0 ? 'animate-bounce' : ''} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white dark:border-zinc-950 shadow-lg">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotifications && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-[1000]"
                    >
                       <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/50">
                          <h3 className="font-display font-black uppercase tracking-tight text-sm">Notificações</h3>
                          <div className="flex gap-4">
                            {unreadCount > 0 && (
                                <button onClick={markAllAsRead} className="text-[10px] font-black text-primary-500 hover:underline uppercase">Lidas</button>
                            )}
                            <button onClick={clearAll} className="text-[10px] font-black text-zinc-400 hover:text-red-500 transition-colors uppercase">Limpar</button>
                          </div>
                       </div>
                       <div className="max-h-[400px] overflow-y-auto p-4 space-y-2 custom-scrollbar">
                          {notifications.length === 0 ? (
                            <div className="py-12 text-center">
                               <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                                  <Bell size={32} className="text-zinc-300 dark:text-zinc-600" />
                               </div>
                               <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Nenhum alerta novo</p>
                            </div>
                          ) : (
                            notifications.map(n => (
                              <div 
                                key={n.id} 
                                onClick={() => !n.read && markAsRead(n.id)}
                                className={`p-4 rounded-2xl border transition-all cursor-pointer ${n.read ? 'bg-zinc-50/50 dark:bg-zinc-950/30 border-transparent opacity-60' : 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 shadow-md ring-1 ring-primary-500/5'}`}
                              >
                                 <div className="flex justify-between items-start gap-3">
                                    <div className={`p-2 rounded-xl shrink-0 ${n.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : n.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                       {n.type === 'success' ? <Check size={14}/> : n.type === 'error' ? <ShieldAlert size={14}/> : <Eye size={14}/>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                       <h4 className={`font-black text-xs uppercase truncate ${n.read ? 'text-zinc-500' : 'text-zinc-900 dark:text-white'}`}>{n.title}</h4>
                                       <p className="text-[11px] text-zinc-500 mt-1 leading-tight">{n.message}</p>
                                       <p className="text-[9px] text-zinc-400 font-mono mt-2 flex items-center gap-2">
                                          <div className={`w-1 h-1 rounded-full ${n.read ? 'bg-zinc-400' : 'bg-primary-500 animate-pulse'}`} />
                                          {new Date(n.timestamp).toLocaleTimeString()}
                                       </p>
                                    </div>
                                    {!n.read && (
                                      <button onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg text-zinc-300">
                                        <Check size={14} />
                                      </button>
                                    )}
                                 </div>
                              </div>
                            ))
                          )}
                       </div>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>

             <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800 mx-2 hidden sm:block" />
             <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                   <p className="text-xs font-black text-zinc-900 dark:text-white uppercase truncate max-w-[120px]">{user?.name}</p>
                   <p className="text-[9px] font-bold text-primary-500 uppercase tracking-widest">{user?.role}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 font-black border border-zinc-700/30">
                  {user?.name.charAt(0)}
                </div>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scroll-smooth p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
        
        <AiAssistant />
      </main>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setSidebarOpen(false)} />
            <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="fixed inset-y-0 left-0 z-[110] w-72 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col p-6">
               <div className="flex justify-between items-center mb-10">
                 {/* Mobile Logo Minimalist */}
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black font-display font-black text-lg">
                      {brand.logo}
                    </div>
                    <span className="font-display font-bold text-lg text-zinc-900 dark:text-white tracking-tight">
                      {brand.name}
                    </span>
                 </div>
                 <button onClick={() => setSidebarOpen(false)}><X /></button>
               </div>
               <div className="flex-1 space-y-8 overflow-y-auto">
                  {menuSections.map(s => (
                    <div key={s.title}>
                       <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">{s.title}</h3>
                       <div className="space-y-1">
                          {s.items.map(i => (
                            <Link key={i.path} to={i.path} onClick={() => setSidebarOpen(false)}>
                               <div className={`flex items-center gap-3 p-3 rounded-xl ${location.pathname === i.path ? 'bg-primary-500 text-black font-bold' : 'text-zinc-500'}`}>
                                  <i.icon size={18}/> {i.label}
                               </div>
                            </Link>
                          ))}
                       </div>
                    </div>
                  ))}
               </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
