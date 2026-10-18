import { Building, MailOpen } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { ActionCard } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { pendingInvite } from '@/lib/pending-invite';

import { useSignOut } from '../../auth/api';
import { useSession } from '../../auth/session-provider';

/** SC-07 Willkommen: Konto ohne Firma wählt den Weg. */
export function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const signOut = useSignOut();

  // Wer über einen Einladungslink kam und sich erst registriert hat, geht dort weiter.
  const openInvite = async () => {
    const token = await pendingInvite.get();
    if (token) router.replace({ pathname: '/invite/[token]', params: { token } });
    return !!token;
  };
  useEffect(() => {
    void openInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen
      brand
      title={t('company.welcome.title')}
      subtitle={t('company.welcome.body', { email: session?.user.email ?? '' })}
    >
      <ActionCard
        title={t('company.welcome.create.title')}
        body={t('company.welcome.create.body')}
        icon={Building}
        onPress={() => {
          void pendingInvite.clear();
          router.push('/onboarding/company');
        }}
      />
      <ActionCard
        title={t('company.welcome.invite.title')}
        body={t('company.welcome.invite.body')}
        icon={MailOpen}
        tint="indigo"
        onPress={() => void openInvite().then((found) => !found && router.push('/invite-help'))}
      />
      {signOut.error ? <Banner tone="danger">{t('common.error')}</Banner> : null}
      <Button
        label={t('company.welcome.signOut')}
        variant="ghost"
        loading={signOut.isPending}
        onPress={() => signOut.mutate()}
      />
    </Screen>
  );
}
