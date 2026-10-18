import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { surfaceStyle } from '@/components/ui/surface';
import { tokens } from '@/theme/tokens';

export type QuickAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  /** Die Hauptaktion bekommt den Marken-Verlauf. */
  primary?: boolean;
};

/** Zwei große Schnellaktionen nebeneinander (neue Anfrage per Chat oder Formular). */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <View style={styles.row}>
      {actions.map(({ key, label, icon: Icon, onPress, primary }) => (
        <PressableScale
          key={key}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          scale={0.97}
          style={[styles.tile, primary ? styles.primary : surfaceStyle()]}
        >
          {primary ? (
            <LinearGradient
              colors={[tokens.color.accentGradientFrom, tokens.color.accentGradientTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={[styles.icon, primary ? styles.iconOnPrimary : styles.iconPlain]}>
            <Icon
              color={primary ? tokens.color.onAccent : tokens.color.accent}
              size={22}
              strokeWidth={2.1}
            />
          </View>
          <Text variant="bodyStrong" color={primary ? 'onAccent' : 'text'}>
            {label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: tokens.space[3] },
  tile: {
    flex: 1,
    minHeight: 104,
    padding: tokens.space[4],
    justifyContent: 'space-between',
    gap: tokens.space[3],
    overflow: 'hidden',
  },
  primary: {
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.accent,
    boxShadow: tokens.shadow.accent,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOnPrimary: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
  iconPlain: { backgroundColor: tokens.color.accentSubtle },
});
