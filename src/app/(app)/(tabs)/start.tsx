import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/features/shell/screens/placeholder-screen';

export default function StartTab() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.start')} milestone="M3" />;
}
