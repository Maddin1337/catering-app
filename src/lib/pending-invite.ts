import { secureKv } from '@/lib/secure-kv';

// Einladungstoken, der eine Registrierung oder Anmeldung überdauert (Bestätigungslink, Neustart der App).
const KEY = 'pending-invite';

export const pendingInvite = {
  get: () => secureKv.getItem(KEY).catch(() => null),
  set: (token: string) => secureKv.setItem(KEY, token).catch(() => undefined),
  clear: () => secureKv.removeItem(KEY).catch(() => undefined),
};
