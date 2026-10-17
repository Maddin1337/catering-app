import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/features/shell/screens/placeholder-screen';

export default function CalendarTab() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.calendar')} milestone="M3" />;
}
