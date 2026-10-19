import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { tints, tokens, type Tint } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

/**
 * Große Auswahlkarte für Datum, Uhrzeit und Ähnliches: Symbol-Kachel, kleine Beschriftung,
 * der gewählte Wert groß darunter. Tippen öffnet das Auswahlblatt. Ohne Wert steht ein Platzhalter.
 */
export function PickCard({
  icon: Icon,
  tint = 'teal',
  label,
  value,
  placeholder,
  error,
  onPress,
  accessibilityLabel,
}: {
  icon: LucideIcon;
  tint?: Tint;
  label: string;
  value?: string;
  placeholder: string;
  error?: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <View style={styles.wrap}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `${label}: ${value || placeholder}`}
        onPress={onPress}
        scale={0.98}
        style={[styles.card, error ? styles.cardError : null]}
      >
        <View style={[styles.icon, { backgroundColor: tints[tint].bg }]}>
          <Icon color={tints[tint].fg} size={22} strokeWidth={2.1} />
        </View>
        <View style={styles.texts}>
          <Text variant="caption" color="textSecondary">
            {label}
          </Text>
          <Text variant="title2" color={value ? 'text' : 'textTertiary'} numberOfLines={1}>
            {value || placeholder}
          </Text>
        </View>
        <ChevronRight color={tokens.color.textTertiary} size={20} strokeWidth={2.2} />
      </PressableScale>
      {error ? (
        <Text variant="small" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space[1], flex: 1 },
  card: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    paddingHorizontal: tokens.space[4],
    paddingVertical: tokens.space[3],
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg,
    boxShadow: tokens.shadow.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardError: { borderColor: tokens.color.danger },
  icon: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 1 },
});
