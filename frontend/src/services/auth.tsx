import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { storage } from '../utils/storage';
import { api } from './api';

export interface User {
  id: string;
  username: string;
  email?: string | null;
  picture?: string | null;
  coins: number;
  tickets: number;
  rank_points: number;
  league: string;
  level: number;
  xp: number;
  daily_streak: number;
  last_daily_claim?: string | null;
  guest_mode: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInGuest: (username?: string) => Promise<void>;
  signInWithEmergent: (sessionId: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const tok = await storage.getToken();
      if (!tok) { setUser(null); return; }
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch (e) {
      setUser(null);
      await storage.clearToken();
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const signInGuest = async (username?: string) => {
    const { data } = await api.post('/auth/guest', { username: username || null });
    await storage.setToken(data.session_token);
    setUser(data.user);
  };

  const signInWithEmergent = async (sessionId: string) => {
    const { data } = await api.post('/auth/session', null, { headers: { 'X-Session-ID': sessionId } });
    await storage.setToken(data.session_token);
    setUser(data.user);
  };

  const signOut = async () => {
    try { await api.post('/auth/logout', {}); } catch {}
    await storage.clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInGuest, signInWithEmergent, signOut, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
