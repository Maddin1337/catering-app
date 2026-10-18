import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { tokens } from '@/theme/tokens';

export type SetupStep = { key: string; label: string; done: boolean; onPress: () => void };

/** „Erste Schritte“ als Fortschrittskarte mit Balken und abhakbaren Schritten. */
export function SetupCard({ steps }: { steps: SetupStep[] }) {
  const { t } = useTranslation();
  const done = steps.filter((s) => s.done).length;
  return (
    <Surface style={styles.card}>
      <View style={styles.head}>
        <Text variant="title2">{t('start.setup')}</Text>
        <Text variant="small" color="textSecondary">
          {t('start.setupProgress', { done, total: steps.length })}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(done / steps.length) * 100}%` }]} />
      </View>
      <View style={styles.steps}>
        {steps.map((s) => (
          <PressableScale
            key={s.key}
            accessibilityRole="button"
            accessibilityState={{ disabled: s.done }}
            disabled={s.done}
            onPress={s.onPress}
            scale={0.98}
            style={styles.step}
          >
            <View style={[styles.check, s.done && styles.checkDone]}>
              {s.done ? <Check color={tokens.color.onAccent} size={16} strokeWidth={3} /> : null}
            </View>
            <Text
              variant="body"
              color={s.done ? 'textTertiary' : 'text'}
              style={s.done && styles.struck}
            >
              {s.label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: tokens.space[3], padding: tokens.space[5] },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.color.bgMuted,
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: tokens.color.accent },
  steps: { gap: tokens.space[1] },
  step: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: tokens.color.borderInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: tokens.color.accent, borderColor: tokens.color.accent },
  struck: { textDecorationLine: 'line-through' },
});
