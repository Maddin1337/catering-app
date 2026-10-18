import * as Haptics from 'expo-haptics';
import { Search, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { tokens } from '@/theme/tokens';

/*
 * Ausklappende Suche – nach „Seek“ von Bencho (bencho.dev, MIT, © 2026 Lorenzo Cabra), für React
 * Native neu gebaut.
 *
 * Ein Objekt, nicht zwei: Die runde Lupe wird selbst zum Suchfeld, ihre Breite ist der Zustand. Die
 * Filter daneben (`children`) treten zur Seite, solange gesucht wird, und kommen beim Schließen
 * zurück. Steht noch ein Suchbegriff drin, bleibt das Feld offen.
 */

const SIZE = 44;

export function SearchToggle({
  label,
  value,
  onChangeText,
  clearLabel = 'Leeren',
  openLabel = 'Suchen',
  children,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  clearLabel?: string;
  openLabel?: string;
  /** Was neben der geschlossenen Lupe steht, z. B. eine `ChipRow`. */
  children?: ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState(value.length > 0);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const o = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    o.set(withSpring(open ? 1 : 0, { damping: 20, stiffness: 260, mass: 0.8 }));
    if (open) setTimeout(() => input.current?.focus(), 60);
  }, [open, o]);

  const field = useAnimatedStyle(() => ({
    width: width > 0 ? SIZE + (width - SIZE) * o.get() : SIZE,
  }));
  const inner = useAnimatedStyle(() => ({
    opacity: interpolate(o.get(), [0.35, 1], [0, 1], 'clamp'),
  }));
  const side = useAnimatedStyle(() => ({
    opacity: 1 - o.get(),
    transform: [{ translateX: 16 * o.get() }],
  }));

  return (
    <View style={styles.row} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {children ? (
        <Animated.View
          style={[styles.side, side]}
          pointerEvents={open ? 'none' : 'box-none'}
          importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.field, field]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={openLabel}
          disabled={open}
          onPress={() => {
            if (Platform.OS !== 'web') void Haptics.selectionAsync();
            setOpen(true);
          }}
          style={styles.lens}
        >
          <Search
            color={open ? tokens.color.textTertiary : tokens.color.text}
            size={20}
            strokeWidth={2.2}
          />
        </Pressable>
        {open ? (
          <Animated.View style={[styles.inner, inner]}>
            <TextInput
              ref={input}
              accessibilityLabel={label}
              placeholder={label}
              placeholderTextColor={tokens.color.textTertiary}
              returnKeyType="search"
              autoCorrect={false}
              value={value}
              onChangeText={onChangeText}
              onBlur={() => {
                if (!value) setOpen(false);
              }}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={clearLabel}
              hitSlop={8}
              onPress={() => {
                onChangeText('');
                setOpen(false);
              }}
              style={styles.clear}
            >
              <X color={tokens.color.textSecondary} size={18} strokeWidth={2.4} />
            </Pressable>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: SIZE + 4, justifyContent: 'center' },
  side: {
    position: 'absolute',
    left: SIZE + tokens.space[2],
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  field: {
    height: SIZE,
    borderRadius: SIZE / 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.color.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    boxShadow: tokens.shadow.card,
    overflow: 'hidden',
  },
  lens: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  inner: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    height: SIZE,
    fontFamily: tokens.font.regular,
    fontSize: 16,
    color: tokens.color.text,
    outlineWidth: 0,
  },
  clear: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
});
