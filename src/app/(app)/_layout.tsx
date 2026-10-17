import { Stack } from 'expo-router';

// Team-App. Der Zugang ist über das Gate im Root-Layout geschützt; Rollen-Tabs folgen in M1.
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
