import { Platform, Share } from 'react-native';

export type ShareResult = 'copied' | 'shared' | 'failed';

/** Text teilen: native Freigabe-Auswahl (enthält „Kopieren“), im Web Zwischenablage. */
export async function shareText(text: string): Promise<ShareResult> {
  try {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
    await Share.share({ message: text });
    return 'shared';
  } catch {
    return 'failed';
  }
}
