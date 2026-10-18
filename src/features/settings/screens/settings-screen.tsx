import { useRouter } from 'expo-router';
import {
  Building2,
  Database,
  FileText,
  GraduationCap,
  ListChecks,
  Palette,
  Percent,
  SlidersHorizontal,
} from 'lucide-react-native';
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

const LOOK = {
  company: { icon: Building2, tint: 'teal' },
  branding: { icon: Palette, tint: 'rose' },
  'tax-rates': { icon: Percent, tint: 'amber' },
  qualifications: { icon: GraduationCap, tint: 'indigo' },
  defaults: { icon: SlidersHorizontal, tint: 'sky' },
  'quote-texts': { icon: FileText, tint: 'violet' },
  questionnaire: { icon: ListChecks, tint: 'teal' },
  'db-status': { icon: Database, tint: 'slate' },
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
            icon={LOOK[g].icon}
            tint={LOOK[g].tint}
            title={t(`settings.hub.${g}.title`)}
            body={t(`settings.hub.${g}.body`)}
            onPress={() => router.push(PATHS[g])}
          />
        ))}
      </View>
    </Screen>
  );
}
