import * as React from 'react';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User as FirebaseUser } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';
import { auth } from '../services/firebase';
import { systemDoc } from '../lib/firestore';
import { rateLimitService } from '../services/rateLimit';

interface SystemAdmin {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface SystemAdminContextValue {
  admin: SystemAdmin | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | void>;
  logout: () => Promise<void>;
}

const SystemAdminContext = createContext<SystemAdminContextValue | undefined>(undefined);

const GENERIC_LOGIN_ERROR = 'Email ou senha inválidos.';

export const SystemAdminProvider = ({ children }: { children?: ReactNode }) => {
  const [admin, setAdmin] = useState<SystemAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  const validateSystemAdmin = async (fbUser: FirebaseUser): Promise<SystemAdmin | null> => {
    try {
      const snap = await getDoc(systemDoc('system_admins', fbUser.uid));
      if (!snap.exists()) return null;
      return {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
      };
    } catch (e) {
      console.error('SystemAdmin lookup failed:', e);
      return null;
    }
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const authInstance = auth;
    const unsubscribe = onAuthStateChanged(authInstance, async (fbUser) => {
      if (!fbUser) {
        setAdmin(null);
        setLoading(false);
        return;
      }
      const sa = await validateSystemAdmin(fbUser);
      if (!sa) {
        await signOut(authInstance);
        setAdmin(null);
      } else {
        setAdmin(sa);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<string | void> => {
    if (!auth) return 'Serviço indisponível.';
    const limitCheck = rateLimitService.check('admin_login_attempt', 5, 900);
    if (!limitCheck.allowed) {
      return `Muitas tentativas. Tente novamente em ${limitCheck.waitTime} segundos.`;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const sa = await validateSystemAdmin(cred.user);
      if (!sa) {
        await signOut(auth);
        rateLimitService.record('admin_login_attempt');
        return GENERIC_LOGIN_ERROR;
      }
      rateLimitService.clear('admin_login_attempt');
      setAdmin(sa);
    } catch (e: any) {
      rateLimitService.record('admin_login_attempt');
      console.warn('admin login error:', e?.code);
      return GENERIC_LOGIN_ERROR;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (auth) await signOut(auth);
    setAdmin(null);
  };

  return (
    <SystemAdminContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </SystemAdminContext.Provider>
  );
};

export const useSystemAdmin = () => {
  const ctx = useContext(SystemAdminContext);
  if (!ctx) throw new Error('useSystemAdmin must be used within SystemAdminProvider');
  return ctx;
};
