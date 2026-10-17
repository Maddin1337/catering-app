import { Stack } from 'expo-router';

// Routen, die mit und ohne Sitzung erreichbar sein müssen (Reset-Link, Einladung).
export default function PublicLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
