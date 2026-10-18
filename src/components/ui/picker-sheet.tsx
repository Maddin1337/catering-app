import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Schließen">
        <Pressable
          style={[styles.sheet, { paddingBottom: tokens.space[5] + insets.bottom }]}
          onPress={() => undefined}
        >
          <View style={styles.handle} />
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
    backgroundColor: tokens.color.scrim,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    backgroundColor: tokens.color.bg,
    borderTopLeftRadius: tokens.radius.xxl,
    borderTopRightRadius: tokens.radius.xxl,
    paddingHorizontal: tokens.space[5],
    paddingTop: tokens.space[2],
    boxShadow: tokens.shadow.float,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: tokens.color.border,
    marginBottom: tokens.space[4],
  },
});
