import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { tokens } from '@/theme/tokens';

// Anlegen-Seiten fahren von unten herein (mit ✕ statt Pfeil) und lassen sich nach unten wegwischen.
const fromBottom = {
  animation: 'slide_from_bottom',
  gestureDirection: 'vertical',
} as const;

// Team-App. Der Zugang ist über das Gate im Root-Layout geschützt; Detailseiten kommen als
// Stack-Seiten über die Tabs.
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.color.canvas },
        // iOS: native Schiebebewegung mit Wischen vom Rand; Android: gleiche Richtung statt Einblenden.
        animation: Platform.OS === 'android' ? 'slide_from_right' : 'default',
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen name="events/new" options={fromBottom} />
      <Stack.Screen name="events/intake" options={fromBottom} />
      <Stack.Screen name="customers/new" options={fromBottom} />
      <Stack.Screen name="dishes/new" options={fromBottom} />
      <Stack.Screen name="packages/new" options={fromBottom} />
      <Stack.Screen name="team/invite" options={fromBottom} />
    </Stack>
  );
}
