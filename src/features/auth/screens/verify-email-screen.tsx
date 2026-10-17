import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { toAppError } from '@/lib/errors';

import { useResendConfirmation, useVerifyOtp } from '../api';
import { useSession } from '../session-provider';

// Sperre für „Erneut senden“ (docs/04 SC-03, Vorschlag 60 s); passt zu `max_frequency` in supabase/config.toml.
const RESEND_COOLDOWN_S = 60;

/**
 * SC-03 E-Mail bestätigen. Zwei Zustände unter derselben Route (docs/05 §6.3):
 * - ohne Parameter: Hinweis „Wir haben dir einen Link geschickt“ direkt nach der Registrierung;
 * - mit `token_hash` und `type=email`: der Link aus der Bestätigungs-Mail wird eingelöst.
 */
export function VerifyEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    email = '',
    token_hash: tokenHash,
    type,
  } = useLocalSearchParams<{ email?: string; token_hash?: string; type?: string }>();
  const hasLink = !!tokenHash && type === 'email';

  return hasLink ? (
    <ConfirmLink tokenHash={tokenHash} />
  ) : (
    <CheckMail email={email} onContinue={() => router.replace('/login')} t={t} />
  );
}

function ConfirmLink({ tokenHash }: { tokenHash: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useSession();
  const verify = useVerifyOtp();
  const started = useRef(false);

  useEffect(() => {
    // Der Link ist einmalig: nie zweimal einlösen.
    if (!started.current) {
      started.current = true;
      verify.mutate({ tokenHash, type: 'email' });
    }
  }, [tokenHash, verify]);

  // Nach erfolgreicher Bestätigung besteht eine Sitzung: weiter zum Willkommens-Bildschirm.
  useEffect(() => {
    if (verify.isSuccess && status === 'signedIn') router.replace('/welcome');
  }, [verify.isSuccess, status, router]);

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

function CheckMail({
  email,
  onContinue,
  t,
}: {
  email: string;
  onContinue: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const resend = useResendConfirmation();
  const [seconds, setSeconds] = useState(RESEND_COOLDOWN_S);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  return (
    <Screen title={t('auth.verify.title')} subtitle={t('auth.verify.body', { email })}>
      {resend.isSuccess ? <Banner tone="success">{t('auth.verify.resent')}</Banner> : null}
      {resend.error ? <Banner tone="danger">{toAppError(resend.error).message}</Banner> : null}
      <Button
        label={seconds > 0 ? t('auth.verify.resendIn', { seconds }) : t('auth.verify.resend')}
        variant="secondary"
        disabled={seconds > 0 || !email}
        loading={resend.isPending}
        onPress={() => resend.mutate(email, { onSuccess: () => setSeconds(RESEND_COOLDOWN_S) })}
      />
      <Button label={t('auth.verify.toLogin')} onPress={onContinue} />
      {/* Öffnet die Standard-Mail-App; ohne Mail-App passiert nichts. */}
      <Button
        label={t('auth.verify.openMail')}
        variant="ghost"
        onPress={() => void Linking.openURL('mailto:').catch(() => undefined)}
      />
    </Screen>
  );
}
