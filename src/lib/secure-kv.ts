import * as SecureStore from 'expo-secure-store';

// Speicher für die Auth-Sitzung (Access-/Refresh-Token) auf iOS und Android.
// SecureStore (Keychain/Keystore) hat Größengrenzen pro Wert; das Sitzungs-JSON wird deshalb
// in Blöcke zerlegt. Der verschlüsselte MMKV-Cache aus docs/05 §2.3 kommt mit dem Offline-Lesen (M7).

const CHUNK_SIZE = 1500;
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

// SecureStore erlaubt nur Schlüssel aus [A-Za-z0-9._-]; supabase-js nutzt z. B. „sb-<ref>-auth-token“.
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');
const countKey = (key: string) => `${safe(key)}.n`;
const chunkKey = (key: string, i: number) => `${safe(key)}.${i}`;

export const secureKv = {
  async getItem(key: string): Promise<string | null> {
    const count = Number(await SecureStore.getItemAsync(countKey(key), OPTIONS));
    if (!Number.isInteger(count) || count <= 0) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i), OPTIONS);
      if (part === null) return null; // unvollständig: lieber abmelden als ein defektes JSON liefern
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await secureKv.removeItem(key);
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(
        chunkKey(key, i),
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
        OPTIONS,
      );
    }
    await SecureStore.setItemAsync(countKey(key), String(count), OPTIONS);
  },

  async removeItem(key: string): Promise<void> {
    const count = Number(await SecureStore.getItemAsync(countKey(key), OPTIONS));
    if (Number.isInteger(count)) {
      for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(chunkKey(key, i), OPTIONS);
    }
    await SecureStore.deleteItemAsync(countKey(key), OPTIONS);
  },
};
