
import * as React from 'react';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { storage } from '../services/storage';

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<string | void>;
  register: (name: string, email: string, password: string, ip: string) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
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
      try {
        const u = await storage.getSessionUser();
        if (u) {
          // Mantém a sessão ativa imediatamente
          setUser(u);
          
          // Validação silenciosa no banco de dados (pode ser Firestore ou Cache Local sincronizado)
          const dbUser = await storage.findUserByEmail(u.email);
          if (dbUser) {
            if (dbUser.status === 'approved') {
              setUser(dbUser); 
              await storage.setSessionUser(dbUser);
            } else {
              await storage.clearSessionUser();
              setUser(null);
            }
          }
        }
      } catch (e) {
        console.error("Auth Init Error:", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (email: string, password?: string): Promise<string | void> => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    
    if (!password) {
        setLoading(false);
        return "Por favor, insira sua senha.";
    }

    // Busca no Banco de Dados (Prioriza Firestore, depois cache local sincronizado via Database Sync)
    const dbUser = await storage.findUserByEmail(cleanEmail);

    if (dbUser) {
        // Validação estrita de senha
        if (dbUser.password && password !== dbUser.password) {
            setLoading(false);
            return "Senha incorreta. Verifique os dados e tente novamente.";
        }

        // Caso o usuário não tenha senha (migração legada)
        if (!dbUser.password && (password === 'admin' || password === '123456')) {
            if (cleanEmail !== ADMIN_EMAIL) {
                setLoading(false);
                return "Usuário sem senha definida no servidor. Contate o administrador.";
            }
        }

        if (dbUser.status === 'pending' && cleanEmail !== ADMIN_EMAIL) {
            setLoading(false);
            return "Sua conta ainda não foi aprovada pelo gestor.";
        }

        if (dbUser.status === 'rejected') {
            setLoading(false);
            return "Seu acesso foi revogado. Contate o administrador.";
        }

        await storage.setSessionUser(dbUser);
        setUser(dbUser);
        setLoading(false);
        return;
    }

    setLoading(false);
    return "E-mail não localizado no cache de usuários. Se for novo, peça ao admin para sincronizar o banco.";
  };

  const register = async (name: string, email: string, password: string, ip: string) => {
    const newUser: User = { 
        id: crypto.randomUUID(), 
        name, 
        email: email.trim().toLowerCase(), 
        password,
        role: email.trim().toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user', 
        status: email.trim().toLowerCase() === ADMIN_EMAIL ? 'approved' : 'pending',
        ip,
        createdAt: Date.now()
    };
    
    await storage.registerUserRequest(newUser);
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;
    await storage.updateUserProfile(user.id, data);
    const updatedUser = { ...user, ...data };
    setUser(updatedUser);
    await storage.setSessionUser(updatedUser);
  };

  const logout = async () => {
    await storage.clearSessionUser();
    setUser(null);
  };

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-6">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <h2 className="font-display font-black text-white uppercase tracking-[0.3em] text-[10px]">Autenticando</h2>
      </div>
    </div>
  );

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      register,
      updateProfile,
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
