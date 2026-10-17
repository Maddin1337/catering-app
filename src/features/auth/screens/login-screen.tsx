import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { toAppError } from '@/lib/errors';

import { useSignIn } from '../api';
import { loginSchema, type LoginValues } from '../schemas';

/** SC-01 Login. Nach dem Anmelden wechselt das Root-Layout automatisch in `(app)`. */
export function LoginScreen() {
  const { t } = useTranslation();
  const signIn = useSignIn();
  const { email: presetEmail = '' } = useLocalSearchParams<{ email?: string }>();
  const { control, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: presetEmail, password: '' },
  });

  const submit = handleSubmit((v) => signIn.mutate(v));

  return (
    <Screen title={t('auth.login.title')} subtitle={t('auth.onlineOnly')}>
      {signIn.error ? <Banner tone="danger">{toAppError(signIn.error).message}</Banner> : null}
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
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
              revealable
              showLabel={t('common.show')}
              hideLabel={t('common.hide')}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={() => void submit()}
            />
          )}
        />
      </View>
      <Button
        label={t('auth.login.submit')}
        loading={signIn.isPending || formState.isSubmitting}
        onPress={() => void submit()}
      />
      <View style={{ gap: 8, alignItems: 'center' }}>
        <Link href="/forgot-password" asChild>
          <Text variant="small" color="accent" accessibilityRole="link">
            {t('auth.login.forgot')}
          </Text>
        </Link>
        <Link href="/register" asChild>
          <Text variant="small" color="accent" accessibilityRole="link">
            {t('auth.login.toRegister')}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
