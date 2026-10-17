import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { toAppError } from '@/lib/errors';

import { useUpdatePassword, useVerifyOtp } from '../api';
import { useSession } from '../session-provider';
import { resetPasswordSchema, type ResetPasswordValues } from '../schemas';

/**
 * SC-05 Neues Passwort. Der Link aus der E-Mail enthält `token_hash` und `type=recovery`; die
 * Seite löst ihn einmal ein und legt damit eine Wiederherstellungs-Sitzung an.
 */
export function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token_hash: tokenHash, type } = useLocalSearchParams<{
    token_hash?: string;
    type?: string;
  }>();
  const { status } = useSession();
  const verify = useVerifyOtp();
  const update = useUpdatePassword();
  const verified = useRef(false);
  const hasLink = !!tokenHash && type === 'recovery';

  useEffect(() => {
    // Der Link ist einmalig: nie zweimal einlösen (z. B. durch erneutes Rendern).
    if (hasLink && !verified.current) {
      verified.current = true;
      verify.mutate({ tokenHash, type: 'recovery' });
    }
  }, [hasLink, tokenHash, verify]);

  const { control, handleSubmit } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', passwordConfirm: '' },
  });

  const submit = handleSubmit((v) =>
    // Nach dem Speichern bleibt die Sitzung bestehen; das Root-Layout führt in die App.
    update.mutate(v.password, { onSuccess: () => router.replace('/') }),
  );

  const expired = verify.isError || (status === 'signedOut' && !hasLink && !verify.isPending);
  const checking = status === 'loading' || verify.isPending;

  if (checking) {
    return (
      <Screen title={t('auth.reset.title')} subtitle={t('auth.reset.checking')}>
        {null}
      </Screen>
    );
  }

  if (expired) {
    return (
      <Screen title={t('auth.reset.title')}>
        <Banner tone="danger">{t('auth.reset.expired')}</Banner>
        <Button
          label={t('auth.reset.newLink')}
          onPress={() => router.replace('/forgot-password')}
        />
      </Screen>
    );
  }

  return (
    <Screen title={t('auth.reset.title')}>
      {update.error ? <Banner tone="danger">{toAppError(update.error).message}</Banner> : null}
      <View style={{ gap: 16 }}>
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <TextField
              label={t('auth.password')}
              helper={t('auth.register.passwordHint')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
              revealable
              showLabel={t('common.show')}
              hideLabel={t('common.hide')}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
            />
          )}
        />
        <Controller
          control={control}
          name="passwordConfirm"
          render={({ field, fieldState }) => (
            <TextField
              label={t('auth.passwordConfirm')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
            />
          )}
        />
      </View>
      <Button
        label={t('auth.reset.submit')}
        loading={update.isPending}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
