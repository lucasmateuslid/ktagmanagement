
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { storage } from '../services/storage';

interface AuthContextType {
  user: User | null;
  login: (email: string) => Promise<string | void>; // Retorna string de erro se falhar
  register: (name: string, email: string, ip: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = 'lucasmateus.lima@outlook.com';

export const AuthProvider = ({ children }: { children?: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // Carrega a sessão atual
      const u = await storage.getSessionUser();
      
      // Valida se a sessão ainda é válida no banco (opcional, mas bom para segurança)
      if (u) {
        const dbUser = await storage.findUserByEmail(u.email);
        if (dbUser && dbUser.status === 'approved') {
           setUser(dbUser);
        } else if (u.email === ADMIN_EMAIL) {
           setUser(u); // Root Admin sempre entra
        } else {
           storage.clearSessionUser();
           setUser(null);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const login = async (email: string): Promise<string | void> => {
    setLoading(true);
    
    // Root Admin Bypass
    if (email === ADMIN_EMAIL) {
        const adminUser: User = { 
            id: 'root-admin', 
            name: 'Lucas Lima (Admin)', 
            email, 
            role: 'admin', 
            status: 'approved',
            createdAt: Date.now()
        };
        await storage.setSessionUser(adminUser);
        setUser(adminUser);
        setLoading(false);
        return;
    }

    const dbUser = await storage.findUserByEmail(email);

    if (!dbUser) {
        setLoading(false);
        return "User not found. Please register first.";
    }

    if (dbUser.status === 'pending') {
        setLoading(false);
        return "Account pending approval from administrator.";
    }

    if (dbUser.status === 'rejected') {
        setLoading(false);
        return "Access rejected by administrator.";
    }

    // Login sucess
    await storage.setSessionUser(dbUser);
    setUser(dbUser);
    setLoading(false);
  };

  const register = async (name: string, email: string, ip: string) => {
    const newUser: User = { 
        id: crypto.randomUUID(), 
        name, 
        email, 
        role: 'user', 
        status: 'pending', // Sempre pendente
        ip,
        createdAt: Date.now()
    };
    
    await storage.registerUserRequest(newUser);
  };

  const logout = async () => {
    await storage.clearSessionUser();
    setUser(null);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading K-TAG...</div>;

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      register,
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
