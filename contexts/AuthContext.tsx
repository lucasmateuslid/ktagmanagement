
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { storage } from '../services/storage';

interface AuthContextType {
  user: User | null;
  login: (name: string, email: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children?: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const u = await storage.getUser();
      setUser(u);
      setLoading(false);
    };
    init();
  }, []);

  const login = async (name: string, email: string) => {
    const role = email.toLowerCase() === 'lucasmateus.lima@outlook.com' ? 'admin' : 'user';
    const newUser: User = { id: crypto.randomUUID(), name, email, role };
    await storage.setUser(newUser);
    setUser(newUser);
  };

  const logout = async () => {
    await storage.clearUser();
    setUser(null);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading K-TAG...</div>;

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};