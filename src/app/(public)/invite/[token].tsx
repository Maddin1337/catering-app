import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/ui/screen';

// SC-06 Einladung annehmen: Platzhalter, damit Deep Links und der SPA-Fallback von Anfang an
// funktionieren. Die Logik (`accept-invitation`) folgt in M1.
export default function InviteRoute() {
  const { t } = useTranslation();
  return <Screen title={t('company.invite.title')}>{null}</Screen>;
}
