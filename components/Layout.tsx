
import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid, Map, ShieldAlert, Tags, CarFront, FileText,
  Users, ClipboardList, Settings, Menu, LogOut, Sun, Moon,
  ChevronLeft, ChevronRight, Bell, Check, Trash2, X, Eye, UserCircle,
  AlertCircle, CheckCircle2, Info
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

export const Layout = ({ children }: { children?: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotification();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setSidebarOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  // Click outside para fechar notificações
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const brand = useMemo(() => BRAND_CONFIGS[user?.companySlug || 'default'] || BRAND_CONFIGS.default, [user]);

  const menuSections = useMemo(() => {
    const role = user?.role || 'user';
    
    if (role === 'client') {
      return [
        { 
          title: 'Meu Painel', 
          items: [
            { label: 'Visão Geral', path: '/', icon: LayoutGrid }, 
            { label: 'Meu Veículo', path: '/map', icon: Map }
          ] 
        },
        { 
          title: 'Configurações', 
          items: [{ label: 'Meus Dados', path: '/settings', icon: UserCircle }] 
        }
      ];
    }

    return [
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
          { label: 'Clientes', path: '/clients', icon: Users },
          ...(role === 'admin' || role === 'moderator' ? [{ label: 'Tags / Estoque', path: '/tags', icon: Tags }] : [])
        ] 
      },
      { 
        title: 'Gestão', 
        items: [
          ...(role === 'admin' || role === 'moderator' ? [
            { label: 'Relatórios', path: '/reports', icon: FileText },
            { label: 'Audit Logs', path: '/audit', icon: ClipboardList }
          ] : []),
          ...(role === 'admin' ? [{ label: 'Acessos Adm', path: '/users', icon: UserCircle }] : [])
        ] 
      },
      { 
        title: 'Sistema', 
        items: [{ label: 'Configurações', path: '/settings', icon: Settings }] 
      },
    ];
  }, [user, t]);

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
      <div className={`h-20 flex items-center border-b border-zinc-100 dark:border-zinc-800/50 ${!isMobile && collapsed ? 'justify-center' : 'px-6'} justify-between`}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black font-display font-black text-xl shrink-0 shadow-lg">
            {brand.logo}
          </div>
          {(isMobile || !collapsed) && (
            <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="font-display font-black text-xl text-zinc-900 dark:text-white tracking-tighter">
              {brand.name}
            </motion.span>
          )}
        </div>
        {isMobile && (
          <button onClick={() => setSidebarOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex-1 px-3 py-8 overflow-y-auto space-y-10 custom-scrollbar">
        {menuSections.map(section => (
          <div key={section.title} className="space-y-2">
            {(isMobile || !collapsed) && <h3 className="px-4 mb-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em] opacity-60">{section.title}</h3>}
            <div className="space-y-1">
              {section.items.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path}>
                    <div className={`flex items-center group relative py-3 rounded-2xl transition-all duration-200 ${!isMobile && collapsed ? 'justify-center px-0' : 'px-4 gap-4'} ${isActive ? 'bg-primary-500/10 text-primary-500' : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                      <div className={`flex items-center justify-center shrink-0 ${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform duration-200`}>
                        <item.icon size={isActive ? 22 : 20} strokeWidth={isActive ? 2.5 : 2} />
                      </div>
                      {(isMobile || !collapsed) && <span className={`text-sm font-bold truncate tracking-tight ${isActive ? 'text-zinc-900 dark:text-white' : ''}`}>{item.label}</span>}
                      {isActive && !isMobile && !collapsed && <motion.div layoutId="active-pill" className="absolute left-0 w-1 h-6 bg-primary-500 rounded-r-full" />}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/20">
        <div className="flex items-center gap-2 justify-between">
           <button onClick={logout} className={`flex items-center gap-3 p-3 rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all w-full ${!isMobile && collapsed ? 'justify-center' : ''}`}>
              <LogOut size={18} />
              {(isMobile || !collapsed) && <span className="text-xs font-black uppercase tracking-widest">Sair</span>}
           </button>
        </div>
        {!isMobile && (
          <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center justify-center p-3 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all mt-4 border border-dashed border-zinc-200">
            {collapsed ? <ChevronRight size={16} /> : <div className="flex items-center gap-2"><ChevronLeft size={16} /><span className="text-[10px] font-black uppercase tracking-widest">Recolher</span></div>}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans antialiased">
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-white dark:bg-zinc-900 z-[101] md:hidden shadow-2xl"
            >
              <SidebarContent isMobile={true} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 84 : 280 }}
        className="hidden md:flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 relative z-50 shadow-xl overflow-hidden"
      >
        <SidebarContent />
      </motion.aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-20 flex items-center justify-between px-6 md:px-8 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-900 sticky top-0 z-[60]">
          <div className="flex items-center gap-4 md:gap-6">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400">
              <Menu size={22} />
            </button>
            <div className="hidden sm:block">
               <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Portal de Operações</h2>
               <div className="flex items-center gap-2 mt-1">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <p className="text-[11px] font-bold text-zinc-500 uppercase">{user?.role === 'client' ? 'Acesso do Cliente' : 'Console Profissional'}</p>
               </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
             {/* NOTIFICATION BELL */}
             <div className="relative" ref={notificationRef}>
                <button 
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className={`p-3 rounded-2xl transition-all border ${notificationsOpen ? 'bg-primary-500 text-black border-primary-500' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'}`}
                >
                  <Bell size={20} className={unreadCount > 0 ? 'animate-bounce' : ''} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950 animate-in zoom-in duration-200">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {notificationsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="fixed inset-x-4 top-24 md:absolute md:inset-auto md:right-0 md:top-full md:mt-3 w-auto md:w-[400px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[100] overflow-hidden"
                    >
                      <div className="p-6 border-b border-zinc-50 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                           <Bell size={18} className="text-primary-500" />
                           <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-900 dark:text-white">Central de Alertas</h3>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={markAllAsRead} className="p-2 text-zinc-400 hover:text-primary-500 transition-colors" title="Lidas"><Check size={16}/></button>
                           <button onClick={clearAll} className="p-2 text-zinc-400 hover:text-red-500 transition-colors" title="Limpar tudo"><Trash2 size={16}/></button>
                        </div>
                      </div>

                      <div className="max-h-[450px] overflow-y-auto custom-scrollbar p-2">
                        {notifications.length === 0 ? (
                          <div className="py-12 text-center flex flex-col items-center gap-3 opacity-30">
                            <Bell size={48} strokeWidth={1} />
                            <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma notificação</p>
                          </div>
                        ) : (
                          notifications.map((note) => (
                            <div 
                              key={note.id} 
                              onClick={() => markAsRead(note.id)}
                              className={`p-4 mb-1 rounded-[24px] cursor-pointer transition-all border ${note.read ? 'bg-transparent border-transparent opacity-60' : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-700 shadow-sm'}`}
                            >
                              <div className="flex gap-4">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                                  note.type === 'error' ? 'bg-red-500/10 text-red-500' : 
                                  note.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 
                                  'bg-primary-500/10 text-primary-500'
                                }`}>
                                  {note.type === 'error' ? <AlertCircle size={20}/> : note.type === 'success' ? <CheckCircle2 size={20}/> : <Info size={20}/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-black text-[11px] uppercase text-zinc-900 dark:text-white truncate pr-2">{note.title}</h4>
                                    <span className="text-[8px] font-mono text-zinc-400 whitespace-nowrap">{new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">{note.message}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {notifications.length > 0 && (
                        <div className="p-4 border-t border-zinc-50 dark:border-zinc-800 text-center bg-zinc-50/20">
                           <button className="text-[9px] font-black uppercase text-zinc-400 hover:text-primary-500 transition-colors tracking-widest">Ver Histórico Completo</button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>

             <button 
                onClick={toggleTheme} 
                className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-primary-500 transition-all border border-zinc-200 dark:border-zinc-800"
                title="Alternar Tema"
             >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
             </button>

             <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 md:mx-2" />

             <div className="flex items-center gap-3">
                <div className="hidden lg:block text-right">
                    <p className="text-sm font-black text-zinc-900 dark:text-white uppercase truncate max-w-[160px] tracking-tight">{user?.name}</p>
                    <p className="text-[10px] font-bold text-primary-500 uppercase tracking-widest mt-0.5">{user?.role}</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 font-black border border-zinc-700/30 shadow-lg">
                {user?.name.charAt(0)}
                </div>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scroll-smooth p-4 md:p-10 custom-scrollbar">
          <div className="max-w-[1600px] mx-auto">{children}</div>
        </div>
        {user?.role !== 'client' && <AiAssistant />}
      </main>
    </div>
  );
};
