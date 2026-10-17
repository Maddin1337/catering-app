import { Stack } from 'expo-router';

// Team-App. Der Zugang ist über das Gate im Root-Layout geschützt; Detailseiten kommen als
// Stack-Seiten über die Tabs.
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
