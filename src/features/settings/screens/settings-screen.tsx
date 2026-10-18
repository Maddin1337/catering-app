import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ActionCard } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';

const GROUPS = [
  'company',
  'branding',
  'tax-rates',
  'qualifications',
  'defaults',
  'quote-texts',
  'questionnaire',
  'db-status',
] as const;
const PATHS = {
  company: '/settings/company',
  branding: '/settings/branding',
  'tax-rates': '/settings/tax-rates',
  qualifications: '/settings/qualifications',
  defaults: '/settings/defaults',
  'quote-texts': '/settings/quote-texts',
  questionnaire: '/settings/questionnaire',
  'db-status': '/settings/db-status',
} as const;

/** SC-57 Einstellungen: Einstieg in die Bereiche. */
export function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen
      title={t('settings.hub.title')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
    >
      <View style={{ gap: 12 }}>
        {GROUPS.map((g) => (
          <ActionCard
            key={g}
            title={t(`settings.hub.${g}.title`)}
            body={t(`settings.hub.${g}.body`)}
            onPress={() => router.push(PATHS[g])}
          />
        ))}
      </View>
    </Screen>
  );
}
