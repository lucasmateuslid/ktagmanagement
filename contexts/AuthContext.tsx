import * as React from 'react';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updatePassword as fbUpdatePassword,
  User as FirebaseUser,
} from 'firebase/auth';
import { getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { User, CustomRole } from '../types';
import { storage } from '../services/storage';
import { rateLimitService } from '../services/rateLimit';
import { auth } from '../services/firebase';
import { tenantDoc } from '../lib/firestore';
import { encryption } from '../services/encryption';
import { useTenant } from './TenantContext';

interface AuthContextType {
  user: User | null;
  customRoles: CustomRole[];
  login: (email: string, password?: string) => Promise<string | void>;
  register: (name: string, email: string, password: string, ip: string) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GENERIC_LOGIN_ERROR = 'Email ou senha inválidos.';
const USERS_COLLECTION = 'users';

// Códigos de erro do Firebase Auth tratados como "credencial inválida".
// Reunidos para retornar a mesma mensagem genérica e evitar user enumeration.
const INVALID_CREDENTIAL_CODES = new Set([
  'auth/invalid-credential',
  'auth/invalid-email',
  'auth/wrong-password',
  'auth/user-not-found',
  'auth/user-disabled',
  'auth/missing-password',
]);

function translateAuthError(err: any): string {
  const code: string = err?.code || '';
  if (INVALID_CREDENTIAL_CODES.has(code)) return GENERIC_LOGIN_ERROR;
  if (code === 'auth/too-many-requests') {
    return 'Muitas tentativas. Tente novamente em alguns minutos.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Falha de rede. Verifique sua conexão.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'Já existe uma conta com este e-mail.';
  }
  if (code === 'auth/weak-password') {
    return 'Senha muito fraca. Use ao menos 6 caracteres.';
  }
  // Fallback: nunca devolver mensagens cruas do Firebase para o usuário.
  return GENERIC_LOGIN_ERROR;
}

export const AuthProvider = ({ children }: { children?: ReactNode }) => {
  const { tenantId } = useTenant();
  const [user, setUser] = useState<User | null>(null);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrega o User decriptado a partir de /tenants/{tenantId}/users/{uid}.
  // Retorna null se o doc não existe (usuário não é membro deste tenant) ou
  // se o status não está aprovado.
  const loadUserDoc = async (fbUser: FirebaseUser): Promise<User | null> => {
    if (!auth) return null;
    const snap = await getDoc(tenantDoc(USERS_COLLECTION, fbUser.uid));
    if (!snap.exists()) return null;
    const raw = { ...snap.data(), id: snap.id } as User;

    // O doc não é fonte de autenticação — Firebase Auth já validou. Aqui
    // apenas decriptamos campos sensíveis (name, cpf) para uso na UI.
    await encryption.waitReady();
    const decrypted: User = {
      ...raw,
      name: raw.name ? await encryption.decrypt(raw.name) : raw.name,
      cpf: raw.cpf ? await encryption.decrypt(raw.cpf) : undefined,
    };
    return decrypted;
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    // Local não-nulo para satisfazer narrowing dentro de closures async.
    const authInstance = auth;

    // Carrega custom roles (não depende de auth — coleção é por tenant mas
    // as rules permitem para qualquer membro autenticado).
    storage.getCustomRoles().then((roles) => setCustomRoles(roles as CustomRole[])).catch(() => {});

    const unsubscribe = onAuthStateChanged(authInstance, async (fbUser) => {
      try {
        if (!fbUser) {
          setUser(null);
          return;
        }

        // Garante que o usuário pertence ao tenant atual. Em produção, custom
        // claims (token.tenantId) também são validadas, mas o doc lookup é
        // a fonte da verdade para a UI.
        const doc = await loadUserDoc(fbUser);
        if (!doc) {
          console.warn(`Usuário ${fbUser.uid} sem doc em /tenants/${tenantId}/users — deslogando.`);
          await fbSignOut(authInstance);
          setUser(null);
          return;
        }

        if (doc.tenantId && doc.tenantId !== tenantId) {
          console.warn('Usuário pertence a outro tenant — deslogando.');
          await fbSignOut(authInstance);
          setUser(null);
          return;
        }

        if (doc.status !== 'approved') {
          // Mantém logado para que o usuário veja o motivo? Não — força logout
          // e a tela de login mostra a mensagem na próxima tentativa.
          await fbSignOut(authInstance);
          setUser(null);
          return;
        }

        setUser(doc);
      } catch (e) {
        console.error('Auth boot error:', e);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [tenantId]);

  const login = async (email: string, password?: string): Promise<string | void> => {
    if (!auth) return 'Serviço de autenticação indisponível.';
    if (!password) return GENERIC_LOGIN_ERROR;

    const limitCheck = rateLimitService.check('login_attempt', 5, 900);
    if (!limitCheck.allowed) {
      return `Muitas tentativas. Tente novamente em ${limitCheck.waitTime} segundos.`;
    }

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);

      const doc = await loadUserDoc(cred.user);
      if (!doc) {
        // Auth OK mas usuário não é membro deste tenant — esconde a razão.
        await fbSignOut(auth);
        rateLimitService.record('login_attempt');
        return GENERIC_LOGIN_ERROR;
      }

      if (doc.tenantId && doc.tenantId !== tenantId) {
        await fbSignOut(auth);
        return GENERIC_LOGIN_ERROR;
      }

      if (doc.status !== 'approved') {
        await fbSignOut(auth);
        return 'Seu acesso está pendente de aprovação.';
      }

      rateLimitService.clear('login_attempt');
      setUser(doc);
      return;
    } catch (e: any) {
      rateLimitService.record('login_attempt');
      console.warn('Login error:', e?.code || e?.message);
      return translateAuthError(e);
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string, ip: string) => {
    if (!auth) throw new Error('Serviço de autenticação indisponível.');

    const cleanEmail = email.trim().toLowerCase();
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

    const newUser: User = {
      id: cred.user.uid,
      name,
      email: cleanEmail,
      role: 'user',
      status: 'pending',
      tenantId,
      ip,
      createdAt: Date.now(),
    };

    // O Cloud Function `onTenantUserWrite` vai setar customClaims após este write.
    await setDoc(tenantDoc(USERS_COLLECTION, cred.user.uid), {
      ...newUser,
      name: await encryption.encrypt(name),
    });

    // Auto sign-out — usuário precisa esperar aprovação do admin.
    await fbSignOut(auth);
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user || !auth) return;

    const dataToUpdate: Partial<User> = { ...data };
    // Senha agora é gerenciada pelo Firebase Auth — não persiste no doc.
    delete (dataToUpdate as any).password;

    // Criptografa campos sensíveis antes de persistir.
    const encrypted: Record<string, any> = { ...dataToUpdate };
    if (data.name) encrypted.name = await encryption.encrypt(data.name);
    if (data.cpf) encrypted.cpf = await encryption.encrypt(data.cpf);

    await updateDoc(tenantDoc(USERS_COLLECTION, user.id), encrypted);

    // Se o caller passou senha, atualiza no Firebase Auth também.
    if (data.password && auth.currentUser) {
      try {
        await fbUpdatePassword(auth.currentUser, data.password);
      } catch (e: any) {
        // requires-recent-login — caller deve usar reauthenticateWithCredential antes.
        console.warn('updatePassword falhou:', e?.code);
        throw e;
      }
    }

    setUser({ ...user, ...dataToUpdate });
  };

  const logout = async () => {
    if (auth) await fbSignOut(auth);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <h2 className="font-display font-black text-white uppercase tracking-[0.3em] text-[10px]">Verificando Credenciais</h2>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      user, customRoles, login, register, updateProfile, logout,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin' || user?.role === 'sysadmin' || user?.role === 'superadmin' || false,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
