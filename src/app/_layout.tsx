import '@/lib/i18n';

import { Inter_400Regular, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Screen } from '@/components/ui/screen';
import { Banner } from '@/components/ui/banner';
import { SessionProvider, useSession } from '@/features/auth/session-provider';
import { envProblem } from '@/lib/env';
import { queryClient } from '@/lib/query-client';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_600SemiBold });
  // Bei einem Ladefehler läuft die App mit der Systemschrift weiter.
  const fontsReady = fontsLoaded || !!fontError;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StatusBar style="dark" />
          {envProblem ? <ConfigProblem missing={envProblem} /> : <Gate fontsReady={fontsReady} />}
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/**
 * Auth-Gate (docs/04 §1.1 Nr. 2): ohne Sitzung nur `(auth)`, mit Sitzung nur `(app)`.
 * `(public)` (Passwort zurücksetzen, Einladung) und das Kundenportal sind immer erreichbar,
 * denn der Reset-Link legt selbst eine Sitzung an.
 */
function Gate({ fontsReady }: { fontsReady: boolean }) {
  const { status } = useSession();
  const ready = fontsReady && status !== 'loading';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="(public)" />
      <Stack.Screen name="portal/[token]" />
    </Stack>
  );
}

function ConfigProblem({ missing }: { missing: string }) {
  const { t } = useTranslation();
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  return (
    <Screen title={t('config.title')}>
      <Banner tone="warning">{t('config.body', { missing })}</Banner>
    </Screen>
  );
}
