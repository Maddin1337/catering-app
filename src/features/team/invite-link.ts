import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { webUrl } from '@/lib/env';

/**
 * Link, den der Admin weitergibt. Er führt im Web direkt zur Einladung; wer die App schon hat,
 * landet über denselben Pfad im Annehmen-Bildschirm (SC-06).
 */
export function buildInviteLink(token: string): string {
  const path = `/invite/${token}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined')
    return `${window.location.origin}${path}`;
  if (webUrl) return `${webUrl}${path}`;
  return Linking.createURL(path);
}
