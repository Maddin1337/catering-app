import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { tokens } from '@/theme/tokens';

import { Surface } from './surface';
import { Text } from './text';

/** Abschnitt eines Formulars: Überschrift über einer weißen Karte, die zusammengehörige Felder bündelt. */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="title2" accessibilityRole="header">
        {title}
      </Text>
      <Surface style={styles.card}>{children}</Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: tokens.space[2] },
  card: { gap: tokens.space[4], padding: tokens.space[4] },
});
