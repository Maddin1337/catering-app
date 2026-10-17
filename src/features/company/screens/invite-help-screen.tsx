import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';

/** Platzhalter bis zur Einladungs-Etappe von M1: Einladungen öffnen sich über ihren Link. */
export function InviteHelpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen title={t('company.invite.title')} subtitle={t('company.invite.body')}>
      <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
