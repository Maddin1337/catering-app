import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/ui/screen';

/** Platzhalter für Tabs, deren Inhalt in einem späteren Meilenstein folgt (docs/06-roadmap.md). */
export function PlaceholderScreen({ title, milestone }: { title: string; milestone: string }) {
  const { t } = useTranslation();
  return (
    <Screen title={title} subtitle={t('shell.soon', { milestone })}>
      {null}
    </Screen>
  );
}
