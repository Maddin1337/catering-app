import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { tokens } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

const SOFT = 'rgba(255, 255, 255, 0.74)';

export type HeroFact = { icon: LucideIcon; text: string };

/**
 * Dunkle Hero-Karte für das Wichtigste einer Startseite: Überschrift, Zeitmarke („in 3 Tagen“),
 * Titel, Fakten mit Symbol und eine Markierung (z. B. Status). Ohne `onPress` ist sie nicht tippbar.
 */
export function HeroCard({
  eyebrow,
  when,
  title,
  body,
  facts = [],
  badge,
  accessibilityLabel,
  onPress,
}: {
  eyebrow: string;
  when?: string;
  title: string;
  body?: string;
  facts?: HeroFact[];
  badge?: ReactNode;
  accessibilityLabel: string;
  onPress?: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={!onPress}
      onPress={onPress}
      scale={0.985}
      style={styles.card}
    >
      <LinearGradient
        colors={[tokens.color.inkPressed, tokens.color.ink]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.inner}>
        <View style={styles.top}>
          <Text variant="caption" style={styles.eyebrow}>
            {eyebrow}
          </Text>
          {when ? (
            <View style={styles.when}>
              <Text variant="caption" style={styles.whenText}>
                {when}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="title1" color="onAccent" numberOfLines={2}>
          {title}
        </Text>
        {body ? (
          <Text variant="small" style={{ color: SOFT }}>
            {body}
          </Text>
        ) : null}
        {facts.length > 0 ? (
          <View style={styles.facts}>
            {facts.map(({ icon: Icon, text }) => (
              <View key={text} style={styles.fact}>
                <Icon color={SOFT} size={16} strokeWidth={2} />
                <Text variant="small" style={[styles.factText, { color: SOFT }]}>
                  {text}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {badge}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.xxl,
    overflow: 'hidden',
    backgroundColor: tokens.color.ink,
    boxShadow: tokens.shadow.ink,
  },
  inner: { padding: tokens.space[5], gap: tokens.space[3] },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: SOFT, textTransform: 'uppercase', letterSpacing: 0.8 },
  when: {
    height: 26,
    paddingHorizontal: tokens.space[3],
    borderRadius: tokens.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    justifyContent: 'center',
  },
  whenText: { color: tokens.color.onAccent },
  facts: { gap: tokens.space[2] },
  fact: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] },
  factText: { flex: 1 },
});
