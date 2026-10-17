import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioList } from '@/components/ui/radio-list';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { confirm } from '@/lib/confirm';
import { toAppError } from '@/lib/errors';

import { useMembership } from '../../company/api';
import type { MemberRole } from '../../company/types';
import {
  useMemberQualifications,
  useQualifications,
  useRemoveMember,
  useSetMemberQualifications,
  useSetMemberRole,
  useTeamMembers,
} from '../api';

/** SC-56 Mitglied: Rolle, Qualifikationen und Entfernen (nur admin). */
export function MemberScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const self = useMembership().data;
  const members = useTeamMembers();
  const member = members.data?.find((m) => m.id === memberId);
  const qualifications = useQualifications();
  const current = useMemberQualifications(memberId);
  const setRole = useSetMemberRole();
  const setQuals = useSetMemberQualifications();
  const remove = useRemoveMember();

  // Entwurf bleibt `null`, bis jemand etwas ändert; bis dahin gilt der gespeicherte Stand.
  const [roleDraft, setRoleDraft] = useState<MemberRole | null>(null);
  const [pickedDraft, setPickedDraft] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const role = roleDraft ?? member?.role ?? 'staff';
  const picked = pickedDraft ?? current.data ?? [];
  const setPicked = (next: (p: string[]) => string[]) => setPickedDraft(next(picked));

  const error = setRole.error ?? setQuals.error ?? remove.error;
  const isSelf = member?.id === self?.id;

  const save = async () => {
    setSaved(false);
    try {
      if (member && role !== member.role) await setRole.mutateAsync({ memberId: member.id, role });
      await setQuals.mutateAsync({ memberId: memberId!, qualificationIds: picked });
      setSaved(true);
    } catch {
      // Fehler stehen in den Mutationen und werden oben angezeigt.
    }
  };

  const removeMember = async () => {
    if (!member) return;
    const ok = await confirm(
      t('team.removeTitle', { name: member.display_name }),
      t('team.removeBody'),
      t('team.remove'),
      t('common.cancel'),
    );
    if (ok) remove.mutate(member.id, { onSuccess: () => router.back() });
  };

  if (!member) {
    return (
      <Screen
        title={t('team.memberTitle')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      >
        {members.isPending ? (
          <Text>{t('common.loading')}</Text>
        ) : (
          <Banner tone="info">{t('team.gone')}</Banner>
        )}
      </Screen>
    );
  }

  return (
    <Screen title={member.display_name} onBack={() => router.back()} backLabel={t('common.back')}>
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {saved ? <Banner tone="success">{t('common.saved')}</Banner> : null}
      <View style={{ gap: 4 }}>
        {member.login_email ? <Text variant="body">{member.login_email}</Text> : null}
        {member.phone ? <Text variant="body">{member.phone}</Text> : null}
      </View>
      <RadioList
        label={t('team.role')}
        value={role}
        onChange={setRoleDraft}
        options={(['staff', 'kitchen', 'admin'] as const).map((r) => ({
          value: r,
          label: t(`role.${r}`),
          hint: t(`team.roleHint.${r}`),
        }))}
      />
      <View style={{ gap: 4 }}>
        <Text variant="small" color="textSecondary">
          {t('team.qualifications')}
        </Text>
        {(qualifications.data ?? []).map((q) => (
          <Checkbox
            key={q.id}
            label={q.name}
            checked={picked.includes(q.id)}
            onChange={(on) => setPicked((p) => (on ? [...p, q.id] : p.filter((x) => x !== q.id)))}
          />
        ))}
      </View>
      <Button
        label={t('common.save')}
        loading={setRole.isPending || setQuals.isPending}
        onPress={() => void save()}
      />
      {!isSelf ? (
        <Button
          label={t('team.remove')}
          variant="danger"
          loading={remove.isPending}
          onPress={() => void removeMember()}
        />
      ) : null}
    </Screen>
  );
}
