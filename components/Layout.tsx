
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
  Settings
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
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      connected: 'from-emerald-400 to-emerald-600',
      syncing: 'from-blue-400 to-blue-600',
      error: 'from-red-400 to-red-600',
      offline: 'from-gray-400 to-gray-600',
    };
    const color = colors[connectionStatus] || colors.offline;
    return `bg-gradient-to-br ${color}`;
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

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-5 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
          K-TAG
        </h1>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar - Futuristic Glass Panel */}
      <AnimatePresence mode="wait">
        {(isSidebarOpen || isDesktop) && (
          <motion.aside
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed md:relative inset-y-0 left-0 z-50 w-72 bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl border-r border-white/20 dark:border-slate-800/50 shadow-2xl md:shadow-none flex flex-col"
          >
            {/* Overlay mobile */}
            {isSidebarOpen && !isDesktop && (
              <div 
                className="fixed inset-0 bg-black/50 z-[-1]" 
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

            <div className="relative h-full flex flex-col">
              {/* Logo */}
              <div className="p-8 pb-4">
                <h1 className="text-3xl font-black bg-gradient-to-r from-primary-500 via-primary-600 to-purple-600 bg-clip-text text-transparent">
                  K-TAG
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tracking-wider">MANAGER</p>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-5 space-y-1.5 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsSidebarOpen(false)}
                      className="block group"
                    >
                      <motion.div
                        whileHover={{ x: 6 }}
                        whileTap={{ scale: 0.98 }}
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
                      </motion.div>
                    </Link>
                  );
                })}
              </nav>

              {/* User Footer */}
              <div className="p-6 border-t border-white/20 dark:border-slate-800/50 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm truncate max-w-[120px]">{user?.name}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[120px]">{user?.email}</p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className="p-3 rounded-full bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all"
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
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-black min-h-screen w-full relative overflow-x-hidden">
        {/* Top Bar - Minimal & Floating */}
        <header className="hidden md:flex items-center justify-between p-6">
          <div className="flex-1" />

          <div className="flex items-center gap-6">
            {/* Connection Orb */}
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/30 dark:border-slate-700/50 shadow-xl">
              <div className={`relative w-3 h-3 rounded-full ${getConnectionOrb()} shadow-lg`}>
                {connectionStatus === 'connected' && (
                  <motion.div
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 rounded-full bg-emerald-400/50 blur-xl"
                  />
                )}
              </div>
              <span className="text-xs font-medium tracking-wider uppercase">
                {getStatusText()}
              </span>
            </div>

            {/* Notifications */}
            <div ref={notifRef} className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleNotifications}
                className="relative p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl hover:bg-white/90 dark:hover:bg-slate-800/90 transition-all shadow-xl"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-red-500 to-pink-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
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
                    className="absolute right-0 mt-4 w-96 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/30 dark:border-slate-700/50 overflow-hidden z-[100]"
                  >
                    <div className="p-5 border-b border-white/20 dark:border-slate-800/50 flex justify-between items-center">
                      <h3 className="font-bold text-lg">{t('notifications')}</h3>
                      {notifications.length > 0 && (
                        <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1.5">
                          <Trash2 size={14} /> {t('clearAll')}
                        </button>
                      )}
                    </div>

                    <div className="max-h-96 overflow-y-auto p-3 space-y-3">
                      {notifications.length === 0 ? (
                        <p className="text-center py-12 text-slate-400">✨ {t('noNotifications')}</p>
                      ) : (
                        notifications.map(n => (
                          <motion.div
                            key={n.id}
                            whileHover={{ x: 4 }}
                            className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200/50 dark:border-slate-700/50"
                          >
                            <div className="flex gap-3">
                              {getNotifIcon(n.type)}
                              <div className="flex-1">
                                <p className="font-semibold text-sm">{n.title}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                                <p className="text-xs text-slate-400 mt-2 text-right">
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

        {/* Page Content */}
        <div className="flex-1 px-6 pb-6 md:px-12 md:pb-12 pt-20 md:pt-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
