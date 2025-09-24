import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager, focusManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

// 24 hours in milliseconds
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const CACHE_BUSTER = 'offline-v1';
const PERSIST_KEY = `rq-cache-${CACHE_BUSTER}`;

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_KEY,
});

let onlineManagerWired = false;
export function setupOnlineManager(): void {
  if (onlineManagerWired) return;
  onlineManagerWired = true;
  // Hook React Query online state into React Native NetInfo
  onlineManager.setEventListener((setOnline) => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected) && (state.isInternetReachable ?? true);
      setOnline(isOnline);
    });
    return () => unsubscribe();
  });
}

let focusManagerWired = false;
export function setupFocusManager(): void {
  if (focusManagerWired) return;
  focusManagerWired = true;
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (state) => {
      handleFocus(state === 'active');
    });
    return () => subscription.remove();
  });
}

// Cache buster for versioned persistence. Change this to invalidate old persisted cache.
export async function ensureVersionAndCleanup(): Promise<void> {
  try {
    const versionKey = 'rq-cache-version';
    const current = await AsyncStorage.getItem(versionKey);
    if (current === CACHE_BUSTER) return;
    // Remove legacy keys
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter((k) => k === 'rq-cache' || k.startsWith('rq-cache-'));
    if (toRemove.length) {
      await AsyncStorage.multiRemove(toRemove);
    }
    await AsyncStorage.setItem(versionKey, CACHE_BUSTER);
  } catch {}
}


