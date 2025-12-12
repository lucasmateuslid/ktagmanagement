
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';
import { useConnection } from '../contexts/ConnectionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { AiAssistant } from './AiAssistant';
import { 
  LayoutGrid, 
  Map, 
  Tags, 
  CarFront, 
  LogOut, 
  Moon, 
  Sun,
  Menu,
  Bell,
  AlertCircle,
  CheckCircle,
  Info,
  Settings,
  X,
  ChevronRight,
  ShieldAlert,
  Users,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Layout = ({ children }: { children?: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAllAsRead, clearAll } = useNotification();
  const { status: connectionStatus } = useConnection();
  const { t } = useLanguage();
  const location = useLocation();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close sidebar on route change (Mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleNotifications = () => {
    if (!isNotifOpen) markAllAsRead();
    setIsNotifOpen(v => !v);
  };

  const navItems = [
    { label: t('dashboard'), path: '/', icon: LayoutGrid },
    { label: t('liveMap'), path: '/map', icon: Map },
    { label: 'Segurança', path: '/security', icon: ShieldAlert },
    { label: t('reports'), path: '/reports', icon: FileText }, // Added
    { label: t('tags'), path: '/tags', icon: Tags },
    { label: t('vehicles'), path: '/vehicles', icon: CarFront },
    // Only add Users item if admin
    ...(user?.role === 'admin' ? [{ label: t('users'), path: '/users', icon: Users }] : []),
    { label: t('settings'), path: '/settings', icon: Settings },
  ];

  const getConnectionDot = () => {
    const colors: Record<string, string> = {
      connected: 'bg-emerald-500 text-emerald-500', // Green for connected
      syncing: 'bg-yellow-500 text-yellow-500',     // Yellow for syncing
      error: 'bg-red-500 text-red-500',             // Red for error
      offline: 'bg-red-500 text-red-500',           // Red for offline
    };
    return colors[connectionStatus] || colors.offline;
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Brand */}
      <div className="h-20 flex items-center px-8 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-black font-display font-black text-lg">
                K
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-zinc-900 dark:text-white">TAG</span>
        </div>
        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden ml-auto p-2 text-zinc-400 hover:text-zinc-600">
           <X size={24} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="block group"
            >
              <div
                className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 border border-transparent ${
                  isActive
                    ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-zinc-900 dark:text-white' : ''} />
                  <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                </div>
                {isActive && <ChevronRight size={14} className="text-zinc-400" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer User Profile */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3 mb-4 px-2">
           <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-300">
              {user?.name.charAt(0)}
           </div>
           <div className="flex-1 min-w-0">
             <p className="text-sm font-semibold truncate text-zinc-900 dark:text-zinc-100">{user?.name}</p>
             <p className="text-xs text-zinc-500 truncate">{user?.role === 'admin' ? 'Administrator' : 'User'}</p>
           </div>
        </div>

        <div className="flex gap-2">
            <button
                onClick={toggleTheme}
                className="flex-1 flex items-center justify-center py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
                onClick={logout}
                className="flex-1 flex items-center justify-center py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 hover:border-red-200 dark:hover:border-red-900/30 transition-colors"
            >
                <LogOut size={16} />
            </button>
        </div>
      </div>
    </div>
  );

  return (
    // APP SHELL
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans">
      
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-16 flex items-center justify-between px-6 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <span className="font-display font-bold text-lg text-zinc-900 dark:text-white">K-TAG</span>
        <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -mr-2 text-zinc-600 dark:text-zinc-300">
                <Menu className="w-6 h-6" />
            </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-full border-r border-zinc-200 dark:border-zinc-800 shrink-0 z-30 shadow-sm">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="md:hidden fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
               onClick={() => setIsSidebarOpen(false)}
             />
             <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="md:hidden fixed inset-y-0 left-0 z-[70] w-72 h-full shadow-2xl"
             >
                <SidebarContent />
             </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative min-w-0">
        
        {/* Desktop Top Bar */}
        <header className="hidden md:flex items-center justify-between px-8 py-5 shrink-0 bg-zinc-50 dark:bg-black border-b border-zinc-200/50 dark:border-zinc-900">
          <div>
             {/* Connection Status Indicator */}
             <div 
                className="flex items-center gap-2 text-xs font-mono text-zinc-400 uppercase tracking-widest cursor-help"
                title={`Connection Status: ${connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}`}
             >
                <span>System Status</span>
                <span className="text-zinc-300 dark:text-zinc-700">/</span>
                <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full shadow-sm ${getConnectionDot()} ${connectionStatus === 'syncing' ? 'animate-pulse' : ''}`} />
                    <span className={connectionStatus === 'error' ? 'text-red-500 font-semibold' : 'text-zinc-600 dark:text-zinc-400 font-medium'}>
                        {connectionStatus === 'connected' ? 'ONLINE' : connectionStatus.toUpperCase()}
                    </span>
                </div>
             </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <div ref={notifRef} className="relative">
              <button
                onClick={toggleNotifications}
                className="relative p-2.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors shadow-sm"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2.5 w-2 h-2 bg-primary-500 rounded-full ring-2 ring-white dark:ring-black" />
                )}
              </button>

              <AnimatePresence>
                {isNotifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-[100]"
                  >
                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950">
                      <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">{t('notifications')}</h3>
                      {notifications.length > 0 && (
                        <button onClick={clearAll} className="text-xs text-zinc-500 hover:text-red-500">
                           {t('clearAll')}
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-zinc-500 text-sm">{t('noNotifications')}</div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} className="p-4 border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                            <div className="flex gap-3">
                                {n.type === 'error' ? <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5"/> : 
                                 n.type === 'success' ? <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5"/> :
                                 <Info size={16} className="text-blue-500 shrink-0 mt-0.5"/>}
                                <div>
                                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{n.title}</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">{n.message}</p>
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
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden pt-16 md:pt-0 pb-6 scrollbar-hide">
          <div className="max-w-[1600px] mx-auto px-6 md:px-8 py-6">
            {children}
          </div>
        </div>
        
        {/* Floating AI Assistant */}
        <AiAssistant />
      </main>
    </div>
  );
};
