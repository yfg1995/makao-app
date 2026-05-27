// Card Rush Arena – Auth context (Guest + Emergent Google).
import { router } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { api, setToken } from "@/src/services/api";

type AuthUser = any | null;
type AuthState = {
  user: AuthUser;
  loading: boolean;
  loginGuest: (name?: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.me();
      setUser(user);
    } catch {
      setUser(null);
    }
  }, []);

  const processSessionId = useCallback(async (sessionId: string) => {
    try {
      const { session_token, user } = await api.googleLogin(sessionId);
      await setToken(session_token);
      setUser(user);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      console.warn("[auth] google session exchange failed", e?.message);
    }
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      // Web: handle redirect fragments first.
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const hash = window.location.hash || "";
        const search = window.location.search || "";
        const fromHash = hash.match(/session_id=([^&]+)/)?.[1];
        const fromQuery = new URLSearchParams(search).get("session_id");
        const sid = fromHash || fromQuery;
        if (sid) {
          await processSessionId(sid);
          try {
            window.history.replaceState(null, "", window.location.pathname);
          } catch {}
          setLoading(false);
          return;
        }
      } else {
        // Mobile cold start fallback.
        try {
          const initial = await Linking.getInitialURL();
          if (initial) {
            const { queryParams } = Linking.parse(initial);
            const sid = (queryParams as any)?.session_id;
            if (sid) {
              await processSessionId(String(sid));
              setLoading(false);
              return;
            }
          }
        } catch {}
      }
      await refresh();
      setLoading(false);
    })();
  }, [refresh, processSessionId]);

  const loginGuest = useCallback(async (name?: string) => {
    const { session_token, user } = await api.guestLogin(name);
    await setToken(session_token);
    setUser(user);
    router.replace("/(tabs)/home");
  }, []);

  const loginGoogle = useCallback(async () => {
    let redirectUrl: string;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      redirectUrl = window.location.origin + "/";
    } else {
      redirectUrl = Linking.createURL("auth");
    }
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type !== "success" || !result.url) return;
    const parsed = Linking.parse(result.url);
    const sid =
      (parsed.queryParams as any)?.session_id ||
      result.url.match(/session_id=([^&#]+)/)?.[1];
    if (sid) {
      await processSessionId(String(sid));
    }
  }, [processSessionId]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {}
    await setToken(null);
    setUser(null);
    router.replace("/login");
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, loginGuest, loginGoogle, logout, refresh }),
    [user, loading, loginGuest, loginGoogle, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
