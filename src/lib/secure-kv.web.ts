// Web: localStorage (supabase-js-Standard). Der Schutz läuft über CSP und getrennte Origins
// für Web-Admin und Portal (docs/05 §2.3). Zugriffe sind abgesichert, weil localStorage im
// privaten Modus oder beim statischen Rendern fehlen kann.

const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const secureKv = {
  async getItem(key: string): Promise<string | null> {
    return storage()?.getItem(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    storage()?.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    storage()?.removeItem(key);
  },
};
