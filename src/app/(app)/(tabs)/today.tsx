import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/features/shell/screens/placeholder-screen';

export default function TodayTab() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.today')} milestone="M8" />;
}
