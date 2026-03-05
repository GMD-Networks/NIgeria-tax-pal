import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { api } from '@/services/api';


interface User {
  id: string;
  email: string;
  created_at: string;
  is_anonymous: boolean;
}

interface Session {
  access_token: string;
  user: User;
}

interface JwtPayload {
  roles?: string[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkAdminRole = useCallback(async (userId: string): Promise<boolean> => {
    try {
      // Decode JWT to check roles (included in token payload)
      const token = localStorage.getItem('auth_token');
      if (!token) return false;
      
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
      const roles: string[] = payload.roles || [];
      if (roles.includes('admin')) return true;

      // Fallback: query the API
      const { data, error } = await Promise.resolve(api.from('user_roles').select('*').eq('user_id', userId));
      if (error || !data) return false;
      if (!Array.isArray(data)) return false;

      return data.some((roleItem) => {
        if (!roleItem || typeof roleItem !== 'object') return false;
        return (roleItem as { role?: string }).role === 'admin';
      });
    } catch (err) {
      console.error('Error checking admin role:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const authStateResult = api.auth.onAuthStateChange(
      async (_event: string, newSession: Session | null) => {
        if (!mounted) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Token is auto-read from localStorage by both api.ts and cpanel-php.ts

        if (newSession?.user) {
          setTimeout(async () => {
            if (!mounted) return;
            const adminStatus = await checkAdminRole(newSession.user.id);
            if (mounted) {
              setIsAdmin(adminStatus);
              setIsLoading(false);
            }
          }, 0);
        } else {
          setIsAdmin(false);
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      authStateResult.data.subscription.unsubscribe();
    };
  }, [checkAdminRole]);

  const signIn = async (email: string, password: string) => {
    const { error } = await api.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await api.auth.signUp({ email, password });
    if (!error && data?.user) {
      // Try to send welcome email (non-blocking)
      api.functions.invoke('send-smtp-email', {
        body: {
          to: email,
          template: 'welcome',
          templateData: { name: email.split('@')[0] }
        }
      }).catch(err => console.log('Welcome email skipped:', err));
    }
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Token cleanup handled by api.auth.signOut()
    await api.auth.signOut();
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      isLoading, 
      isAdmin, 
      signIn, 
      signUp, 
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
