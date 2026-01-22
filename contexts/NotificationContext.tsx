
import * as React from 'react';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AppNotification } from '../types';
import { storage } from '../services/storage';

interface NotificationContextType {
  notifications: AppNotification[];
  activeToast: AppNotification | null;
  criticalAlerts: string[]; // Mensagens persistentes de topo (30min+)
  unreadCount: number;
  addNotification: (type: 'error' | 'success' | 'info', title: string, message: string, showToast?: boolean) => void;
  setCriticalAlerts: (alerts: string[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  closeToast: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children?: ReactNode }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => storage.getNotifications());
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const [criticalAlerts, setCriticalAlerts] = useState<string[]>([]);

  useEffect(() => {
    storage.saveNotifications(notifications);
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((type: 'error' | 'success' | 'info', title: string, message: string, showToast: boolean = false) => {
    const newNote: AppNotification = {
      id: crypto.randomUUID(),
      type,
      title,
      message,
      timestamp: Date.now(),
      read: false,
    };
    
    setNotifications(prev => [newNote, ...prev.slice(0, 49)]);

    if (showToast) {
      setActiveToast(newNote);
      setTimeout(() => {
        setActiveToast(prev => (prev?.id === newNote.id ? null : prev));
      }, 3000);
    }
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const closeToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      activeToast,
      criticalAlerts,
      unreadCount, 
      addNotification, 
      setCriticalAlerts,
      markAsRead, 
      markAllAsRead, 
      clearAll,
      closeToast
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotification must be used within a NotificationProvider");
  return context;
};
