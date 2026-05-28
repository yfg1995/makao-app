import { AxiosHeaders, create, type AxiosInstance } from 'axios';
import { storage } from '../utils/storage';

const RAW_BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_BACKEND_URL || '').replace(/\/$/, '');
const API_BASE = RAW_BASE ? `${RAW_BASE}/api` : '/api';

export const api: AxiosInstance = create({
  baseURL: API_BASE,
  timeout: 15000,
  withCredentials: false,
});

api.interceptors.request.use(async (config) => {
  const tok = await storage.getToken();
  if (tok) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set('Authorization', `Bearer ${tok}`);
    headers.set('X-Session-Token', tok);
    config.headers = headers;
  }
  return config;
});

export const API_BASE_URL = API_BASE;
