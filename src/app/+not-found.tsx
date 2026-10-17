import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <Screen title={t('notFound.title')} subtitle={t('notFound.body')}>
      <Link href="/" asChild>
        <Text variant="bodyStrong" color="accent" accessibilityRole="link">
          {t('notFound.home')}
        </Text>
      </Link>
    </Screen>
  );
}
