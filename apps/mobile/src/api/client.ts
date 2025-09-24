import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const API_BASE_URL: string =
  // Prefer explicit extra from app config
  (Constants?.expoConfig?.extra as any)?.API_BASE ||
  // Fallback for some environments
  (Constants as any)?.manifestExtra?.API_BASE ||
  // Android emulator default to host machine
  'http://10.0.2.2:4000';

export const ADMIN_BASE_URL: string =
  ((Constants?.expoConfig?.extra as any)?.ADMIN_BASE as string | undefined) ||
  (Constants as any)?.manifestExtra?.ADMIN_BASE ||
  'http://10.0.2.2:3000';

type FetchOptions = RequestInit & { timeoutMs?: number };

export function resolveAbsoluteUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    // If relative and looks like media path, prefer ADMIN_BASE
    const base = url.startsWith('/uploads') || url.startsWith('/media') ? ADMIN_BASE_URL : API_BASE_URL;
    const u = new URL(url, base);
    if (Platform.OS === 'android') {
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '0.0.0.0' || u.hostname === '::1') {
        u.hostname = '10.0.2.2';
      }
    }
    return u.toString();
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 12000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const text = await res.text();
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson && text ? JSON.parse(text) : (text as unknown as T);

    if (!res.ok) {
      // Normalize not found for detail endpoints to non-throwing shape
      if (res.status === 404) {
        return { data: null, notFound: true } as unknown as T;
      }
      const message = (data as any)?.message || `${res.status} ${res.statusText}`;
      const error = new Error(message);
      (error as any).status = res.status;
      throw error;
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}


