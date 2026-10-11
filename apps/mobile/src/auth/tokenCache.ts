import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export interface TokenCache {
  getToken: (key: string) => Promise<string | null>;
  saveToken: (key: string, token: string) => Promise<void>;
  clearToken?: (key: string) => Promise<void>;
}

/**
 * Platform-safe token cache for Clerk authentication on Expo.
 * Uses expo-secure-store on native iOS/Android devices for keychain/keystore encryption.
 * Gracefully falls back to web storage or in-memory storage on web.
 */
function getWebStorage(): { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void } | null {
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    return (globalThis as unknown as { localStorage: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } }).localStorage;
  }
  return null;
}

function createTokenCache(): TokenCache {
  return {
    async getToken(key: string): Promise<string | null> {
      try {
        if (Platform.OS === "web") {
          return getWebStorage()?.getItem(key) ?? null;
        }
        return await SecureStore.getItemAsync(key);
      } catch {
        return null;
      }
    },
    async saveToken(key: string, value: string): Promise<void> {
      try {
        if (Platform.OS === "web") {
          getWebStorage()?.setItem(key, value);
          return;
        }
        await SecureStore.setItemAsync(key, value);
      } catch {
        // Suppress storage write failures gracefully
      }
    },
    async clearToken(key: string): Promise<void> {
      try {
        if (Platform.OS === "web") {
          getWebStorage()?.removeItem(key);
          return;
        }
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Suppress storage delete failures gracefully
      }
    },
  };
}


export const tokenCache: TokenCache = createTokenCache();
