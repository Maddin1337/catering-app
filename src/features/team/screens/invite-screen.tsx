import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioList } from '@/components/ui/radio-list';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { toAppError } from '@/lib/errors';

import { useCreateInvitation, useQualifications } from '../api';
import { InviteLinkCard } from '../invite-link-card';
import { inviteSchema, type InviteFormValues } from '../schemas';
import type { InvitationToken } from '../types';

/** SC-55 Mitglied einladen: Name, Rolle, Qualifikationen; Ergebnis ist ein Link zum Weitergeben. */
export function InviteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const create = useCreateInvitation();
  const qualifications = useQualifications();
  const [picked, setPicked] = useState<string[]>([]);
  const [created, setCreated] = useState<InvitationToken | null>(null);

  const { control, handleSubmit } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { displayName: '', role: 'staff', email: '' },
  });

  const submit = handleSubmit((v) =>
    create.mutate({ ...v, qualificationIds: picked }, { onSuccess: setCreated }),
  );

  if (created) {
    return (
      <Screen title={t('team.invitedTitle')} subtitle={t('team.invitedBody')}>
        <InviteLinkCard token={created} onClose={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen title={t('team.inviteTitle')} onBack={() => router.back()} backLabel={t('common.back')}>
      {create.error ? <Banner tone="danger">{toAppError(create.error).message}</Banner> : null}
      <View style={{ gap: 16 }}>
        <Controller
          control={control}
          name="displayName"
          render={({ field, fieldState }) => (
            <TextField
              label={t('team.name')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
              maxLength={80}
              autoCapitalize="words"
            />
          )}
        />
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <RadioList
              label={t('team.role')}
              value={field.value}
              onChange={field.onChange}
              options={(['staff', 'kitchen', 'admin'] as const).map((r) => ({
                value: r,
                label: t(`role.${r}`),
                hint: t(`team.roleHint.${r}`),
              }))}
            />
          )}
        />
        {(qualifications.data ?? []).length > 0 ? (
          <View style={{ gap: 4 }}>
            <Text variant="small" color="textSecondary">
              {t('team.qualifications')}
            </Text>
            {(qualifications.data ?? []).map((q) => (
              <Checkbox
                key={q.id}
                label={q.name}
                checked={picked.includes(q.id)}
                onChange={(on) =>
                  setPicked((p) => (on ? [...p, q.id] : p.filter((x) => x !== q.id)))
                }
              />
            ))}
          </View>
        ) : null}
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextField
              label={t('team.emailOptional')}
              helper={t('team.emailHint')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              inputMode="email"
              keyboardType="email-address"
            />
          )}
        />
      </View>
      <Button
        label={t('team.createLink')}
        loading={create.isPending}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
