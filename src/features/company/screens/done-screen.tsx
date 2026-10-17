import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatDate } from '@/lib/dates';
import { toAppError } from '@/lib/errors';

import { useSubscription, useUpdateCompany } from '../api';

/** SC-11 Onboarding · Fertig: Testphase und nächste Schritte, ohne Preis und Kauf-Link. */
export function DoneScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const subscription = useSubscription();
  const update = useUpdateCompany();
  const trialEnd = subscription.data?.trial_ends_at;

  const finish = () =>
    update.mutate(
      { onboarding_completed_at: new Date().toISOString() },
      // Das Gate wechselt von selbst in die Team-App; „/“ führt auf den ersten Tab.
      { onSuccess: () => router.replace('/') },
    );

  return (
    <Screen title={t('company.done.title')} subtitle={t('company.done.body')}>
      {trialEnd ? (
        <Banner tone="info">{t('company.done.trial', { date: formatDate(trialEnd) })}</Banner>
      ) : null}
      {update.error ? <Banner tone="danger">{toAppError(update.error).message}</Banner> : null}
      <View style={{ gap: 8 }}>
        <Text variant="title2">{t('company.done.next')}</Text>
        {(['team', 'dish', 'quote'] as const).map((k) => (
          <Text key={k} variant="body" color="textSecondary">
            • {t(`company.done.tasks.${k}`)}
          </Text>
        ))}
      </View>
      <Button label={t('company.done.submit')} loading={update.isPending} onPress={finish} />
    </Screen>
  );
}
