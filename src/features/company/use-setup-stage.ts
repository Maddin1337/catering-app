import { useSession } from '../auth/session-provider';
import { useCompanyProfile, useMembership } from './api';
import type { SetupStage } from './routes';
import type { MemberRole } from './types';

export function useSetupStage(): { stage: SetupStage; role: MemberRole | null } {
  const { status } = useSession();
  const membership = useMembership();
  const profile = useCompanyProfile();

  if (status === 'loading') return { stage: 'loading', role: null };
  if (status === 'signedOut') return { stage: 'signedOut', role: null };

  if (membership.isPending) return { stage: 'loading', role: null };
  if (membership.isError && membership.data === undefined) return { stage: 'error', role: null };
  const m = membership.data ?? null;
  if (!m) return { stage: 'noCompany', role: null };

  if (m.role === 'admin') {
    if (profile.isPending) return { stage: 'loading', role: m.role };
    if (profile.data && profile.data.onboarding_completed_at === null) {
      return { stage: 'onboarding', role: m.role };
    }
  }
  return { stage: 'ready', role: m.role };
}
