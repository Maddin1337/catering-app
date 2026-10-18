import { useEffect, useId, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { tokens } from '@/theme/tokens';

import { Text } from './text';
import { transition } from './transition';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  helper?: string;
  /** Passwortfeld mit „Anzeigen/Verbergen“. */
  revealable?: boolean;
  showLabel?: string;
  hideLabel?: string;
};

const H = 58;
// Größe des gehobenen Labels im Verhältnis zur ruhenden.
const LIFTED = 0.78;

/*
 * Eingabefeld mit schwebendem Label – nach „Label input“ von Bencho (bencho.dev, MIT, © 2026
 * Lorenzo Cabra), für React Native neu gebaut.
 *
 * Leer und ohne Fokus steht das Label wie ein Platzhalter im Feld. Beim Fokus oder sobald etwas
 * drinsteht, hebt es sich an den oberen Rand und wird kleiner; die Eingabe rückt darunter. So steht
 * die Beschriftung immer am Feld, ohne eine eigene Zeile darüber zu brauchen. Fehler lassen das Feld
 * einmal kurz zittern. Eingaben bleiben 16 px, damit iOS Safari im Web nicht zoomt (docs/04 §4.4).
 */
export function TextField({
  label,
  error,
  helper,
  revealable,
  showLabel = 'Anzeigen',
  hideLabel = 'Verbergen',
  secureTextEntry,
  onFocus,
  onBlur,
  onChangeText,
  placeholder,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState(String(rest.defaultValue ?? ''));
  const hidden = revealable ? !revealed : secureTextEntry;
  const sensitive = !!revealable || !!secureTextEntry;
  const value = rest.value !== undefined ? String(rest.value ?? '') : typed;
  const lifted = focused || value.length > 0 || !!rest.multiline;

  const lift = useSharedValue(lifted ? 1 : 0);
  const shake = useSharedValue(0);
  useEffect(() => {
    lift.set(withSpring(lifted ? 1 : 0, { damping: 18, stiffness: 260, mass: 0.7 }));
  }, [lifted, lift]);
  useEffect(() => {
    if (!error) return;
    // Einmal kurz zittern, wenn ein Fehler erscheint (folgt „Bewegung reduzieren“).
    shake.set(0);
    shake.set(withTiming(1, { duration: 380 }));
  }, [error, shake]);

  const labelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(lift.get(), [0, 1], [0, -11]) },
      { scale: interpolate(lift.get(), [0, 1], [1, LIFTED]) },
    ],
    color: interpolateColor(
      lift.get(),
      [0, 1],
      [
        tokens.color.textTertiary,
        error ? tokens.color.danger : focused ? tokens.color.accent : tokens.color.textSecondary,
      ],
    ),
  }));
  const shakeStyle = useAnimatedStyle(() => {
    const t = shake.get();
    return {
      transform: [{ translateX: t > 0 && t < 1 ? Math.sin(t * Math.PI * 6) * 6 * (1 - t) : 0 }],
    };
  });

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.field,
          rest.multiline && styles.fieldMulti,
          {
            borderColor: error
              ? tokens.color.danger
              : focused
                ? tokens.color.accent
                : tokens.color.borderInput,
            boxShadow: focused ? `0px 0px 0px 3px ${error ? '#FBD5D2' : '#CDEFE8'}` : undefined,
          },
          transition(['borderColor', 'boxShadow'], tokens.motion.fast),
          shakeStyle,
        ]}
      >
        <Animated.Text
          nativeID={id}
          numberOfLines={1}
          pointerEvents="none"
          style={[
            styles.label,
            rest.multiline ? styles.labelMulti : styles.labelSingle,
            labelStyle,
          ]}
        >
          {label}
        </Animated.Text>
        <TextInput
          accessibilityLabel={label}
          accessibilityLabelledBy={id}
          accessibilityHint={error ?? helper}
          placeholderTextColor={tokens.color.textTertiary}
          // Platzhalter erst, wenn das Label oben ist – sonst stünden beide übereinander.
          placeholder={lifted ? placeholder : undefined}
          // Passwörter nie autokorrigieren oder rechtschreibprüfen (Web sendet sie sonst ggf. an den Browser-Dienst).
          autoCorrect={sensitive ? false : undefined}
          spellCheck={sensitive ? false : undefined}
          {...rest}
          secureTextEntry={hidden}
          onChangeText={(v) => {
            setTyped(v);
            onChangeText?.(v);
          }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, rest.multiline && styles.multiline]}
        />
        {revealable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? hideLabel : showLabel}
            hitSlop={8}
            onPress={() => setRevealed((r) => !r)}
            style={styles.reveal}
          >
            <Text variant="small" color="accent">
              {revealed ? hideLabel : showLabel}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
      {error ? (
        <Text variant="small" color="danger" accessibilityRole="alert" style={styles.note}>
          {error}
        </Text>
      ) : helper ? (
        <Text variant="small" color="textTertiary" style={styles.note}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space[1] },
  field: {
    minHeight: H,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1.5,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.bg,
    paddingHorizontal: tokens.space[4],
  },
  fieldMulti: { alignItems: 'stretch', paddingTop: 22 },
  label: {
    position: 'absolute',
    left: tokens.space[4],
    right: tokens.space[4],
    fontFamily: tokens.font.medium,
    fontSize: 16,
    lineHeight: 22,
    transformOrigin: 'left',
  },
  labelSingle: { top: (H - 3 - 22) / 2 },
  labelMulti: { top: 17 },
  input: {
    flex: 1,
    height: H - 3 - 6,
    paddingTop: 16,
    fontFamily: tokens.font.regular,
    fontSize: 16,
    color: tokens.color.text,
    // Der Rahmen des Feldes zeigt den Fokus; kein zweiter Browser-Rahmen im Web.
    outlineWidth: 0,
  },
  multiline: {
    height: undefined,
    minHeight: 110,
    paddingTop: 6,
    paddingBottom: tokens.space[3],
    textAlignVertical: 'top',
  },
  reveal: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: tokens.space[2],
    alignSelf: 'center',
  },
  note: { paddingHorizontal: tokens.space[1] },
});
