import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { tokens } from '@/theme/tokens';

/**
 * Waagerecht wischbare Chip-Reihe, die bis an den Bildschirmrand läuft: viele Filter brauchen
 * so nur eine Zeile statt mehrerer umbrochener.
 */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -tokens.space[4], flexGrow: 0 },
  row: {
    gap: tokens.space[2],
    paddingHorizontal: tokens.space[4],
    paddingVertical: 2,
    alignItems: 'center',
  },
});
