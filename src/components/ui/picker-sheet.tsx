import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { tokens } from '@/theme/tokens';

import { Text } from './text';

/** Unteres Blatt für Auswahlen (Datum, Uhrzeit): schließt per Tippen daneben und per Zurück-Taste. */
export function PickerSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Schließen">
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <ScrollView
            contentContainerStyle={{ gap: tokens.space[3] }}
            keyboardShouldPersistTaps="handled"
          >
            <Text variant="title2" accessibilityRole="header">
              {title}
            </Text>
            <View style={{ gap: tokens.space[3] }}>{children}</View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    backgroundColor: tokens.color.bg,
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    padding: tokens.space[5],
  },
});
