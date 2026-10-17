import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { tokens } from '@/theme/tokens';

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
    <View style={{ flexDirection: 'row' }} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const on = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => !on && router.replace(tab.href)}
            style={{
              flex: 1,
              minHeight: tokens.touch.min,
              alignItems: 'center',
              justifyContent: 'center',
              borderBottomWidth: 2,
              borderBottomColor: on ? tokens.color.accent : tokens.color.border,
            }}
          >
            <Text variant="bodyStrong" color={on ? 'accent' : 'textSecondary'}>
              {t(`catalog.tabs.${tab.key}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
