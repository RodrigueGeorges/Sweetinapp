import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY doivent être définis (voir .env.example).');
}

// La session dort chiffrée (Keychain iOS / Keystore Android). AsyncStorage sert de repli
// pour les rares sessions de plus de ~2 Ko que le Keychain refuse, et de migration
// pour les sessions déjà posées par les versions précédentes.
const storage: SupportedStorage = {
  getItem: async (k) => {
    const secure = await SecureStore.getItemAsync(k).catch(() => null);
    if (secure) return secure;
    const legacy = await AsyncStorage.getItem(k).catch(() => null);
    if (legacy && legacy.length <= 2048) SecureStore.setItemAsync(k, legacy).catch(() => {});
    return legacy;
  },
  setItem: async (k, v) => {
    if (v.length > 2048) await AsyncStorage.setItem(k, v).catch(() => {});
    else await SecureStore.setItemAsync(k, v).catch(() => {});
  },
  removeItem: async (k) => {
    await Promise.all([SecureStore.deleteItemAsync(k).catch(() => {}), AsyncStorage.removeItem(k).catch(() => {})]);
  },
};

export const supabase = createClient<Database>(url, key, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// rafraîchit la session seulement quand l'app est au premier plan
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
