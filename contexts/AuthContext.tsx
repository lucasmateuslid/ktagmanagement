
import * as React from 'react';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { storage } from '../services/storage';
import { rateLimitService } from '../services/rateLimit';
import { securityService } from '../services/security';

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
          await storage.initEncryption(cachedUser);
          
          const dbUser = await storage.findUserByEmail(cachedUser.email);
          if (dbUser && dbUser.status === 'approved') {
            setUser(dbUser);
            await storage.setSessionUser(dbUser);
          } else if (dbUser) {
            await storage.clearSessionUser();
            setUser(null);
          } else {
            setUser(cachedUser);
          }
        }
      } catch (e) {
        console.error("Auth Boot Error", e);
        await storage.clearSessionUser();
      } finally {
        setLoading(false);
      }
    };
    initSession();
  }, []);

  const login = async (email: string, password?: string): Promise<string | void> => {
    // RATE LIMIT: 5 tentativas por 15 min
    const limitCheck = rateLimitService.check('login_attempt', 5, 900);
    if (!limitCheck.allowed) {
      return `Muitas tentativas. Tente novamente em ${limitCheck.waitTime} segundos.`;
    }

    setLoading(true);
    try {
      const dbUser = await storage.findUserByEmail(email.toLowerCase().trim());
      
      if (!dbUser) {
        rateLimitService.record('login_attempt');
        setLoading(false);
        return "Usuário não encontrado ou erro de conexão.";
      }

      // --- LÓGICA DE VALIDAÇÃO DE SENHA SEGURA ---
      let isPasswordValid = false;
      let needsMigration = false;

      // 1. Tenta verificar como Hash
      if (dbUser.password) {
        isPasswordValid = await securityService.verifyPassword(password || '', dbUser.password);
        
        // 2. Fallback: Se falhar, verifica se é texto plano (Legacy Migration)
        if (!isPasswordValid && dbUser.password === password) {
            isPasswordValid = true;
            needsMigration = true;
        }
      }

      if (!isPasswordValid) {
        rateLimitService.record('login_attempt');
        setLoading(false);
        return "Senha incorreta.";
      }

      if (dbUser.status !== 'approved' && dbUser.email !== ADMIN_EMAIL) {
        setLoading(false);
        return "Seu acesso está pendente de aprovação.";
      }

      // --- MIGRAÇÃO AUTOMÁTICA PARA HASH ---
      if (needsMigration && password) {
          const newHash = await securityService.hashPassword(password);
          await storage.updateUserProfile(dbUser.id, { password: newHash });
          dbUser.password = newHash; // Atualiza objeto local
      }

      rateLimitService.clear('login_attempt');
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
    // Hash da senha antes de enviar para o storage
    const hashedPassword = await securityService.hashPassword(password);
    
    const newUser: User = { 
        id: crypto.randomUUID(), 
        name, 
        email: email.trim().toLowerCase(), 
        password: hashedPassword,
        role: email.trim().toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user', 
        status: email.trim().toLowerCase() === ADMIN_EMAIL ? 'approved' : 'pending',
        ip,
        createdAt: Date.now()
    };
    await storage.registerUserRequest(newUser);
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;
    
    // Se estiver atualizando a senha, faz o hash antes
    const dataToUpdate = { ...data };
    if (dataToUpdate.password) {
        dataToUpdate.password = await securityService.hashPassword(dataToUpdate.password);
    }

    const updatedUser = { ...user, ...dataToUpdate };
    
    await storage.registerUserRequest(updatedUser); // Usa método genérico de save
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
        <h2 className="font-display font-black text-white uppercase tracking-[0.3em] text-[10px]">Verificando Credenciais</h2>
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
