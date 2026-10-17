import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { toAppError } from '@/lib/errors';

import { useResendConfirmation } from '../api';

// Sperre für „Erneut senden“ (docs/04 SC-03, Vorschlag 60 s).
const RESEND_COOLDOWN_S = 60;

/** SC-03 E-Mail bestätigen: blockiert nicht, die Einrichtung geht weiter. */
export function VerifyEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
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
        onPress={() =>
          resend.mutate(email, {
            onSuccess: () => setSeconds(RESEND_COOLDOWN_S),
          })
        }
      />
      <Button label={t('auth.verify.continue')} onPress={() => router.replace('/login')} />
      {/* Öffnet die Standard-Mail-App; ohne Mail-App passiert nichts (kein Fehler anzeigen). */}
      <Button
        label="E-Mail-App öffnen"
        variant="ghost"
        onPress={() => void Linking.openURL('mailto:').catch(() => undefined)}
      />
    </Screen>
  );
}
