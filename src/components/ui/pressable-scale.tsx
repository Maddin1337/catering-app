import { useState, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { tokens } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Stil, solange gedrückt wird (z. B. dunklere Füllung). */
  pressedStyle?: StyleProp<ViewStyle>;
  /** Stärke des Eindrückens; 1 schaltet die Skalierung aus. */
  scale?: number;
  children?: ReactNode;
};

/**
 * Tippfläche mit weichem „Eindrücken“: Beim Drücken schrumpft sie leicht und federt zurück.
 * Reanimated respektiert „Bewegung reduzieren“ des Systems.
 */
export function PressableScale({
  style,
  pressedStyle,
  scale = tokens.motion.pressScale,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const [pressed, setPressed] = useState(false);
  const animated = useAnimatedStyle(
    () => ({
      transform: [
        {
          scale: withSpring(pressed ? scale : 1, {
            duration: pressed ? 160 : 260,
            dampingRatio: pressed ? 0.8 : 0.6,
          }),
        },
      ],
    }),
    [pressed, scale],
  );

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={[style, pressed ? pressedStyle : null, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
