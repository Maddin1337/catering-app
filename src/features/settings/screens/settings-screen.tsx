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

import { Appear } from '@/components/ui/appear';
import { GroupRow, ListGroup } from '@/components/ui/list-group';
import { Screen } from '@/components/ui/screen';

// Bereiche, thematisch gruppiert (iOS-Einstellungen als Vorbild).
const GROUPS = {
  company: ['company', 'branding'],
  quotes: ['tax-rates', 'defaults', 'quote-texts', 'questionnaire'],
  team: ['qualifications'],
  system: ['db-status'],
} as const;
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
      {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((group, i) => (
        <Appear key={group} index={i}>
          <ListGroup title={t(`settings.hub.groups.${group}`)}>
            {GROUPS[group].map((g) => (
              <GroupRow
                key={g}
                icon={LOOK[g].icon}
                tint={LOOK[g].tint}
                title={t(`settings.hub.${g}.title`)}
                subtitle={t(`settings.hub.${g}.body`)}
                onPress={() => router.push(PATHS[g])}
              />
            ))}
          </ListGroup>
        </Appear>
      ))}
    </Screen>
  );
}
