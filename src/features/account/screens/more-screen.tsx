import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { useRouter } from 'expo-router';

import { Button } from '@/components/ui/button';
import { ActionCard } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatDate } from '@/lib/dates';
import { toAppError } from '@/lib/errors';

import { useSignOut } from '../../auth/api';
import { useSession } from '../../auth/session-provider';
import { useCompanyProfile, useMembership, useSubscription } from '../../company/api';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="small" color="textSecondary">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

/** Tab „Mehr“: Konto, Firma, Testphase (nur admin) und Abmelden. Einstellungen folgen mit Etappe 2. */
export function MoreScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const membership = useMembership();
  const profile = useCompanyProfile();
  const subscription = useSubscription();
  const signOut = useSignOut();
  const router = useRouter();
  const role = membership.data?.role;
  const trialEnd =
    subscription.data?.status === 'trialing' ? subscription.data.trial_ends_at : null;

  return (
    <Screen title={t('more.title')}>
      {trialEnd ? (
        <Banner tone="info">{t('more.trial', { date: formatDate(trialEnd) })}</Banner>
      ) : null}
      {signOut.error ? <Banner tone="danger">{toAppError(signOut.error).message}</Banner> : null}
      <View style={{ gap: 16 }}>
        <Text variant="title2">{t('more.profile')}</Text>
        <Row label={t('more.name')} value={membership.data?.display_name ?? ''} />
        <Row label={t('more.email')} value={session?.user.email ?? ''} />
        <Row
          label={t('more.role')}
          value={membership.data ? t(`role.${membership.data.role}`) : ''}
        />
        <Row label={t('more.company')} value={profile.data?.name ?? ''} />
      </View>
      <View style={{ gap: 12 }}>
        {role === 'admin' || role === 'kitchen' ? (
          <ActionCard
            title={t('more.team')}
            body={t('more.teamBody')}
            onPress={() => router.push('/team')}
          />
        ) : null}
        {role === 'admin' ? (
          <ActionCard
            title={t('more.settings')}
            body={t('more.settingsBody')}
            onPress={() => router.push('/settings')}
          />
        ) : null}
        <ActionCard
          title={t('more.profileLink')}
          body={t('more.profileBody')}
          onPress={() => router.push('/profile')}
        />
      </View>
      <Button
        label={t('more.signOut')}
        variant="secondary"
        loading={signOut.isPending}
        onPress={() => signOut.mutate()}
      />
    </Screen>
  );
}
