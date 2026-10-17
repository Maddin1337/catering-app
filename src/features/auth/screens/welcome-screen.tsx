import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';

import { useSignOut } from '../api';
import { useSession } from '../session-provider';

/**
 * SC-07 Willkommen (Platzhalter in M0). M1 ergänzt „Neue Firma anlegen“ und „Ich habe eine
 * Einladung“; bis dahin zeigt die Seite nur den Anmeldestand und „Abmelden“.
 */
export function WelcomeScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const signOut = useSignOut();

  return (
    <Screen
      title={t('auth.welcome.title')}
      subtitle={t('auth.welcome.body', { email: session?.user.email ?? '' })}
    >
      <Button
        label={t('auth.welcome.signOut')}
        variant="secondary"
        loading={signOut.isPending}
        onPress={() => signOut.mutate()}
      />
    </Screen>
  );
}
