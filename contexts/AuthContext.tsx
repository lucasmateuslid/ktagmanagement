import * as React from 'react';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { storage } from '../services/storage';
import { jwtService } from '../services/jwt';
import { functions } from '../services/firebase';
import { httpsCallable } from 'firebase/functions';

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

export const AuthProvider = ({ children }: { children?: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Inicialização de Sessão (Verifica Token no Storage)
  useEffect(() => {
    const initSession = async () => {
      try {
        const token = localStorage.getItem('ktag_auth_token');
        if (token) {
          // Apenas decodifica para pegar dados de UI. Se o token for inválido,
          // as chamadas de API subsequentes falharão.
          const userData = await jwtService.verify(token);
          
          if (userData) {
            await storage.initEncryption(userData);
            setUser(userData);
          } else {
            await storage.clearSessionUser();
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

  // LOGIN SEGURO VIA BACKEND
  const login = async (email: string, password?: string): Promise<string | void> => {
    setLoading(true);
    try {
      const authLogin = httpsCallable(functions, 'authLogin');
      
      // Enviamos a senha crua via HTTPS. O Backend cuida do Hash e comparação.
      const result = await authLogin({ 
        identifier: email, 
        password: password 
      });

      const { token, user: apiUser } = result.data as any;

      if (token && apiUser) {
        // Armazena token assinado pelo backend
        localStorage.setItem('ktag_auth_token', token);
        
        // Inicializa criptografia E2EE (Client-side)
        await storage.initEncryption(apiUser);
        
        setUser(apiUser);
        return;
      } else {
        return "Resposta inválida do servidor.";
      }

    } catch (e: any) {
      console.error("Login Failed:", e);
      setLoading(false);
      return e.message || "Credenciais inválidas ou erro no servidor.";
    } finally {
      setLoading(false);
    }
  };

  // REGISTRO SEGURO VIA BACKEND
  const register = async (name: string, email: string, password: string, ip: string) => {
    const authRegister = httpsCallable(functions, 'authRegister');
    await authRegister({ name, email, password, ip });
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;
    // Para updates de senha, idealmente também usaríamos uma Cloud Function dedicada
    // para garantir hash correto no servidor.
    const updatedUser = { ...user, ...data };
    // TODO: Migrar updateProfile para Cloud Function para segurança total
    await storage.updateUserProfile(user.id, data);
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
        <h2 className="font-display font-black text-white uppercase tracking-[0.3em] text-[10px]">Autenticação Segura</h2>
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