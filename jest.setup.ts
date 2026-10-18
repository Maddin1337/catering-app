// Übersetzungen für Komponententests laden (Namensraum `team`).
import '@/lib/i18n';

// Reanimated braucht im Test keine native Worklets-Laufzeit: schlanker Ersatz für das, was die App nutzt.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (component: unknown) => component },
    useAnimatedStyle: (factory: () => object) => factory(),
    withSpring: (value: number) => value,
    LinearTransition: { duration: () => undefined },
  };
});
