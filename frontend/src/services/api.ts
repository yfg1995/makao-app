import { AxiosHeaders, create, type AxiosInstance } from 'axios';
import { storage } from '../utils/storage';

const RAW_BACKEND_URL = (
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_BACKEND_URL ||
  ''
).trim();
const NORMALIZED_BACKEND_URL = RAW_BACKEND_URL.replace(/\/$/, '');
const API_BASE = NORMALIZED_BACKEND_URL ? `${NORMALIZED_BACKEND_URL}/api` : '/api';

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
export const BACKEND_BASE_URL = NORMALIZED_BACKEND_URL;
