import { Redirect } from 'expo-router';

import { defaultRoute } from '@/features/company/routes';
import { useSetupStage } from '@/features/company/use-setup-stage';

// Einstiegspunkt „/“: Das Gate im Root-Layout lässt nur die passende Gruppe zu.
export default function Index() {
  const { stage, role } = useSetupStage();
  return <Redirect href={defaultRoute(stage, role)} />;
}
