import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const REFRESH_TOKEN_KEY = 'app-finance.refreshToken';

// expo-secure-store wraps the OS keychain/keystore and has no web
// implementation; fall back to localStorage there (dev/web preview only —
// the shipped app targets iOS/Android, where SecureStore is always used).
const isWeb = Platform.OS === 'web';

export async function getStoredRefreshToken(): Promise<string | null> {
  if (isWeb) {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  }
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setStoredRefreshToken(token: string): Promise<void> {
  if (isWeb) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function clearStoredRefreshToken(): Promise<void> {
  if (isWeb) {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
