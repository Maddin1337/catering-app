import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

import { useMembership } from '../company/api';
import type { MemberRole } from '../company/types';
import type {
  Invitation,
  InvitationPreview,
  InvitationToken,
  Qualification,
  TeamMember,
} from './types';

// Einziger Ort für Supabase-Aufrufe des Teams (docs/05 §3.2).

function client() {
  if (!supabase) throw new AppError('not_configured');
  return supabase;
}

const teamKeys = {
  members: (companyId: string | undefined, role: MemberRole | undefined) =>
    ['team', 'members', companyId, role] as const,
  invitations: (companyId: string | undefined) => ['team', 'invitations', companyId] as const,
  qualifications: (companyId: string | undefined) => ['team', 'qualifications', companyId] as const,
  memberQualifications: (memberId: string | undefined) =>
    ['team', 'member-qualifications', memberId] as const,
};

/** Teamliste: Admins lesen die Mitglieder samt E-Mail, die Küche die schmale View `team_directory`. */
export function useTeamMembers() {
  const membership = useMembership();
  const companyId = membership.data?.company_id;
  const role = membership.data?.role;
  return useQuery({
    queryKey: teamKeys.members(companyId, role),
    enabled: !!companyId && (role === 'admin' || role === 'kitchen'),
    queryFn: async (): Promise<TeamMember[]> => {
      const query =
        role === 'admin'
          ? client()
              .from('company_members')
              .select('id, display_name, role, phone, joined_at, login_email')
              .is('removed_at', null)
          : client().from('team_directory').select('id, display_name, role, phone, joined_at');
      const { data, error } = await query.order('display_name');
      if (error) throw toAppError(error);
      return (data ?? []) as TeamMember[];
    },
  });
}

export function useInvitations() {
  const membership = useMembership();
  const companyId = membership.data?.company_id;
  return useQuery({
    queryKey: teamKeys.invitations(companyId),
    enabled: !!companyId && membership.data?.role === 'admin',
    queryFn: async (): Promise<Invitation[]> => {
      const { data, error } = await client()
        .from('invitations')
        .select(
          'id, email, display_name, role, qualification_ids, expires_at, last_sent_at, accepted_at, revoked_at, created_at',
        )
        .order('created_at', { ascending: false });
      if (error) throw toAppError(error);
      return (data ?? []) as Invitation[];
    },
  });
}

export function useQualifications() {
  const membership = useMembership();
  const companyId = membership.data?.company_id;
  return useQuery({
    queryKey: teamKeys.qualifications(companyId),
    enabled: !!companyId,
    queryFn: async (): Promise<Qualification[]> => {
      const { data, error } = await client()
        .from('qualifications')
        .select('id, name')
        .is('archived_at', null)
        .order('sort_order');
      if (error) throw toAppError(error);
      return (data ?? []) as Qualification[];
    },
  });
}

export function useMemberQualifications(memberId: string | undefined) {
  return useQuery({
    queryKey: teamKeys.memberQualifications(memberId),
    enabled: !!memberId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await client()
        .from('member_qualifications')
        .select('qualification_id')
        .eq('member_id', memberId!);
      if (error) throw toAppError(error);
      return (data ?? []).map((r) => r.qualification_id as string);
    },
  });
}

/** Ruft eine Datenbankfunktion auf und übersetzt Fehler. */
async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(name, args);
  if (error) throw toAppError(error);
  return data as T;
}

function useTeamMutation<V, R = void>(fn: (v: V) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team'] }),
  });
}

export type CreateInvitationValues = {
  displayName: string;
  role: MemberRole;
  email: string;
  qualificationIds: string[];
};

export const useCreateInvitation = () =>
  useTeamMutation((v: CreateInvitationValues) =>
    rpc<InvitationToken>('create_invitation', {
      p_display_name: v.displayName,
      p_role: v.role,
      p_email: v.email.trim() || null,
      p_qualification_ids: v.qualificationIds,
    }),
  );

export const useResendInvitation = () =>
  useTeamMutation((id: string) => rpc<InvitationToken>('resend_invitation', { p_id: id }));

export const useRevokeInvitation = () =>
  useTeamMutation((id: string) => rpc<void>('revoke_invitation', { p_id: id }));

export const useSetMemberRole = () =>
  useTeamMutation((v: { memberId: string; role: MemberRole }) =>
    rpc<void>('set_member_role', { p_member_id: v.memberId, p_role: v.role }),
  );

export const useSetMemberQualifications = () =>
  useTeamMutation((v: { memberId: string; qualificationIds: string[] }) =>
    rpc<void>('set_member_qualifications', {
      p_member_id: v.memberId,
      p_qualification_ids: v.qualificationIds,
    }),
  );

export const useRemoveMember = () =>
  useTeamMutation((memberId: string) => rpc<void>('remove_member', { p_member_id: memberId }));

/** Einladung vor der Anmeldung ansehen (SC-06). */
export function useInvitationPreview(token: string | undefined) {
  return useQuery({
    queryKey: ['invitation-preview', token],
    enabled: !!token,
    retry: false,
    queryFn: () => rpc<InvitationPreview>('invitation_preview', { p_token: token }),
  });
}

/** Einladung annehmen; danach lädt das Gate die neue Mitgliedschaft. */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => rpc<string>('accept_invitation', { p_token: token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['membership'] }),
  });
}
