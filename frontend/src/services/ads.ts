// Mock AdMob service. Simulates a rewarded ad with a 1.2s delay.
// IMPORTANT: This is a placeholder. No real ads served.
import { api } from './api';

export const adsService = {
  isMock: true,
  async showRewardedAd(): Promise<{ ok: boolean; reward_coins?: number }> {
    await new Promise((r) => setTimeout(r, 1200));
    try {
      const { data } = await api.post('/ads/reward', {});
      return { ok: true, reward_coins: data.reward_coins };
    } catch (e) {
      return { ok: false };
    }
  }
};
