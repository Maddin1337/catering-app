import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { tokens } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Sheet } from './sheet';
import { Text } from './text';

export type SheetAction = {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  /** Rot hervorgehoben (z. B. Stornieren, Löschen). */
  destructive?: boolean;
  hint?: string;
};

/** Menü als unteres Blatt (Überlauf „⋯“, Schnellanlage): große Zeilen mit Symbol, gut mit dem Daumen erreichbar. */
export function ActionSheet({
  title,
  actions,
  onClose,
}: {
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      {(close) => (
        <View style={styles.group}>
          {actions.map((a, i) => {
            const fg = a.destructive ? tokens.color.danger : tokens.color.text;
            return (
              <PressableScale
                key={a.label}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                scale={0.98}
                // Erst schließen, dann handeln: Navigation und Dialoge lägen sonst unter dem Blatt.
                onPress={() => close(a.onPress)}
                pressedStyle={{ backgroundColor: tokens.color.bgMuted }}
                style={[styles.row, i > 0 && styles.divider]}
              >
                {a.icon ? (
                  <View
                    style={[
                      styles.icon,
                      {
                        backgroundColor: a.destructive
                          ? tokens.color.dangerSubtle
                          : tokens.color.bgMuted,
                      },
                    ]}
                  >
                    <a.icon color={fg} size={20} strokeWidth={2.1} />
                  </View>
                ) : null}
                <View style={styles.texts}>
                  <Text variant="bodyStrong" style={{ color: fg }}>
                    {a.label}
                  </Text>
                  {a.hint ? (
                    <Text variant="small" color="textSecondary">
                      {a.hint}
                    </Text>
                  ) : null}
                </View>
              </PressableScale>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bgSubtle,
    overflow: 'hidden',
  },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    paddingHorizontal: tokens.space[4],
    paddingVertical: tokens.space[2],
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.color.border },
  icon: {
    width: 38,
    height: 38,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
});
