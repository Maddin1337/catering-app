import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { tokens } from '@/theme/tokens';

import { Text } from './text';
import { transition } from './transition';

/*
 * Code aus einzelnen Kästchen – nach „One-time code“ von Bencho (bencho.dev, MIT, © 2026 Lorenzo
 * Cabra), für React Native neu gebaut.
 *
 * Sechs Kästchen, aber EIN Feld: Ein unsichtbares Eingabefeld liegt darüber und bekommt alles, was
 * das System kann – Einfügen, „Code aus Mail/SMS“ des iPhones, Löschen. Die Kästchen zeigen nur an:
 * das aktive mit Ring und blinkendem Strich, ein neu getipptes Zeichen springt mit einer Feder hinein.
 */
export function CodeInput({
  label,
  value,
  onChange,
  length = 6,
  error,
  helper,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  length?: number;
  error?: string;
  helper?: string;
  autoFocus?: boolean;
}) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.slice(0, length).split('');
  const active = Math.min(digits.length, length - 1);

  return (
    <View style={styles.wrap}>
      <Text variant="small" color="textSecondary" style={styles.label}>
        {label}
      </Text>
      <Pressable onPress={() => input.current?.focus()} style={styles.boxes} accessible={false}>
        {Array.from({ length }, (_, i) => {
          const ch = digits[i];
          const on = focused && i === active && (!ch || digits.length === length);
          return (
            <View
              key={i}
              style={[
                styles.box,
                ch && styles.filled,
                on && styles.active,
                !!error && styles.error,
                transition(['borderColor', 'backgroundColor', 'boxShadow'], tokens.motion.fast),
              ]}
            >
              {ch ? (
                <Animated.View key={`${i}-${ch}`} entering={ZoomIn.springify().damping(12)}>
                  <Text variant="title1" tabular>
                    {ch}
                  </Text>
                </Animated.View>
              ) : on ? (
                <Animated.View style={[styles.caret, blink]} />
              ) : null}
            </View>
          );
        })}
        <TextInput
          ref={input}
          value={value}
          onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
          accessibilityLabel={label}
          accessibilityHint={error ?? helper}
          caretHidden
          // Unsichtbar über den Kästchen: tippen, einfügen und Autofill landen hier.
          style={styles.hidden}
        />
      </Pressable>
      {error ? (
        <Text variant="small" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="small" color="textTertiary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const blink = {
  animationName: { '0%': { opacity: 1 }, '50%': { opacity: 0 }, '100%': { opacity: 1 } },
  animationDuration: '1000ms',
  animationIterationCount: 'infinite',
} as const;

const styles = StyleSheet.create({
  wrap: { gap: tokens.space[2] },
  label: { fontFamily: tokens.font.semibold },
  boxes: { flexDirection: 'row', gap: tokens.space[2], justifyContent: 'space-between' },
  box: {
    flex: 1,
    maxWidth: 56,
    height: 60,
    borderRadius: tokens.radius.lg,
    borderWidth: 1.5,
    borderColor: tokens.color.borderInput,
    backgroundColor: tokens.color.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { borderColor: tokens.color.text, backgroundColor: tokens.color.bgSubtle },
  active: { borderColor: tokens.color.accent, boxShadow: '0px 0px 0px 3px #CDEFE8' },
  error: { borderColor: tokens.color.danger },
  caret: { width: 2, height: 26, borderRadius: 1, backgroundColor: tokens.color.accent },
  hidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.011,
    color: 'transparent',
    fontSize: 16,
  },
});
