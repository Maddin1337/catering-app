import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { toAppError } from '@/lib/errors';

import { useUpdatePassword, useVerifyOtp } from '../api';
import {
  OTP_LENGTH,
  resetPasswordSchema,
  resetWithCodeSchema,
  type ResetPasswordValues,
  type ResetWithCodeValues,
} from '../schemas';
import { useSession } from '../session-provider';

/**
 * SC-05 Neues Passwort. Die Mail enthält Link und Code (Entscheidung R3-2):
 * - Link: `token_hash` und `type=recovery`; die Seite löst ihn einmal ein und legt damit eine
 *   Wiederherstellungs-Sitzung an, danach genügen zwei Passwortfelder.
 * - Code: Die Seite öffnet sich mit `email` (von „Passwort vergessen“); Code und neues Passwort
 *   stehen in einem Formular.
 * - Ohne beides (direkter Aufruf, alter Link): Hinweis mit Weg zu einem neuen Link.
 */
export function ResetPasswordScreen() {
  const { t } = useTranslation();
  const {
    token_hash: tokenHash,
    type,
    email,
  } = useLocalSearchParams<{ token_hash?: string; type?: string; email?: string }>();
  const { status } = useSession();
  const verify = useVerifyOtp();
  const verified = useRef(false);
  const hasLink = !!tokenHash && type === 'recovery';

  useEffect(() => {
    // Der Link ist einmalig: nie zweimal einlösen (z. B. durch erneutes Rendern).
    if (hasLink && !verified.current) {
      verified.current = true;
      verify.mutate({ tokenHash, type: 'recovery' });
    }
  }, [hasLink, tokenHash, verify]);

  if (hasLink) {
    if (verify.isError) return <Expired />;
    // Bis die Sitzung des eingelösten Links angekommen ist, nichts anderes anzeigen (kein Flackern).
    if (!verify.isSuccess || status !== 'signedIn') {
      return (
        <Screen title={t('auth.reset.title')} subtitle={t('auth.reset.checking')}>
          {null}
        </Screen>
      );
    }
    return <NewPasswordForm />;
  }

  if (email) return <CodeForm email={email} />;

  return <Expired />;
}

function Expired() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen title={t('auth.reset.title')}>
      <Banner tone="danger">{t('auth.reset.expired')}</Banner>
      <Button label={t('auth.reset.newLink')} onPress={() => router.replace('/forgot-password')} />
    </Screen>
  );
}

function PasswordFields({ control }: { control: Control<ResetPasswordValues> }) {
  const { t } = useTranslation();
  return (
    <>
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
    </>
  );
}

/** Link eingelöst: es besteht eine Sitzung, nur das neue Passwort fehlt. */
function NewPasswordForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const update = useUpdatePassword();
  const { control, handleSubmit } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', passwordConfirm: '' },
  });
  // Nach dem Speichern bleibt die Sitzung bestehen; das Root-Layout führt in die App.
  const submit = handleSubmit((v) =>
    update.mutate(v.password, { onSuccess: () => router.replace('/') }),
  );

  return (
    <Screen title={t('auth.reset.title')}>
      {update.error ? <Banner tone="danger">{toAppError(update.error).message}</Banner> : null}
      <View style={{ gap: 16 }}>
        <PasswordFields control={control} />
      </View>
      <Button
        label={t('auth.reset.submit')}
        loading={update.isPending}
        onPress={() => void submit()}
      />
    </Screen>
  );
}

/** Code statt Link: erst den Code einlösen (Sitzung), dann das Passwort setzen. */
function CodeForm({ email }: { email: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const verify = useVerifyOtp();
  const update = useUpdatePassword();
  const { control, handleSubmit } = useForm<ResetWithCodeValues>({
    resolver: zodResolver(resetWithCodeSchema),
    defaultValues: { code: '', password: '', passwordConfirm: '' },
  });

  const submit = handleSubmit(async (v) => {
    try {
      await verify.mutateAsync({ email, code: v.code, type: 'recovery' });
      await update.mutateAsync(v.password);
      router.replace('/');
    } catch {
      // Fehler stehen in verify.error bzw. update.error und werden unten angezeigt.
    }
  });

  const error = verify.error ?? update.error;

  return (
    <Screen title={t('auth.reset.title')} subtitle={t('auth.reset.codeBody', { email })}>
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      <View style={{ gap: 16 }}>
        <Controller
          control={control}
          name="code"
          render={({ field, fieldState }) => (
            <TextField
              label={t('auth.verify.codeLabel')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              autoCorrect={false}
            />
          )}
        />
        {/* Die Passwortfelder kennen das Feld `code` nicht; sie lesen und schreiben nur die zwei Passwörter. */}
        <PasswordFields control={control as unknown as Control<ResetPasswordValues>} />
      </View>
      <Button
        label={t('auth.reset.submit')}
        loading={verify.isPending || update.isPending}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
