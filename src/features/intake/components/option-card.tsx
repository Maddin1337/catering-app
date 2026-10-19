import * as Haptics from 'expo-haptics';
import { Check, type LucideIcon } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { transition } from '@/components/ui/transition';
import { tokens } from '@/theme/tokens';

/**
 * Antwortkarte im Anfrage-Chat: groß, ein Tipp wählt. Die gewählte Karte bekommt einen Petrol-Rand
 * und einen sanften Grund, rechts springt ein Haken herein. `radio` ist für genau eine Antwort,
 * `check` für mehrere.
 */
export function OptionCard({
  label,
  hint,
  selected,
  onPress,
  indicator = 'radio',
  icon: Icon,
  compact,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  indicator?: 'radio' | 'check';
  icon?: LucideIcon;
  /** Für Ja/Nein nebeneinander: Symbol oben, Text darunter, zentriert. */
  compact?: boolean;
}) {
  return (
    <PressableScale
      accessibilityRole={indicator === 'check' ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
        onPress();
      }}
      scale={0.98}
      style={[
        styles.card,
        compact && styles.compact,
        selected && styles.selected,
        transition('background-color', tokens.motion.fast),
      ]}
    >
      {Icon ? (
        <View style={[styles.icon, selected && styles.iconSelected]}>
          <Icon
            color={selected ? tokens.color.onAccent : tokens.color.textSecondary}
            size={20}
            strokeWidth={2.4}
          />
        </View>
      ) : null}
      <View style={[styles.texts, compact && styles.textsCompact]}>
        <Text variant="bodyStrong" style={compact && styles.centered}>
          {label}
        </Text>
        {hint ? (
          <Text variant="small" color="textSecondary">
            {hint}
          </Text>
        ) : null}
      </View>
      {!compact ? (
        <View
          style={[
            styles.mark,
            indicator === 'check' && styles.markSquare,
            selected && styles.markOn,
            transition('background-color', tokens.motion.fast),
          ]}
        >
          {selected ? (
            <Animated.View entering={ZoomIn.springify().damping(14)}>
              <Check color={tokens.color.onAccent} size={14} strokeWidth={3.2} />
            </Animated.View>
          ) : null}
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    paddingHorizontal: tokens.space[4],
    paddingVertical: tokens.space[3],
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg,
    borderWidth: 1.5,
    borderColor: tokens.color.border,
  },
  compact: {
    flex: 1,
    minHeight: 112,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: tokens.space[2],
  },
  selected: { borderColor: tokens.color.accent, backgroundColor: tokens.color.accentSubtle },
  icon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.bgMuted,
  },
  iconSelected: { backgroundColor: tokens.color.accent },
  texts: { flex: 1, gap: 2 },
  textsCompact: { flex: 0, alignItems: 'center' },
  centered: { textAlign: 'center' },
  mark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: tokens.color.borderInput,
    backgroundColor: tokens.color.bg,
  },
  markSquare: { borderRadius: 8 },
  markOn: { backgroundColor: tokens.color.accent, borderColor: tokens.color.accent },
});
