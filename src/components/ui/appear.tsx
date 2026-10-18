import type { ReactNode } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { tokens } from '@/theme/tokens';

// Nachrücken per Feder nur auf dem Gerät: Im Web hält Reanimated eine Scrollbewegung für eine
// Lageänderung und verschiebt die Einträge sichtbar.
const layout =
  Platform.OS === 'web'
    ? undefined
    : LinearTransition.springify().damping(tokens.motion.spring.damping);

// Ab hier erscheinen Einträge ohne weitere Verzögerung, damit lange Listen nicht „nachlaufen“.
const MAX_STAGGER = 8;

/**
 * Lässt Inhalt beim ersten Erscheinen weich von unten einblenden; `index` staffelt Listen.
 * Beim Entfernen blendet er aus, die Nachbarn rücken mit einer Feder nach. Reanimated
 * berücksichtigt „Bewegung reduzieren“ des Systems.
 */
export function Appear({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      // Bewusst die fertige Einblendung ohne eigene Startwerte: Im Web wird sonst eine Sonder-
      // Animation daraus, deren Element Reanimated danach absolut positioniert.
      entering={FadeInDown.duration(tokens.motion.slow).delay(
        Math.min(index, MAX_STAGGER) * tokens.motion.stagger,
      )}
      exiting={FadeOut.duration(tokens.motion.fast)}
      layout={layout}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
