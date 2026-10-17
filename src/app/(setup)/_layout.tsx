import { Stack } from 'expo-router';

// Firma anlegen und Onboarding (SC-07 bis SC-11). Das Gate im Root-Layout schützt die Gruppe.
export default function SetupLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
