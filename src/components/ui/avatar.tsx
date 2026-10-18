import { StyleSheet, View } from 'react-native';

import { tints, type Tint } from '@/theme/tokens';

import { Text } from './text';

const ORDER: Tint[] = ['teal', 'amber', 'indigo', 'rose', 'sky', 'violet'];

/** Initialen (höchstens zwei) aus einem Namen. */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w));
  const first = words[0]?.match(/\p{L}/u)?.[0] ?? '';
  const second = words.length > 1 ? (words[words.length - 1]!.match(/\p{L}/u)?.[0] ?? '') : '';
  return (first + second).toUpperCase();
}

/** Ton aus dem Namen: gleicher Name, gleiche Farbe, damit Listen ruhig und wiedererkennbar bleiben. */
export function tintFor(name: string): Tint {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return ORDER[h % ORDER.length]!;
}

/** Runder Avatar mit Initialen auf Pastellgrund (für Kunden, Team). */
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const c = tints[tintFor(name)];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg },
      ]}
    >
      <Text
        variant="bodyStrong"
        style={{ color: c.fg, fontSize: size * 0.36, lineHeight: size * 0.5 }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
});
