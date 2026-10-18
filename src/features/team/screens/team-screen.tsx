import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Text } from '@/components/ui/text';
import { formatDate } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { surfaceStyle } from '@/components/ui/surface';
import { tokens } from '@/theme/tokens';

import { useMembership } from '../../company/api';
import { useInvitations, useResendInvitation, useRevokeInvitation, useTeamMembers } from '../api';
import { InviteLinkCard } from '../invite-link-card';
import { invitationStatus } from '../status';
import type { InvitationToken } from '../types';

/** SC-54 Team: Mitglieder und Einladungen. Admins bearbeiten, die Küche liest nur. */
export function TeamScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isAdmin = useMembership().data?.role === 'admin';
  const [tab, setTab] = useState<'members' | 'invitations'>('members');
  const members = useTeamMembers();
  const invitations = useInvitations();
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();
  const [link, setLink] = useState<InvitationToken | null>(null);

  const error = members.error ?? invitations.error ?? resend.error ?? revoke.error;
  const openInvitations = (invitations.data ?? []).filter(
    (i) => invitationStatus(i) !== 'accepted',
  );

  return (
    <Screen title={t('team.title')} onBack={() => router.back()} backLabel={t('common.back')}>
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {isAdmin ? (
        <Button label={t('team.invite')} onPress={() => router.push('/team/invite')} />
      ) : null}
      {isAdmin ? (
        <SegmentedTabs
          items={[
            { key: 'members', label: t('team.members') },
            { key: 'invitations', label: t('team.invitations', { count: openInvitations.length }) },
          ]}
          active={tab}
          onChange={setTab}
        />
      ) : null}

      {tab === 'members' ? (
        <View style={{ gap: 8 }}>
          {(members.data ?? []).map((m) => (
            <Pressable
              key={m.id}
              disabled={!isAdmin}
              accessibilityRole={isAdmin ? 'button' : undefined}
              onPress={() =>
                router.push({ pathname: '/team/[memberId]', params: { memberId: m.id } })
              }
              style={({ pressed }) => ({
                minHeight: 64,
                padding: tokens.space[3],
                ...surfaceStyle(),
                ...(pressed ? { backgroundColor: tokens.color.bgSubtle } : null),
                gap: 2,
              })}
            >
              <Text variant="bodyStrong">{m.display_name}</Text>
              <Text variant="small" color="textSecondary">
                {[t(`role.${m.role}`), m.phone].filter(Boolean).join(' · ')}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {link ? <InviteLinkCard token={link} onClose={() => setLink(null)} /> : null}
          {openInvitations.length === 0 ? (
            <Text variant="body" color="textSecondary">
              {t('team.noInvitations')}
            </Text>
          ) : null}
          {openInvitations.map((i) => {
            const status = invitationStatus(i);
            return (
              <View
                key={i.id}
                style={{
                  padding: tokens.space[3],
                  ...surfaceStyle(),
                  gap: 8,
                }}
              >
                <View style={{ gap: 2 }}>
                  <Text variant="bodyStrong">{i.display_name}</Text>
                  <Text variant="small" color="textSecondary">
                    {[t(`role.${i.role}`), i.email].filter(Boolean).join(' · ')}
                  </Text>
                  <Text variant="small" color={status === 'open' ? 'textSecondary' : 'danger'}>
                    {t(`team.status.${status}`, { date: formatDate(i.expires_at) })}
                  </Text>
                </View>
                {status !== 'revoked' ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        label={t('team.newLink')}
                        variant="secondary"
                        loading={resend.isPending && resend.variables === i.id}
                        onPress={() => resend.mutate(i.id, { onSuccess: setLink })}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label={t('team.revoke')}
                        variant="danger"
                        loading={revoke.isPending && revoke.variables === i.id}
                        onPress={() => revoke.mutate(i.id)}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
