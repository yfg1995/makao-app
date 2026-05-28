import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirebaseAuth } from '../../lib/firebase';
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
  registerWithEmail: (email: string, password: string, username?: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
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
    } catch {
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

  const completeFirebaseSignIn = async (firebaseUser: FirebaseUser, username?: string) => {
    const idToken = await firebaseUser.getIdToken();
    const { data } = await api.post('/auth/firebase', {
      id_token: idToken,
      username: username || null,
    });
    await storage.setToken(data.session_token);
    setUser(data.user);
  };

  const registerWithEmail = async (email: string, password: string, username?: string) => {
    const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    await completeFirebaseSignIn(credential.user, username);
  };

  const loginWithEmail = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    await completeFirebaseSignIn(credential.user);
  };

  const signOut = async () => {
    try { await api.post('/auth/logout', {}); } catch {}
    try { await firebaseSignOut(getFirebaseAuth()); } catch {}
    await storage.clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInGuest, registerWithEmail, loginWithEmail, signOut, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
