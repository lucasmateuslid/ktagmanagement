
import * as React from 'react';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AppNotification } from '../types';
import { storage } from '../services/storage';

export type NotificationAudience = 'user' | 'admin' | 'moderator' | 'client' | 'system';

type NotificationOrigin = 'local' | 'schedule' | 'push' | 'system';

interface AddNotificationOptions {
  audience?: NotificationAudience;
  origin?: NotificationOrigin;
}

interface NotificationContextType {
  notifications: AppNotification[];
  activeToast: AppNotification | null;
  criticalAlerts: string[]; // Mensagens persistentes de topo (30min+)
  unreadCount: number;
  addNotification: (type: 'error' | 'success' | 'info', title: string, message: string, showToast?: boolean, options?: AddNotificationOptions) => void;
  setCriticalAlerts: (alerts: string[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  closeToast: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children?: ReactNode }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const stored = storage.getNotifications();
    return stored.map((note) => ({
      ...note,
      audience: note.audience ?? 'system',
      origin: note.origin ?? 'local',
      deliveryStatus: note.deliveryStatus ?? (note.read ? 'lida' : 'entregue')
    }));
  });
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const [criticalAlerts, setCriticalAlerts] = useState<string[]>([]);

  useEffect(() => {
    storage.saveNotifications(notifications);
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((type: 'error' | 'success' | 'info', title: string, message: string, showToast: boolean = true, options?: AddNotificationOptions) => {
    const newNote: AppNotification = {
      id: crypto.randomUUID(),
      type,
      title,
      message,
      timestamp: Date.now(),
      read: false,
      audience: options?.audience ?? 'system',
      origin: options?.origin ?? 'local',
      deliveryStatus: 'entregue',
    };
    
    setNotifications(prev => [newNote, ...prev.slice(0, 49)]);

    if (showToast) {
      setActiveToast(newNote);
      setTimeout(() => {
        setActiveToast(prev => (prev?.id === newNote.id ? null : prev));
      }, 1500); // 1.5 segundos
    }
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true, deliveryStatus: 'lida' } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true, deliveryStatus: 'lida' })));
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
