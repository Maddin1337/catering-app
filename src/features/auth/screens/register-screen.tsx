import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { AppError, toAppError } from '@/lib/errors';

import { useSignUp } from '../api';
import { registerSchema, type RegisterValues } from '../schemas';

/** SC-02 Registrierung. */
export function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const signUp = useSignUp();
  const { email: presetEmail = '' } = useLocalSearchParams<{ email?: string }>();
  const { control, handleSubmit } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: presetEmail, password: '' },
  });

  const submit = handleSubmit((values) =>
    signUp.mutate(values, {
      onSuccess: (result) => {
        // Mit bestätigter Adresse oder deaktivierter Bestätigung entsteht sofort eine Sitzung;
        // dann übernimmt das Root-Layout den Wechsel nach (app).
        if (result.alreadyRegistered || !result.needsConfirmation) return;
        router.replace({ pathname: '/verify-email', params: { email: values.email } });
      },
    }),
  );

  const error = signUp.error
    ? toAppError(signUp.error)
    : signUp.data?.alreadyRegistered
      ? new AppError('user_exists')
      : null;

  return (
    <Screen title={t('auth.register.title')} subtitle={t('auth.onlineOnly')}>
      {error ? <Banner tone="danger">{error.message}</Banner> : null}
      <View style={{ gap: 16 }}>
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
      </View>
      <Button
        label={t('auth.register.submit')}
        loading={signUp.isPending}
        onPress={() => void submit()}
      />
      <Text variant="caption" color="textTertiary">
        {t('auth.register.terms')}
      </Text>
      <View style={{ alignItems: 'center' }}>
        <Link href={{ pathname: '/login' }} asChild>
          <Text
            variant="small"
            color="accent"
            accessibilityRole="link"
            style={{ paddingVertical: 12 }}
          >
            {t('auth.register.toLogin')}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
