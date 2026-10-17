import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/theme/tokens';

import { Text } from './text';

/** Seitenrahmen für Formularseiten: sicherer Bereich, Tastatur, begrenzte Breite im Web. */
export function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + tokens.space[8],
            paddingBottom: insets.bottom + tokens.space[6],
          },
        ]}
      >
        <View style={styles.column}>
          <View style={styles.header}>
            <Text variant="title1" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="body" color="textSecondary">
                {subtitle}
              </Text>
            ) : null}
          </View>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: tokens.color.bg },
  content: { flexGrow: 1, paddingHorizontal: tokens.space[4], alignItems: 'center' },
  column: { width: '100%', maxWidth: 440, gap: tokens.space[6] },
  header: { gap: tokens.space[2] },
});
