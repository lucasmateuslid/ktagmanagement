
import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';
import { useConnection } from '../contexts/ConnectionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  LayoutDashboard, 
  Map, 
  Tags, 
  Car, 
  LogOut, 
  Moon, 
  Sun,
  Menu,
  Bell,
  Trash2,
  AlertCircle,
  CheckCircle,
  Info,
  Settings,
  X
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
    { label: t('dashboard'), path: '/', icon: LayoutDashboard },
    { label: t('liveMap'), path: '/map', icon: Map },
    { label: t('tags'), path: '/tags', icon: Tags },
    { label: t('vehicles'), path: '/vehicles', icon: Car },
    { label: t('settings'), path: '/settings', icon: Settings },
  ];

  const getConnectionOrb = () => {
    const colors: Record<string, string> = {
      connected: 'bg-emerald-500',
      syncing: 'bg-blue-500',
      error: 'bg-red-500',
      offline: 'bg-gray-400',
    };
    return colors[connectionStatus] || colors.offline;
  };

  const getStatusText = () => {
    switch(connectionStatus) {
      case 'connected': return t('systemOnline');
      case 'syncing': return t('syncing');
      case 'error': return t('connectionError');
      case 'offline': return t('offline');
      default: return t('offline');
    }
  };

  const getNotifIcon = (type: string) => {
    switch(type) {
      case 'error': return <AlertCircle size={18} className="text-red-500" />;
      case 'success': return <CheckCircle size={18} className="text-emerald-500" />;
      default: return <Info size={18} className="text-blue-500" />;
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-primary-500 via-primary-600 to-purple-600 bg-clip-text text-transparent">
            K-TAG
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tracking-wider">MANAGER</p>
        </div>
        {/* Close Button for Mobile */}
        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-400">
           <X size={24} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-5 space-y-1.5 overflow-y-auto custom-scrollbar">
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
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${
                  isActive
                    ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 shadow-lg shadow-primary-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className={`p-2 rounded-xl ${isActive ? 'bg-primary-500/20' : 'bg-slate-200/50 dark:bg-slate-800/50'}`}>
                  <Icon size={20} className={isActive ? 'text-primary-600' : ''} />
                </div>
                <span className="font-medium text-sm tracking-wide">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-6 border-t border-white/20 dark:border-slate-800/50 space-y-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={toggleTheme}
            className="p-3 rounded-full bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all flex-shrink-0"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-all group"
        >
          <LogOut size={20} />
          <span className="font-medium">{t('signOut')}</span>
        </button>
      </div>
    </div>
  );

  return (
    // APP SHELL: h-screen and overflow-hidden ensures only the inner content scrolls
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      
      {/* Mobile Header: Fixed at top */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-16 flex items-center justify-between px-6 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/50">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
          K-TAG
        </h1>
        <div className="flex items-center gap-4">
            <div className={`w-2.5 h-2.5 rounded-full ${getConnectionOrb()}`}></div>
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -mr-2 text-slate-600 dark:text-slate-300">
            <Menu className="w-6 h-6" />
            </button>
        </div>
      </div>

      {/* Desktop Sidebar: Static Column */}
      <aside className="hidden md:flex flex-col w-72 h-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl border-r border-white/20 dark:border-slate-800/50 shadow-sm z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar: Overlay Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
             {/* Backdrop */}
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="md:hidden fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm"
               onClick={() => setIsSidebarOpen(false)}
             />
             {/* Drawer */}
             <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="md:hidden fixed inset-y-0 left-0 z-[70] w-80 bg-white dark:bg-slate-950 shadow-2xl"
             >
                <SidebarContent />
             </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative min-w-0">
        
        {/* Top Bar (Desktop Only) */}
        <header className="hidden md:flex items-center justify-between p-6 pb-2 h-20 shrink-0">
          <div className="flex-1" />

          <div className="flex items-center gap-6">
            {/* Connection Orb */}
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/30 dark:border-slate-700/50 shadow-xl transition-all hover:bg-white dark:hover:bg-slate-900">
              <div className="relative flex items-center justify-center">
                 <div className={`w-3 h-3 rounded-full ${getConnectionOrb()} shadow-sm relative z-10`} />
                 {(connectionStatus === 'connected' || connectionStatus === 'syncing') && (
                    <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${getConnectionOrb()}`}></span>
                 )}
              </div>
              <div className="flex flex-col">
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-700 dark:text-slate-200 leading-none mb-0.5">
                    {getStatusText()}
                  </span>
                  {connectionStatus === 'syncing' && <span className="text-[10px] text-slate-400 leading-none">Updating...</span>}
              </div>
            </div>

            {/* Notifications */}
            <div ref={notifRef} className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleNotifications}
                className="relative p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl hover:bg-white/90 dark:hover:bg-slate-800/90 transition-all shadow-xl"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-red-500 to-pink-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </motion.button>

              <AnimatePresence>
                {isNotifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-96 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/30 dark:border-slate-700/50 overflow-hidden z-[100]"
                  >
                    <div className="p-5 border-b border-white/20 dark:border-slate-800/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                      <h3 className="font-bold text-lg">{t('notifications')}</h3>
                      {notifications.length > 0 && (
                        <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1.5 font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <Trash2 size={14} /> {t('clearAll')}
                        </button>
                      )}
                    </div>

                    <div className="max-h-96 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                            <Bell size={32} className="opacity-20" />
                            <p className="text-sm font-medium">{t('noNotifications')}</p>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <motion.div
                            key={n.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-4 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 group"
                          >
                            <div className="flex gap-3">
                              <div className="mt-0.5">{getNotifIcon(n.type)}</div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{n.title}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">{n.message}</p>
                                <p className="text-[10px] text-slate-400 mt-2 font-mono">
                                  {new Date(n.timestamp).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        {/* pt-16 is required on mobile to clear the fixed header. md:pt-4 for desktop. */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden pt-16 md:pt-0 pb-6 custom-scrollbar bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-black">
          <div className="max-w-7xl mx-auto px-4 md:px-12 py-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
