import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'sweetin' });

/** Façade compatible AsyncStorage, adossée à MMKV (stockage natif synchrone). */
export const kv = {
  getItem: async (key: string): Promise<string | null> => Promise.resolve(storage.getString(key) ?? null),
  setItem: async (key: string, value: string): Promise<void> => {
    storage.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    storage.remove(key);
  },
};

export default kv;
