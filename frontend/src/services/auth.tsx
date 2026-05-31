import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirebaseAuth } from '../../lib/firebase';
import { storage } from '../utils/storage';
import { api, API_BASE_URL } from './api';

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
  gender?: 'male' | 'female' | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInGuest: (username?: string, gender?: 'male' | 'female') => Promise<void>;
  registerWithEmail: (email: string, password: string, username?: string, gender?: 'male' | 'female') => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function backendAuthError(e: any, route: string) {
  const status = e?.response?.status;
  const detail = e?.response?.data?.detail;
  if (status === 404) {
    return new Error(
      `Game backend route ${route} was not found at ${API_BASE_URL}. ` +
      'Redeploy the backend/API on Vercel or set EXPO_PUBLIC_BACKEND_URL to the live backend URL.'
    );
  }
  if (typeof detail === 'string') return new Error(detail);
  if (detail?.message) return new Error(detail.message);
  if (e?.message?.includes('Network Error')) {
    return new Error('Cannot reach the game backend. Check EXPO_PUBLIC_BACKEND_URL and backend deployment.');
  }
  return e instanceof Error ? e : new Error('Could not reach the game backend.');
}

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

  const signInGuest = async (username?: string, gender?: 'male' | 'female') => {
    try {
      const credential = await signInAnonymously(getFirebaseAuth());
      await completeFirebaseSignIn(credential.user, username, gender);
    } catch {
      try {
        const { data } = await api.post('/auth/guest', { username: username || null, gender: gender || null });
        await storage.setToken(data.session_token);
        setUser(data.user);
      } catch (e: any) {
        throw backendAuthError(e, '/auth/guest');
      }
    }
  };

  const completeFirebaseSignIn = async (firebaseUser: FirebaseUser, username?: string, gender?: 'male' | 'female') => {
    const idToken = await firebaseUser.getIdToken();
    let data;
    try {
      const response = await api.post('/auth/firebase', {
        id_token: idToken,
        username: username || null,
        gender: gender || null,
      });
      data = response.data;
    } catch (e: any) {
      throw backendAuthError(e, '/auth/firebase');
    }
    await storage.setToken(data.session_token);
    setUser(data.user);
  };

  const registerWithEmail = async (email: string, password: string, username?: string, gender?: 'male' | 'female') => {
    const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    await completeFirebaseSignIn(credential.user, username, gender);
  };

  const loginWithEmail = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    await completeFirebaseSignIn(credential.user);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(getFirebaseAuth(), email);
  };

  const signOut = async () => {
    try { await api.post('/auth/logout', {}); } catch {}
    try { await firebaseSignOut(getFirebaseAuth()); } catch {}
    await storage.clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInGuest, registerWithEmail, loginWithEmail, resetPassword, signOut, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
