import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { toAppError } from '@/lib/errors';

import { useResendConfirmation, useVerifyOtp } from '../api';
import { OTP_LENGTH, otpSchema, type OtpValues } from '../schemas';
import { useSession } from '../session-provider';

// Sperre für „Erneut senden“ (docs/04 SC-03, Vorschlag 60 s); passt zu `max_frequency` in supabase/config.toml.
const RESEND_COOLDOWN_S = 60;

/**
 * SC-03 E-Mail bestätigen. Die Mail enthält Link und Code (Entscheidung R3-2). Zwei Zustände
 * unter derselben Route (docs/05 §6.3):
 * - ohne `token_hash`: Hinweis direkt nach der Registrierung mit Feld für den Code;
 * - mit `token_hash` und `type=email`: der Link aus der Bestätigungs-Mail wird eingelöst.
 */
export function VerifyEmailScreen() {
  const {
    email = '',
    token_hash: tokenHash,
    type,
  } = useLocalSearchParams<{ email?: string; token_hash?: string; type?: string }>();
  const hasLink = !!tokenHash && type === 'email';

  return hasLink ? <ConfirmLink tokenHash={tokenHash} /> : <CheckMail email={email} />;
}

/** Nach erfolgreicher Bestätigung besteht eine Sitzung: weiter zum Willkommens-Bildschirm. */
function useContinueWhenSignedIn(success: boolean) {
  const router = useRouter();
  const { status } = useSession();
  useEffect(() => {
    if (success && status === 'signedIn') router.replace('/welcome');
  }, [success, status, router]);
}

function ConfirmLink({ tokenHash }: { tokenHash: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const verify = useVerifyOtp();
  const started = useRef(false);

  useEffect(() => {
    // Der Link ist einmalig: nie zweimal einlösen.
    if (!started.current) {
      started.current = true;
      verify.mutate({ tokenHash, type: 'email' });
    }
  }, [tokenHash, verify]);

  useContinueWhenSignedIn(verify.isSuccess);

  if (verify.isError) {
    return (
      <Screen title={t('auth.verify.title')}>
        <Banner tone="danger">{t('auth.verify.expired')}</Banner>
        <Button label={t('auth.verify.toLogin')} onPress={() => router.replace('/login')} />
      </Screen>
    );
  }
  return (
    <Screen title={t('auth.verify.title')} subtitle={t('auth.verify.checking')}>
      {null}
    </Screen>
  );
}

function CheckMail({ email }: { email: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const resend = useResendConfirmation();
  const verify = useVerifyOtp();
  const [seconds, setSeconds] = useState(RESEND_COOLDOWN_S);
  const { control, handleSubmit } = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: '' },
  });
  const submit = handleSubmit(({ code }) => verify.mutate({ email, code, type: 'email' }));

  useContinueWhenSignedIn(verify.isSuccess);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const error = verify.error ?? resend.error;

  return (
    <Screen title={t('auth.verify.title')} subtitle={t('auth.verify.body', { email })}>
      {resend.isSuccess ? <Banner tone="success">{t('auth.verify.resent')}</Banner> : null}
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      <Controller
        control={control}
        name="code"
        render={({ field, fieldState }) => (
          <TextField
            label={t('auth.verify.codeLabel')}
            helper={t('auth.verify.codeHint')}
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
            onSubmitEditing={() => void submit()}
          />
        )}
      />
      <Button
        label={t('auth.verify.codeSubmit')}
        loading={verify.isPending}
        onPress={() => void submit()}
      />
      <Button
        label={seconds > 0 ? t('auth.verify.resendIn', { seconds }) : t('auth.verify.resend')}
        variant="secondary"
        disabled={seconds > 0 || !email}
        loading={resend.isPending}
        onPress={() => resend.mutate(email, { onSuccess: () => setSeconds(RESEND_COOLDOWN_S) })}
      />
      <Button
        label={t('auth.verify.toLogin')}
        variant="ghost"
        onPress={() => router.replace('/login')}
      />
      {/* Öffnet die Standard-Mail-App; ohne Mail-App passiert nichts. */}
      <Button
        label={t('auth.verify.openMail')}
        variant="ghost"
        onPress={() => void Linking.openURL('mailto:').catch(() => undefined)}
      />
    </Screen>
  );
}
