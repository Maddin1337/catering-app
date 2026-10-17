import { Building, MailOpen } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { ActionCard } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { tokens } from '@/theme/tokens';

import { useSignOut } from '../../auth/api';
import { useSession } from '../../auth/session-provider';

/** SC-07 Willkommen: Konto ohne Firma wählt den Weg. */
export function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const signOut = useSignOut();

  return (
    <Screen
      title={t('company.welcome.title')}
      subtitle={t('company.welcome.body', { email: session?.user.email ?? '' })}
    >
      <ActionCard
        title={t('company.welcome.create.title')}
        body={t('company.welcome.create.body')}
        icon={<Building color={tokens.color.accent} size={28} />}
        onPress={() => router.push('/onboarding/company')}
      />
      <ActionCard
        title={t('company.welcome.invite.title')}
        body={t('company.welcome.invite.body')}
        icon={<MailOpen color={tokens.color.accent} size={28} />}
        onPress={() => router.push('/invite-help')}
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
