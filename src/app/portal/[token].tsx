import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/ui/screen';

// Kundenportal (öffentlich, Sie-Form, noindex über public/_headers). Platzhalter in M0;
// der Ausbau über `portal-api` folgt in M6.
export default function PortalRoute() {
  const { t } = useTranslation('portal');
  return (
    <Screen title={t('placeholder.title')} subtitle={t('placeholder.body')}>
      {null}
    </Screen>
  );
}
