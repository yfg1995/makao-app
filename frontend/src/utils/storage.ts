import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  token: 'cra_session_token',
  settings: 'cra_settings',
};

export interface AppSettings {
  sound: boolean;
  haptics: boolean;
}

const DEFAULT_SETTINGS: AppSettings = { sound: true, haptics: true };

export const storage = {
  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.token);
  },
  async setToken(t: string) {
    return AsyncStorage.setItem(KEYS.token, t);
  },
  async clearToken() {
    return AsyncStorage.removeItem(KEYS.token);
  },
  async getSettings(): Promise<AppSettings> {
    const s = await AsyncStorage.getItem(KEYS.settings);
    try { return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS; } catch { return DEFAULT_SETTINGS; }
  },
  async setSettings(v: AppSettings) {
    return AsyncStorage.setItem(KEYS.settings, JSON.stringify(v));
  }
};
