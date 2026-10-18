import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { authEmailCode } from '@/lib/env';
import { toAppError } from '@/lib/errors';

import { useRequestPasswordReset } from '../api';
import { forgotPasswordSchema, type ForgotPasswordValues } from '../schemas';

/** SC-04 Passwort vergessen: neutrale Bestätigung, verrät nicht, ob es ein Konto gibt. */
export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const request = useRequestPasswordReset();
  const { control, handleSubmit } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  // Die Mail enthält Link und Code. Wer den Link nicht öffnen kann, gibt den Code auf der nächsten Seite ein.
  const submit = handleSubmit((v) =>
    request.mutate(v.email, {
      // Mit Code in der Mail geht es auf die Code-Seite; sonst bleibt die neutrale Bestätigung stehen.
      onSuccess: () => {
        if (authEmailCode) {
          router.push({ pathname: '/reset-password', params: { email: v.email.trim() } });
        }
      },
    }),
  );

  return (
    <Screen
      title={t('auth.forgot.title')}
      subtitle={t(authEmailCode ? 'auth.forgot.body' : 'auth.forgot.bodyLinkOnly')}
    >
      {request.isSuccess && !authEmailCode ? (
        <Banner tone="success">{t('auth.forgot.sent')}</Banner>
      ) : null}
      {request.error ? <Banner tone="danger">{toAppError(request.error).message}</Banner> : null}
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label={t('auth.email')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            inputMode="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        )}
      />
      <Button
        label={t('auth.forgot.submit')}
        loading={request.isPending}
        onPress={() => void submit()}
      />
      <View style={{ alignItems: 'center' }}>
        <Link href="/login" asChild>
          <Text
            variant="small"
            color="accent"
            accessibilityRole="link"
            style={{ paddingVertical: 12 }}
          >
            {t('auth.forgot.back')}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
