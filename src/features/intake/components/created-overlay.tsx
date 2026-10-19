import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { tokens } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const TICK = 30;
// So lange bleibt der Erfolgsmoment stehen, bevor der neue Auftrag aufgeht.
const HOLD_MS = 1300;

/**
 * Erfolgsmoment nach „Anfrage anlegen“: ein Petrol-Kreis springt herein, der Haken zeichnet sich,
 * dazu die Erfolgs-Haptik. Danach geht der Auftrag mit seinem Angebot auf.
 */
export function CreatedOverlay({ title, onDone }: { title: string; onDone: () => void }) {
  const { t } = useTranslation();
  const draw = useSharedValue(0);
  // Läuft der Abschluss, darf ein neues Zeichnen der Seite (Daten laden nach) ihn nicht neu starten.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    draw.set(withDelay(280, withTiming(1, { duration: 360 })));
    if (Platform.OS !== 'web')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const id = setTimeout(() => done.current(), HOLD_MS);
    return () => clearTimeout(id);
  }, [draw]);

  const tick = useAnimatedProps(() => ({ strokeDashoffset: TICK * (1 - draw.get()) }));

  return (
    <View style={styles.root} accessibilityViewIsModal accessibilityLiveRegion="polite">
      <Animated.View entering={ZoomIn.springify().damping(13)} style={styles.circle}>
        <Svg width={52} height={52} viewBox="0 0 24 24">
          <AnimatedPath
            d="M5.5 12.5 L10 17 L18.5 7.5"
            stroke={tokens.color.onAccent}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={TICK}
            animatedProps={tick}
          />
        </Svg>
      </Animated.View>
      <Animated.View
        entering={FadeInUp.delay(380).duration(tokens.motion.slow)}
        style={styles.texts}
      >
        <Text variant="display" style={styles.centered}>
          {t('intake.chat.created')}
        </Text>
        <Text variant="body" color="textSecondary" style={styles.centered} numberOfLines={2}>
          {title}
        </Text>
        <Text variant="small" color="textTertiary" style={styles.centered}>
          {t('intake.chat.createdHint')}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space[6],
    padding: tokens.space[6],
    backgroundColor: tokens.color.canvas,
  },
  circle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.accent,
    boxShadow: '0px 14px 32px rgba(15, 118, 110, 0.35)',
  },
  texts: { gap: tokens.space[2], alignItems: 'center' },
  centered: { textAlign: 'center' },
});
