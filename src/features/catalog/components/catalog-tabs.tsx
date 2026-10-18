import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SegmentedTabs } from '@/components/ui/segmented-tabs';

const TABS = [
  { key: 'dishes', href: '/dishes' },
  { key: 'packages', href: '/packages' },
  { key: 'ingredients', href: '/ingredients' },
] as const;

/** Segment oben in SC-38, SC-40 und SC-42: wechselt zwischen Gerichten, Paketen und Zutaten. */
export function CatalogTabs({ active }: { active: (typeof TABS)[number]['key'] }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <SegmentedTabs
      items={TABS.map((tab) => ({ key: tab.key, label: t(`catalog.tabs.${tab.key}`) }))}
      active={active}
      onChange={(key) => router.replace(TABS.find((tab) => tab.key === key)!.href)}
    />
  );
}
