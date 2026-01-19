
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
    const initSession = async () => {
      try {
        const cachedUser = await storage.getSessionUser();
        if (cachedUser) {
          // Inicializa o motor de criptografia com o usuário da sessão
          await storage.initEncryption(cachedUser);
          
          // Verifica se o acesso ainda é válido no Firebase
          const dbUser = await storage.findUserByEmail(cachedUser.email);
          if (dbUser && dbUser.status === 'approved') {
            setUser(dbUser);
            await storage.setSessionUser(dbUser);
          } else if (dbUser) {
            // Conta desativada ou alterada
            await storage.clearSessionUser();
            setUser(null);
          } else {
            // Em caso de erro de rede ou usuário deletado, mantém o cache local por enquanto
            setUser(cachedUser);
          }
        }
      } catch (e) {
        console.error("Auth Boot Error", e);
      } finally {
        setLoading(false);
      }
    };
    initSession();
  }, []);

  const login = async (email: string, password?: string): Promise<string | void> => {
    setLoading(true);
    try {
      const dbUser = await storage.findUserByEmail(email.toLowerCase().trim());
      
      if (!dbUser) {
        setLoading(false);
        return "Usuário não encontrado ou erro de conexão.";
      }

      if (dbUser.password && password !== dbUser.password) {
        setLoading(false);
        return "Senha incorreta.";
      }

      if (dbUser.status !== 'approved' && dbUser.email !== ADMIN_EMAIL) {
        setLoading(false);
        return "Seu acesso está pendente de aprovação.";
      }

      // IMPORTANTE: Inicializar criptografia ANTES de salvar a sessão
      await storage.initEncryption(dbUser);
      await storage.setSessionUser(dbUser);
      setUser(dbUser);
      return;
    } catch (e) {
      setLoading(false);
      return "Falha na comunicação com o servidor.";
    } finally {
      setLoading(false);
    }
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
    const updatedUser = { ...user, ...data };
    // Se mudar a senha, precisamos reinicializar a criptografia futuramente
    if (data.password) await storage.initEncryption(updatedUser);
    
    await storage.registerUserRequest(updatedUser);
    await storage.setSessionUser(updatedUser);
    setUser(updatedUser);
  };

  const logout = async () => {
    await storage.clearSessionUser();
    setUser(null);
  };

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-6">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <h2 className="font-display font-black text-white uppercase tracking-[0.3em] text-[10px]">Protegendo sua Conexão</h2>
      </div>
    </div>
  );

  return (
    <AuthContext.Provider value={{ 
      user, login, register, updateProfile, logout, 
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
