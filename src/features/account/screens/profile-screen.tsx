import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { confirm } from '@/lib/confirm';
import { toAppError } from '@/lib/errors';

import { useSession } from '../../auth/session-provider';
import { useMembership } from '../../company/api';
import { useDeleteAccount, useLeaveCompany, useUpdateProfile } from '../api';

/** SC-68 Profil: Name und Telefon, Firma verlassen, Konto löschen. */
export function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const membership = useMembership().data;
  const update = useUpdateProfile();
  const leave = useLeaveCompany();
  const del = useDeleteAccount();

  // Entwurf bleibt `null`, bis jemand tippt; bis dahin gilt der gespeicherte Stand.
  const [nameDraft, setName] = useState<string | null>(null);
  const [phoneDraft, setPhone] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const name = nameDraft ?? membership?.display_name ?? '';
  const phone = phoneDraft ?? membership?.phone ?? '';

  const nameError = name.trim() === '' ? t('profile.nameRequired') : undefined;
  const error = update.error ?? leave.error ?? del.error;

  const save = () => {
    setSaved(false);
    update.mutate({ displayName: name, phone }, { onSuccess: () => setSaved(true) });
  };

  const leaveCompany = async () => {
    if (
      await confirm(
        t('profile.leaveTitle'),
        t('profile.leaveBody'),
        t('profile.leave'),
        t('common.cancel'),
      )
    ) {
      leave.mutate();
    }
  };
  const deleteAccount = async () => {
    if (
      await confirm(
        t('profile.deleteTitle'),
        t('profile.deleteBody'),
        t('profile.delete'),
        t('common.cancel'),
      )
    ) {
      del.mutate();
    }
  };

  return (
    <Screen title={t('profile.title')} onBack={() => router.back()} backLabel={t('common.back')}>
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {saved ? <Banner tone="success">{t('common.saved')}</Banner> : null}
      <View style={{ gap: 16 }}>
        <TextField
          label={t('profile.name')}
          value={name}
          onChangeText={setName}
          error={nameError}
          maxLength={80}
          autoCapitalize="words"
        />
        <TextField
          label={t('profile.phone')}
          value={phone}
          onChangeText={setPhone}
          inputMode="tel"
          keyboardType="phone-pad"
          autoComplete="tel"
        />
        <View style={{ gap: 2 }}>
          <Text variant="small" color="textSecondary">
            {t('more.email')}
          </Text>
          <Text variant="body">{session?.user.email ?? ''}</Text>
        </View>
      </View>
      <Button
        label={t('common.save')}
        disabled={!!nameError}
        loading={update.isPending}
        onPress={save}
      />
      <View style={{ gap: 8 }}>
        <Button
          label={t('profile.leave')}
          variant="secondary"
          loading={leave.isPending}
          onPress={() => void leaveCompany()}
        />
        <Button
          label={t('profile.delete')}
          variant="danger"
          loading={del.isPending}
          onPress={() => void deleteAccount()}
        />
      </View>
    </Screen>
  );
}
