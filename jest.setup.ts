// Übersetzungen für Komponententests laden (Namensraum `team`).
import '@/lib/i18n';

// Reanimated braucht im Test keine native Worklets-Laufzeit: schlanker Ersatz für das, was die App nutzt.
jest.mock('react-native-reanimated', () => {
  const { ScrollView, Text, View } = require('react-native');
  // Bausteine für Ein-/Ausblendungen: jede Methode gibt den Baustein selbst zurück.
  const builder: Record<string, unknown> = new Proxy({}, { get: () => () => builder });
  return {
    __esModule: true,
    default: { View, Text, ScrollView, createAnimatedComponent: (component: unknown) => component },
    useAnimatedStyle: (factory: () => object) => factory(),
    useAnimatedScrollHandler: () => () => undefined,
    useAnimatedProps: (factory: () => object) => factory(),
    useSharedValue: (initial: unknown) => {
      let value = initial;
      return { get: () => value, set: (v: unknown) => (value = v), value };
    },
    useReducedMotion: () => true,
    interpolate: (_: number, __: number[], output: number[]) => output[0],
    withSpring: (value: number) => value,
    withTiming: (value: number) => value,
    withDelay: (_: number, value: number) => value,
    interpolateColor: (_: number, __: number[], output: string[]) => output[0],
    LinearTransition: builder,
    FadeIn: builder,
    FadeInDown: builder,
    FadeInUp: builder,
    FadeOut: builder,
    FadeOutUp: builder,
    SlideInDown: builder,
    ZoomIn: builder,
  };
});
