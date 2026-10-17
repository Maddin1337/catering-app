import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/features/shell/screens/placeholder-screen';

export default function MyShiftsTab() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.myShifts')} milestone="M7" />;
}
