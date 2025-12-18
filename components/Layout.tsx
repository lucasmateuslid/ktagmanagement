
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

export const Layout = ({ children }: { children?: React.ReactNode }) => {
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
          ...(role === 'admin' ? [{ label: 'Usuários', path: '/users', icon: Users }] : [])
        ] 
      },
      { 
        title: 'Sistema', 
        items: [{ label: 'Configurações', path: '/settings', icon: Settings }] 
      },
    ];

    return sections.filter(s => s.items.length > 0);
  }, [user, t, location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans antialiased">
      {/* Sidebar Desktop */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 84 : 280 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden md:flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 relative z-50 shadow-xl"
      >
        {/* Logo Area Refatorada */}
        <div className={`h-20 flex items-center border-b border-zinc-100 dark:border-zinc-800/50 ${collapsed ? 'justify-center' : 'px-6'}`}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black font-display font-black text-xl shrink-0 shadow-lg">
              {brand.logo}
            </div>
            {!collapsed && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="font-display font-black text-xl text-zinc-900 dark:text-white tracking-tighter"
              >
                {brand.name}
              </motion.span>
            )}
          </div>
        </div>

        {/* Menu Items Refatorados */}
        <div className="flex-1 px-3 py-8 overflow-y-auto space-y-10 custom-scrollbar">
          {menuSections.map(section => (
            <div key={section.title} className="space-y-2">
              {!collapsed && (
                <h3 className="px-4 mb-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em] opacity-60">
                  {section.title}
                </h3>
              )}
              <div className="space-y-1">
                {section.items.map(item => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link key={item.path} to={item.path}>
                      <div className={`
                        flex items-center group relative py-3 rounded-2xl transition-all duration-200
                        ${collapsed ? 'justify-center px-0' : 'px-4 gap-4'}
                        ${isActive 
                          ? 'bg-primary-500/10 text-primary-500 shadow-sm' 
                          : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white'}
                      `}>
                        {/* Icon Wrapper para garantir centralização perfeita */}
                        <div className={`flex items-center justify-center shrink-0 ${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform duration-200`}>
                          <item.icon size={isActive ? 22 : 20} strokeWidth={isActive ? 2.5 : 2} />
                        </div>
                        
                        {!collapsed && (
                          <motion.span 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`text-sm font-bold truncate tracking-tight ${isActive ? 'text-zinc-900 dark:text-white' : ''}`}
                          >
                            {item.label}
                          </motion.span>
                        )}

                        {/* Indicador Ativo Lateral */}
                        {isActive && !collapsed && (
                          <motion.div 
                            layoutId="active-pill"
                            className="absolute left-0 w-1 h-6 bg-primary-500 rounded-r-full"
                          />
                        )}
                        
                        {/* Tooltip Fake no modo colapsado */}
                        {collapsed && (
                          <div className="absolute left-full ml-4 px-3 py-1 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[100] whitespace-nowrap shadow-xl">
                            {item.label}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Sidebar Refatorado */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/20">
          <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : 'justify-between'}`}>
            <button 
              onClick={toggleTheme} 
              className={`p-3 rounded-2xl bg-white dark:bg-zinc-800 text-zinc-500 hover:text-primary-500 transition-all border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md ${collapsed ? 'w-full flex justify-center' : ''}`}
              title="Alternar Tema"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
              onClick={logout} 
              className={`p-3 rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all border border-transparent hover:shadow-lg hover:shadow-red-500/20 ${collapsed ? 'w-full flex justify-center' : ''}`}
              title="Sair do Sistema"
            >
              <LogOut size={18} />
            </button>
          </div>
          
          <button 
            onClick={() => setCollapsed(!collapsed)} 
            className="w-full flex items-center justify-center p-3 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all mt-4 border border-dashed border-zinc-200 dark:border-zinc-700"
          >
            {collapsed ? <ChevronRight size={16} /> : (
              <div className="flex items-center gap-2">
                <ChevronLeft size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Recolher Menu</span>
              </div>
            )}
          </button>
        </div>
      </motion.aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-8 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-900 sticky top-0 z-[60]">
          <div className="flex items-center gap-6">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-600 border border-zinc-200 dark:border-zinc-800">
              <Menu size={22} />
            </button>
            <div className="hidden md:block">
               <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Ambiente de Operação</h2>
               <div className="flex items-center gap-2 mt-1">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-tight">Node: LATAM-01 • Hinova v2 Connected</p>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-5">
             {/* Notification Bell */}
             <div className="relative" ref={notificationRef}>
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-3.5 rounded-2xl transition-all relative border outline-none ${unreadCount > 0 ? 'bg-primary-500 text-black border-primary-500' : 'bg-zinc-100 dark:bg-zinc-900 border-transparent text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                >
                  <Bell size={20} className={unreadCount > 0 ? 'animate-bounce' : ''} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white dark:border-zinc-950 shadow-lg">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotifications && (
                    <motion.div 
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 15, scale: 0.95 }}
                      className="absolute right-0 mt-4 w-96 bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-[1000]"
                    >
                       <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/50">
                          <h3 className="font-display font-black uppercase tracking-tight text-sm">Central de Alertas</h3>
                          <div className="flex gap-4">
                            {unreadCount > 0 && (
                                <button onClick={markAllAsRead} className="text-[10px] font-black text-primary-500 hover:underline uppercase tracking-widest">Lidas</button>
                            )}
                            <button onClick={clearAll} className="text-[10px] font-black text-zinc-400 hover:text-red-500 transition-colors uppercase tracking-widest">Limpar</button>
                          </div>
                       </div>
                       <div className="max-h-[480px] overflow-y-auto p-4 space-y-2 custom-scrollbar">
                          {notifications.length === 0 ? (
                            <div className="py-20 text-center">
                               <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 opacity-50 border-4 border-white dark:border-zinc-900">
                                  <Bell size={32} className="text-zinc-300 dark:text-zinc-600" />
                               </div>
                               <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">Sua caixa está limpa</p>
                            </div>
                          ) : (
                            notifications.map(n => (
                              <div 
                                key={n.id} 
                                onClick={() => !n.read && markAsRead(n.id)}
                                className={`p-5 rounded-3xl border transition-all cursor-pointer ${n.read ? 'bg-zinc-50/50 dark:bg-zinc-950/30 border-transparent opacity-60' : 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 shadow-md ring-1 ring-primary-500/5'}`}
                              >
                                 <div className="flex justify-between items-start gap-4">
                                    <div className={`p-3 rounded-2xl shrink-0 ${n.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : n.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                       {n.type === 'success' ? <Check size={16}/> : n.type === 'error' ? <ShieldAlert size={16}/> : <Eye size={16}/>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                       <h4 className={`font-black text-xs uppercase truncate tracking-tight ${n.read ? 'text-zinc-500' : 'text-zinc-900 dark:text-white'}`}>{n.title}</h4>
                                       <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed font-medium">{n.message}</p>
                                       <div className="flex items-center gap-3 mt-4">
                                          <p className="text-[9px] text-zinc-400 font-mono flex items-center gap-2">
                                             <div className={`w-1.5 h-1.5 rounded-full ${n.read ? 'bg-zinc-400' : 'bg-primary-500 animate-pulse'}`} />
                                             {new Date(n.timestamp).toLocaleTimeString()}
                                          </p>
                                          {!n.read && <span className="text-[9px] font-black text-primary-500 uppercase tracking-widest bg-primary-500/10 px-2 py-0.5 rounded-md">Novo</span>}
                                       </div>
                                    </div>
                                 </div>
                              </div>
                            ))
                          )}
                       </div>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>

             <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-800 mx-2 hidden sm:block" />
             <div className="flex items-center gap-4">
                <div className="hidden lg:block text-right">
                   <p className="text-sm font-black text-zinc-900 dark:text-white uppercase truncate max-w-[160px] tracking-tight">{user?.name}</p>
                   <p className="text-[10px] font-bold text-primary-500 uppercase tracking-widest mt-0.5">{user?.role}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 font-black border border-zinc-700/30 shadow-lg relative overflow-hidden group">
                  <span className="relative z-10 group-hover:scale-110 transition-transform">{user?.name.charAt(0)}</span>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scroll-smooth p-6 md:p-10 custom-scrollbar">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </div>
        
        <AiAssistant />
      </main>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]" onClick={() => setSidebarOpen(false)} />
            <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="fixed inset-y-0 left-0 z-[110] w-80 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col p-8">
               <div className="flex justify-between items-center mb-12">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black font-display font-black text-xl">
                      {brand.logo}
                    </div>
                    <span className="font-display font-black text-xl text-zinc-900 dark:text-white tracking-tighter">
                      {brand.name}
                    </span>
                 </div>
                 <button onClick={() => setSidebarOpen(false)} className="p-2 text-zinc-500"><X /></button>
               </div>
               <div className="flex-1 space-y-10 overflow-y-auto custom-scrollbar">
                  {menuSections.map(s => (
                    <div key={s.title}>
                       <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em] mb-6 opacity-60">{s.title}</h3>
                       <div className="space-y-1">
                          {s.items.map(i => {
                            const active = location.pathname === i.path;
                            return (
                              <Link key={i.path} to={i.path} onClick={() => setSidebarOpen(false)}>
                                 <div className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${active ? 'bg-primary-500 text-black font-bold shadow-lg shadow-primary-500/20' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                                    <i.icon size={20} strokeWidth={active ? 2.5 : 2} /> 
                                    <span className="text-sm font-bold">{i.label}</span>
                                 </div>
                              </Link>
                            );
                          })}
                       </div>
                    </div>
                  ))}
               </div>
               <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                  <button onClick={logout} className="w-full flex items-center gap-4 p-4 text-red-500 font-bold hover:bg-red-50 rounded-2xl transition-all">
                    <LogOut size={20} /> Encerrar Sessão
                  </button>
               </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
