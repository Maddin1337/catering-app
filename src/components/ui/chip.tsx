import * as Haptics from 'expo-haptics';
import { Check, type LucideIcon } from 'lucide-react-native';
import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { tokens } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

/**
 * Auswahl-Chip für Filter und Kennzeichen: sichtbar 38 dp hoch, die Tippfläche reicht bis 46 dp.
 * Gewählt füllt er sich dunkel und zeigt einen Haken, der weich hereinkommt.
 */
export function Chip({
  label,
  selected,
  onPress,
  icon: Icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Symbol vor dem Text (z. B. Filter); ersetzt dann den Haken. */
  icon?: LucideIcon;
}) {
  return (
    <PressableScale
      scale={0.94}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      disabled={!onPress}
      hitSlop={4}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
        onPress?.();
      }}
      style={[styles.chip, selected && styles.on, colorFade]}
    >
      {Icon ? (
        <Icon
          color={selected ? tokens.color.onAccent : tokens.color.text}
          size={16}
          strokeWidth={2.2}
        />
      ) : selected ? (
        <Animated.View entering={FadeIn.duration(tokens.motion.fast)} exiting={FadeOut}>
          <Check color={tokens.color.onAccent} size={14} strokeWidth={3} />
        </Animated.View>
      ) : null}
      <Text variant="small" color={selected ? 'onAccent' : 'text'} style={styles.label}>
        {label}
      </Text>
    </PressableScale>
  );
}

// Reanimated-CSS-Übergang: Füllung und Rand wechseln weich statt hart.
const colorFade = {
  transitionProperty: ['backgroundColor', 'borderColor'],
  transitionDuration: tokens.motion.base,
} as ViewStyle;

const styles = StyleSheet.create({
  label: { fontFamily: tokens.font.semibold },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tokens.space[4],
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.bg,
  },
  on: { backgroundColor: tokens.color.ink, borderColor: tokens.color.ink },
});
