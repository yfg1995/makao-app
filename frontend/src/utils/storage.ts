import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  token: 'cra_session_token',
  settings: 'cra_settings',
};

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
  async getSettings(): Promise<any> {
    const s = await AsyncStorage.getItem(KEYS.settings);
    try { return s ? JSON.parse(s) : { sound: true, haptics: true }; } catch { return { sound: true, haptics: true }; }
  },
  async setSettings(v: any) {
    return AsyncStorage.setItem(KEYS.settings, JSON.stringify(v));
  }
};
