
import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  LayoutGrid, Map, ShieldAlert, Tags, CarFront, FileText,
  Users, ClipboardList, Settings, Menu, LogOut, Sun, Moon,
  ChevronLeft, ChevronRight, Bell, Trash2, X, UserCircle,
  AlertCircle, CheckCircle2, Info, UserCircle2
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import AiAssistant from './AiAssistant';

const { Link, useLocation } = ReactRouterDOM as any;

const BRAND_CONFIGS: Record<string, any> = {
  default: { name: 'K-TAG', logo: 'K' },
  alorastreamento: { name: 'ALO', logo: 'A' }
};

const SidebarContent = ({ 
  isMobile = false, 
  collapsed, 
  brand, 
  menuSections, 
  pathname, 
  theme, 
  setSidebarOpen, 
  setCollapsed,
  logout 
}: any) => (
  <div className="flex flex-col h-full bg-white dark:bg-zinc-900 transition-colors duration-300 select-none">
    {/* LOGO AREA */}
    <div className={`h-24 flex items-center border-b border-zinc-100 dark:border-zinc-800/50 ${(!isMobile && collapsed) ? 'justify-center' : 'px-6'} shrink-0 relative overflow-hidden`}>
      <div className={`flex items-center gap-4 ${(!isMobile && collapsed) ? 'w-full justify-center' : ''}`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-display font-black text-2xl shrink-0 shadow-lg transition-all duration-500 transform hover:rotate-3 ${theme === 'dark' ? 'bg-white text-zinc-950 shadow-white/5' : 'bg-zinc-950 text-white shadow-black/10'}`}>
          {brand.logo}
        </div>
        {(isMobile || !collapsed) && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
            className="flex flex-col leading-tight"
          >
            <span className="font-display font-black text-xl text-zinc-900 dark:text-white tracking-tighter uppercase">{brand.name}</span>
            <span className="text-[9px] font-black text-primary-500 uppercase tracking-[0.3em]">Gestão de Frota</span>
          </motion.div>
        )}
      </div>
      {isMobile && (
        <button onClick={() => setSidebarOpen(false)} className="absolute right-4 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors">
          <X size={20} />
        </button>
      )}
    </div>

    {/* NAVIGATION LINKS */}
    <nav className="flex-1 px-3 py-8 overflow-y-auto space-y-10 custom-scrollbar overflow-x-hidden">
      <LayoutGroup id="sidebar-nav">
        {menuSections.map((section: any) => (
          <div key={section.title} className="space-y-2">
            {(isMobile || !collapsed) && (
              <motion.h3 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 mb-4 text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.4em]">
                {section.title}
              </motion.h3>
            )}
            <div className="space-y-1">
              {section.items.map((item: any) => {
                const isActive = pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} className="relative block">
                    <div className={`flex items-center relative h-12 rounded-2xl transition-all duration-300 group ${!isMobile && collapsed ? 'justify-center px-0' : 'px-4 gap-4'} ${isActive ? 'text-primary-600 dark:text-primary-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-white/5'}`}>
                      {isActive && <motion.div layoutId="sidebar-active-pill" className="absolute inset-0 bg-primary-500/10 dark:bg-primary-500/5 rounded-2xl z-0" transition={{ type: 'spring', stiffness: 400, damping: 35 }} />}
                      <div className={`relative z-10 flex items-center justify-center w-6 shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                        <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                      </div>
                      {(isMobile || !collapsed) && <motion.span initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className={`relative z-10 text-[13px] font-bold truncate tracking-tight uppercase ${isActive ? 'font-black' : ''}`}>{item.label}</motion.span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </LayoutGroup>
    </nav>

    {/* SIDEBAR FOOTER */}
    <div className="p-4 border-t border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-950/20 shrink-0 space-y-2">
      <Link to="/settings" className="block">
        <div className={`flex items-center h-12 rounded-2xl transition-all duration-300 group ${pathname === '/settings' ? 'bg-primary-500/10 text-primary-500' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5'} ${!isMobile && collapsed ? 'justify-center px-0' : 'px-4 gap-4'}`}>
           <div className="w-6 flex items-center justify-center group-hover:rotate-45 transition-transform duration-500"><Settings size={20} /></div>
           {(isMobile || !collapsed) && <span className="text-[13px] font-black uppercase tracking-tight">Preferências</span>}
        </div>
      </Link>
      <button onClick={logout} className={`flex items-center h-12 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all w-full group ${!isMobile && collapsed ? 'justify-center px-0' : 'px-4 gap-4'}`}>
        <div className="w-6 flex items-center justify-center group-hover:translate-x-1 transition-transform"><LogOut size={20} /></div>
        {(isMobile || !collapsed) && <span className="text-[13px] font-black uppercase tracking-tight">Desconectar</span>}
      </button>

      {!isMobile && (
        <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center justify-center h-10 mt-4 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-dashed border-zinc-200 dark:border-zinc-800">
          {collapsed ? <ChevronRight size={18} /> : <div className="flex items-center gap-2"><ChevronLeft size={18} /><span className="text-[9px] font-black uppercase">Recolher</span></div>}
        </button>
      )}
    </div>
  </div>
);

export const Layout = ({ children }: { children?: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAsRead, clearAll } = useNotification();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem('sidebar_collapsed', String(collapsed)); }, [collapsed]);
  useEffect(() => { setSidebarOpen(false); setNotificationsOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) setNotificationsOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const brand = useMemo(() => BRAND_CONFIGS[user?.companySlug || 'default'] || BRAND_CONFIGS.default, [user]);

  const menuSections = useMemo(() => {
    const role = user?.role || 'user';
    if (role === 'client') {
      return [
        { title: 'MEU PAINEL', items: [{ label: 'MEU VEÍCULO', path: '/map', icon: Map }] }
      ];
    }
    return [
      { title: 'MONITORAMENTO', items: [
        { label: 'DASHBOARD', path: '/', icon: LayoutGrid }, 
        { label: 'MAPA AO VIVO', path: '/map', icon: Map }
      ]},
      { title: 'OPERAÇÕES', items: [
        { label: 'SEGURANÇA', path: '/security', icon: ShieldAlert }, 
        { label: 'VEÍCULOS', path: '/vehicles', icon: CarFront },
        { label: 'CLIENTES', path: '/clients', icon: Users },
        ...(role === 'admin' || role === 'moderator' ? [{ label: 'ESTOQUE TAGS', path: '/tags', icon: Tags }] : [])
      ]},
      { title: 'GESTÃO', items: [
        ...(role === 'admin' || role === 'moderator' ? [
          { label: 'RELATÓRIOS', path: '/reports', icon: FileText },
          { label: 'AUDITORIA', path: '/audit', icon: ClipboardList }
        ] : []),
        ...(role === 'admin' ? [{ label: 'USUÁRIOS ADM', path: '/users', icon: UserCircle }] : [])
      ]}
    ];
  }, [user]);

  const isMapPage = location.pathname === '/map';

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans antialiased">
      {/* MOBILE SIDEBAR */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] md:hidden" />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 30, stiffness: 250 }} className="fixed inset-y-0 left-0 w-[280px] bg-white dark:bg-zinc-900 z-[2001] md:hidden shadow-2xl">
              <SidebarContent isMobile collapsed={false} brand={brand} menuSections={menuSections} pathname={location.pathname} theme={theme} setSidebarOpen={setSidebarOpen} logout={logout} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* DESKTOP SIDEBAR */}
      <motion.aside 
        initial={false}
        animate={{ width: collapsed ? 88 : 280 }}
        transition={{ type: 'spring', stiffness: 300, damping: 35 }}
        className="hidden md:flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 relative z-50 shadow-xl overflow-hidden"
      >
        <SidebarContent collapsed={collapsed} brand={brand} menuSections={menuSections} pathname={location.pathname} theme={theme} setCollapsed={setCollapsed} logout={logout} />
      </motion.aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-900 sticky top-0 z-[1000]">
          <div className="h-full w-full max-w-[1600px] mx-auto flex items-center justify-between px-6 md:px-8 lg:px-10">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400"><Menu size={22} /></button>
              <div className="hidden sm:block">
                 <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Portal de Rastreio</h2>
                 <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[11px] font-bold text-zinc-500 uppercase leading-none">{user?.role === 'client' ? 'Painel de Associado' : 'Console de Operações'}</p>
                 </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 md:gap-5">
               {/* NOTIFICATIONS (Sino no Canto Superior Direito) */}
               <div className="relative" ref={notificationRef}>
                  <button onClick={() => setNotificationsOpen(!notificationsOpen)} className={`p-3 rounded-2xl transition-all border ${notificationsOpen ? 'bg-primary-500 text-black border-primary-500 shadow-xl scale-105' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-primary-500/50'}`}>
                    <Bell size={20} className={unreadCount > 0 ? 'animate-bounce' : ''} />
                    {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950">{unreadCount}</span>}
                  </button>
                  <AnimatePresence>
                    {notificationsOpen && (
                      <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="fixed inset-x-4 top-24 md:absolute md:inset-auto md:right-0 md:top-full md:mt-4 w-auto md:w-[380px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-2xl z-[1100] overflow-hidden">
                        <div className="p-6 border-b bg-zinc-50/50 dark:bg-zinc-950/50 flex justify-between items-center">
                          <div>
                             <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-900 dark:text-white">Central de Alertas</h3>
                             <p className="text-[9px] font-bold text-zinc-400 uppercase mt-0.5">Notificações de Sistema</p>
                          </div>
                          <button onClick={clearAll} className="p-2 text-zinc-400 hover:text-red-500 transition-colors bg-zinc-100 dark:bg-zinc-800 rounded-xl" title="Limpar Tudo"><Trash2 size={16}/></button>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-3 space-y-1">
                          {notifications.length === 0 ? (
                             <div className="py-20 text-center flex flex-col items-center gap-4 opacity-20">
                                <Bell size={48} />
                                <span className="text-[10px] font-black uppercase italic tracking-widest">Nenhum alerta pendente</span>
                             </div>
                          ) : 
                            notifications.map((note) => (
                              <div key={note.id} onClick={() => markAsRead(note.id)} className={`p-5 rounded-2xl cursor-pointer transition-all border ${note.read ? 'bg-transparent opacity-60 border-transparent' : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-700 shadow-sm'}`}>
                                  <div className="flex justify-between items-start gap-3">
                                     <h4 className="font-black text-[11px] uppercase truncate tracking-tight text-zinc-900 dark:text-white">{note.title}</h4>
                                     {!note.read && <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0 mt-1" />}
                                  </div>
                                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1.5 leading-snug font-medium">{note.message}</p>
                              </div>
                            ))
                          }
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
               </div>

               {/* THEME TOGGLE */}
               <button onClick={toggleTheme} className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-800 hover:text-primary-500 transition-all">{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
               
               <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

               {/* USER IDENTITY */}
               <div className="flex items-center gap-4">
                  <div className="hidden lg:flex flex-col items-end text-right">
                      <p className="text-sm font-black text-zinc-900 dark:text-white uppercase truncate max-w-[160px] leading-none tracking-tight">{user?.name}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                         <span className="text-[9px] font-black text-primary-500 uppercase tracking-widest bg-primary-500/10 px-2 py-0.5 rounded-lg border border-primary-500/20">{user?.role}</span>
                      </div>
                  </div>
                  <div className="w-12 h-12 rounded-[18px] bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-zinc-100 font-black border border-zinc-700/30 shadow-2xl shrink-0 text-lg">
                    {user?.avatarInitial || user?.name.charAt(0).toUpperCase()}
                  </div>
               </div>
            </div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className={`flex-1 overflow-y-auto custom-scrollbar relative ${isMapPage ? 'p-0' : 'p-4 md:p-8 lg:p-10'}`}>
          <div className="h-full w-full max-w-[1600px] mx-auto">
            {children}
          </div>
        </div>
        
        {user?.role !== 'client' && <AiAssistant />}
      </main>
    </div>
  );
};
