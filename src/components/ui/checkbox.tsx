import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { tokens } from '@/theme/tokens';

import { Text } from './text';

/** Checkbox mit Text daneben; die ganze Zeile ist tippbar (Ziel ≥ 48 dp). */
export function Checkbox({
  label,
  checked,
  onChange,
  error,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={() => {
          if (Platform.OS !== 'web') void Haptics.selectionAsync();
          onChange(!checked);
        }}
        style={styles.row}
      >
        <Animated.View
          style={[styles.box, checked && styles.boxOn, !!error && styles.boxError, colorFade]}
        >
          {checked ? (
            <Animated.View entering={ZoomIn.springify().damping(12)}>
              <Check color={tokens.color.onAccent} size={16} strokeWidth={3.2} />
            </Animated.View>
          ) : null}
        </Animated.View>
        <View style={styles.label}>
          <Text variant="body">{label}</Text>
        </View>
      </Pressable>
      {error ? (
        <Text variant="small" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const colorFade = {
  transitionProperty: ['backgroundColor', 'borderColor'],
  transitionDuration: tokens.motion.fast,
} as ViewStyle;

const styles = StyleSheet.create({
  wrap: { gap: tokens.space[1] },
  row: {
    minHeight: tokens.touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: tokens.radius.sm,
    borderWidth: 2,
    borderColor: tokens.color.borderInput,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.bg,
  },
  boxOn: { backgroundColor: tokens.color.accent, borderColor: tokens.color.accent },
  boxError: { borderColor: tokens.color.danger },
  label: { flex: 1 },
});
