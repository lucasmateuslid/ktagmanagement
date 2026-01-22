
import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';
import { AiAssistant } from './AiAssistant';
import {
  LayoutGrid, Map, ShieldAlert, Tags, CarFront, FileText,
  Users, ClipboardList, Settings, Menu, LogOut, Sun, Moon,
  Bell, CheckCircle2, UserCircle, Calendar, Wrench, Plus,
  ChevronLeft, ChevronRight
} from 'lucide-react';

export const Layout = ({ children }: { children?: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notifications, markAsRead, clearAll } = useNotification();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Verifica se é a página do mapa para remover padding
  const isMapPage = location.pathname === '/map';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getMenuSections = () => {
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
        ...(role === 'admin' || role === 'moderator' ? [
           { label: 'CLIENTES', path: '/clients', icon: Users },
           { label: 'ESTOQUE TAGS', path: '/tags', icon: Tags },
        ] : [])
      ]},
      { title: 'AGENDAMENTOS', items: [
        { label: 'NOVA SOLICITAÇÃO', path: '/schedule/new', icon: Plus },
        { label: role === 'user' ? 'MINHAS SOLICITAÇÕES' : 'CENTRAL DE AGENDA', path: '/schedules', icon: Calendar },
        { label: 'CALENDÁRIO', path: '/calendar', icon: Calendar },
        ...(role === 'admin' ? [{ label: 'TÉCNICOS', path: '/technicians', icon: Wrench }] : [])
      ]},
      ...(role === 'admin' || role === 'moderator' ? [
        { title: 'GESTÃO', items: [
          { label: 'RELATÓRIOS', path: '/reports', icon: FileText },
          { label: 'AUDITORIA', path: '/audit', icon: ClipboardList },
          ...(role === 'admin' ? [{ label: 'USUÁRIOS ADM', path: '/users', icon: UserCircle }] : []),
        ]}
      ] : [])
    ];
  };

  const menuSections = getMenuSections();

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans transition-colors duration-300">
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2999] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-[3000] bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transform transition-all duration-300 lg:transform-none flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isCollapsed ? 'w-24' : 'w-72'}
      `}>
        <div className={`h-24 flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-8'} border-b border-zinc-100 dark:border-zinc-800 transition-all`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-black dark:bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-xl">
              <span className="font-display font-black text-white dark:text-black text-xl">K</span>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-display font-black text-xl leading-none text-zinc-900 dark:text-white tracking-tight">K-TAG</span>
                <span className="text-[10px] font-black text-primary-500 uppercase tracking-[0.2em]">Gestão de Frota</span>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-8 space-y-8 custom-scrollbar">
           {menuSections.map((section, idx) => (
             <div key={idx} className="px-4">
               {!isCollapsed && (
                 <h3 className="px-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-3">{section.title}</h3>
               )}
               <div className="space-y-1">
                 {section.items.map((item) => {
                   const isActive = location.pathname === item.path;
                   return (
                     <Link 
                       key={item.path} 
                       to={item.path}
                       onClick={() => setIsSidebarOpen(false)}
                       className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all group relative ${
                         isActive 
                           ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-500' 
                           : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                       } ${isCollapsed ? 'justify-center' : ''}`}
                       title={isCollapsed ? item.label : ''}
                     >
                       <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                       {!isCollapsed && (
                         <span className="text-[11px] font-black uppercase tracking-widest">{item.label}</span>
                       )}
                       {isActive && !isCollapsed && (
                         <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-primary-500" />
                       )}
                     </Link>
                   )
                 })}
               </div>
             </div>
           ))}
        </nav>

        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
           <Link to="/settings" className={`flex items-center gap-4 px-4 py-3.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all ${isCollapsed ? 'justify-center' : ''}`}>
              <Settings size={20} />
              {!isCollapsed && <span className="text-[11px] font-black uppercase tracking-widest">Preferências</span>}
           </Link>
           
           <button onClick={handleLogout} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all ${isCollapsed ? 'justify-center' : ''}`}>
              <LogOut size={20} />
              {!isCollapsed && <span className="text-[11px] font-black uppercase tracking-widest">Desconectar</span>}
           </button>

           <button 
             onClick={() => setIsCollapsed(!isCollapsed)} 
             className="w-full mt-2 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-primary-500 transition-colors"
           >
             {isCollapsed ? <ChevronRight size={16} /> : <div className="flex items-center gap-2"><ChevronLeft size={14} /><span className="text-[9px] font-black uppercase">Recolher</span></div>}
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative bg-zinc-50 dark:bg-black">
        <header className="h-24 shrink-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 lg:px-10 z-30">
           <div className="flex items-center gap-4">
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="lg:hidden p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
             >
               <Menu size={24} />
             </button>
             
             <div className="hidden md:flex flex-col border-l-2 border-zinc-100 dark:border-zinc-800 pl-6 h-10 justify-center">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Portal de Rastreio</span>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                   <span className="text-xs font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-wide">Console de Operações</span>
                </div>
             </div>
           </div>

           <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-primary-500 transition-all relative border border-zinc-100 dark:border-zinc-700"
              >
                <Bell size={20} />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-zinc-800" />
                )}
              </button>

              <button 
                onClick={toggleTheme}
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-primary-500 transition-all border border-zinc-100 dark:border-zinc-700"
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              
              <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-800 mx-2 hidden sm:block" />

              <div className="flex items-center gap-4 pl-2">
                 <div className="text-right hidden sm:block">
                    <p className="text-xs font-black uppercase text-zinc-900 dark:text-white tracking-tight">{user?.name}</p>
                    <span className="text-[9px] font-bold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded uppercase tracking-widest border border-primary-500/20">{user?.role}</span>
                 </div>
                 <div className="w-12 h-12 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center font-black text-lg shadow-lg">
                    {user?.name?.charAt(0) || 'U'}
                 </div>
              </div>

              {isNotifOpen && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setIsNotifOpen(false)} />
                    <div className="absolute right-8 top-20 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 rounded-[24px] shadow-2xl border border-zinc-200 dark:border-zinc-800 z-[70] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                       <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50">
                          <h4 className="text-xs font-black uppercase tracking-widest">Notificações</h4>
                          <button onClick={clearAll} className="text-[10px] text-zinc-400 hover:text-red-500 transition-colors font-bold uppercase">Limpar tudo</button>
                       </div>
                       <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                          {notifications.length === 0 ? (
                            <div className="p-10 text-center text-zinc-400 text-[10px] uppercase font-bold flex flex-col items-center gap-2">
                                <Bell size={24} className="opacity-20"/>
                                Nenhuma notificação
                            </div>
                          ) : (
                            notifications.map(n => (
                              <div key={n.id} className={`p-4 border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-950/50 transition-colors flex gap-3 ${!n.read ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                                 <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.type === 'error' ? 'bg-red-500' : n.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                                 <div className="flex-1">
                                    <p className="text-[11px] font-black text-zinc-900 dark:text-white uppercase tracking-tight">{n.title}</p>
                                    <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed font-medium">{n.message}</p>
                                    <span className="text-[9px] text-zinc-300 mt-2 block font-mono">{new Date(n.timestamp).toLocaleTimeString()}</span>
                                 </div>
                                 {!n.read && (
                                   <button onClick={() => markAsRead(n.id)} className="text-zinc-300 hover:text-primary-500 self-start"><CheckCircle2 size={14}/></button>
                                 )}
                              </div>
                            ))
                          )}
                       </div>
                    </div>
                  </>
              )}
           </div>
        </header>

        {/* CONTENT - Padding removido se for /map */}
        <div className={`flex-1 overflow-y-auto custom-scrollbar bg-zinc-50 dark:bg-black ${isMapPage ? 'p-0' : 'p-6 lg:p-10'}`}>
            {children || <Outlet />}
        </div>
        
        <AiAssistant />
      </main>
    </div>
  );
};
