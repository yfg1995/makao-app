// Mock AdMob service. Calls server-side /ads/watch (paired, capped) endpoint.
// IMPORTANT: This is a placeholder. NO real ads are served. The 5-second
// countdown timer lives in <AdSimulatorModal/> on the UI side.
import { api } from './api';

export interface AdProgress {
  watched_today: number;
  daily_cap: number;
  pair_size: number;
  reward_per_pair: number;
  next_reward_in: number;
  daily_cap_reached: boolean;
  coins_earned_today: number;
  max_coins_today: number;
}

export const adsService = {
  isMock: true as const,

  async getProgress(): Promise<AdProgress | null> {
    try {
      const { data } = await api.get('/ads/progress');
      return data;
    } catch {
      return null;
    }
  },

  /** Record one completed ad watch. Server enforces pacing + daily cap. */
  async recordWatch(): Promise<{ ok: boolean; granted_coins?: number; watched_today?: number; daily_cap_reached?: boolean; message?: string }> {
    try {
      const { data } = await api.post('/ads/watch', {});
      return { ok: true, ...data };
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      return { ok: false, message: typeof detail === 'string' ? detail : detail?.message };
    }
  },
};
