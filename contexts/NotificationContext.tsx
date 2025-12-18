
import * as React from 'react';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AppNotification } from '../types';
import { storage } from '../services/storage';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (type: 'error' | 'success' | 'info', title: string, message: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children?: ReactNode }) => {
  // Inicializa a partir do storage para persistência real
  const [notifications, setNotifications] = useState<AppNotification[]>(() => storage.getNotifications());

  // Sincroniza com localStorage sempre que mudar
  useEffect(() => {
    storage.saveNotifications(notifications);
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((type: 'error' | 'success' | 'info', title: string, message: string) => {
    const newNote: AppNotification = {
      id: crypto.randomUUID(),
      type,
      title,
      message,
      timestamp: Date.now(),
      read: false,
    };
    setNotifications(prev => [newNote, ...prev.slice(0, 49)]); // Mantém as últimas 50
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

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      addNotification, 
      markAsRead, 
      markAllAsRead, 
      clearAll 
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
