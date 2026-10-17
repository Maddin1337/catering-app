import { Redirect } from 'expo-router';

import { useSession } from '@/features/auth/session-provider';

// Einstiegspunkt „/“: Das Gate im Root-Layout lässt nur die passende Gruppe zu.
export default function Index() {
  const { status } = useSession();
  return <Redirect href={status === 'signedIn' ? '/welcome' : '/login'} />;
}
