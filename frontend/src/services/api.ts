// Card Rush Arena – API client (typed wrapper).
import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export const TOKEN_KEY = "cra_session_token";

async function getToken(): Promise<string | null> {
  return await storage.secureGet<string>(TOKEN_KEY, "");
}

export async function setToken(t: string | null): Promise<void> {
  if (!t) {
    await storage.secureRemove(TOKEN_KEY);
  } else {
    await storage.secureSet(TOKEN_KEY, t);
  }
}

async function req<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const detail = body?.detail || body?.raw || `HTTP ${res.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return body as T;
}

export const api = {
  guestLogin: (username?: string) =>
    req<{ session_token: string; user: any }>("/auth/guest", {
      method: "POST",
      body: JSON.stringify({ username }),
    }),
  googleLogin: (session_id: string) =>
    req<{ session_token: string; user: any }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ session_id }),
    }),
  me: () => req<{ user: any }>("/auth/me"),
  logout: () => req("/auth/logout", { method: "POST" }),
  finishMatch: (payload: {
    mode: "casual" | "ranked" | "private";
    placement: number;
    cards_left: number;
    action_cards_played: number;
    duration_seconds: number;
  }) => req<any>("/matches/finish", { method: "POST", body: JSON.stringify(payload) }),
  matchHistory: () => req<{ items: any[] }>("/matches/history"),
  dailyStatus: () => req<any>("/rewards/daily/status"),
  dailyClaim: () => req<any>("/rewards/daily/claim"),
  missions: () => req<{ missions: any[] }>("/missions"),
  claimMission: (mission_id: string) =>
    req<any>("/missions/claim", { method: "POST", body: JSON.stringify({ mission_id }) }),
  leaderboard: () => req<{ items: any[] }>("/leaderboard"),
  shop: () => req<any>("/shop"),
  purchase: (item_id: string) =>
    req<any>("/shop/purchase", { method: "POST", body: JSON.stringify({ item_id }) }),
  selectCosmetic: (kind: "card_back" | "table_theme", item_id: string) =>
    req<any>("/users/me/cosmetics/select", { method: "POST", body: JSON.stringify({ kind, item_id }) }),
  claimAd: (reward_type: string, match_ref?: string) =>
    req<any>("/ads/claim", { method: "POST", body: JSON.stringify({ reward_type, match_ref }) }),
  adminUsers: () => req<{ items: any[] }>("/admin/users"),
  adminGrant: (params: { coins?: number; tickets?: number; rank_points?: number }) => {
    const q = new URLSearchParams();
    if (params.coins) q.set("coins", String(params.coins));
    if (params.tickets) q.set("tickets", String(params.tickets));
    if (params.rank_points) q.set("rank_points", String(params.rank_points));
    return req<any>(`/admin/grant?${q.toString()}`, { method: "POST" });
  },
  adminSeedBots: () => req<{ seeded: number }>("/admin/seed-bots", { method: "POST" }),
  adminResetMissions: () => req<any>("/admin/reset-missions", { method: "POST" }),
};
