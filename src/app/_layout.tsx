import '@/lib/i18n';

import { Inter_400Regular, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useSignOut } from '@/features/auth/api';
import { SessionProvider } from '@/features/auth/session-provider';
import { useMembership } from '@/features/company/api';
import { useSetupStage } from '@/features/company/use-setup-stage';
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
 * Gate (docs/04 §1.1 Nr. 2): Je nach Stand ist genau eine Gruppe erreichbar – `(auth)` ohne Sitzung,
 * `(setup)` ohne Firma bzw. im Onboarding, `(app)` für die Team-App. `(public)` (Passwort
 * zurücksetzen, Einladung) und das Kundenportal sind immer erreichbar, denn der Link legt selbst
 * eine Sitzung an.
 */
function Gate({ fontsReady }: { fontsReady: boolean }) {
  const { stage } = useSetupStage();
  const ready = fontsReady && stage !== 'loading';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  if (stage === 'error') return <MembershipError />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={stage === 'ready'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'noCompany' || stage === 'onboarding'}>
        <Stack.Screen name="(setup)" />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="(public)" />
      <Stack.Screen name="portal/[token]" />
    </Stack>
  );
}

/** Die Mitgliedschaft ließ sich nicht lesen: nicht ins Willkommen schicken, sondern neu laden lassen. */
function MembershipError() {
  const { t } = useTranslation();
  const membership = useMembership();
  const signOut = useSignOut();
  return (
    <Screen title={t('shell.error.title')} subtitle={t('shell.error.body')}>
      <Button
        label={t('common.retry')}
        loading={membership.isFetching}
        onPress={() => void membership.refetch()}
      />
      <Button
        label={t('company.welcome.signOut')}
        variant="ghost"
        onPress={() => signOut.mutate()}
      />
    </Screen>
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
