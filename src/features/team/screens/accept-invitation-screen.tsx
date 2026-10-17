import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatDate } from '@/lib/dates';
import { AppError, toAppError } from '@/lib/errors';
import { pendingInvite } from '@/lib/pending-invite';
import { tokens } from '@/theme/tokens';

import { useSession } from '../../auth/session-provider';
import { useSetupStage } from '../../company/use-setup-stage';
import { useAcceptInvitation, useInvitationPreview } from '../api';

/** SC-06 Einladung annehmen: erreichbar mit und ohne Sitzung. */
export function AcceptInvitationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { status } = useSession();
  const { stage } = useSetupStage();
  const preview = useInvitationPreview(token);
  const accept = useAcceptInvitation();

  // Der Token überlebt Registrierung und Bestätigungs-Mail: danach führt das Willkommen hierher zurück.
  useEffect(() => {
    if (token && status === 'signedOut') void pendingInvite.set(token);
  }, [token, status]);

  const home = () => router.replace('/');
  const join = () =>
    accept.mutate(token!, {
      onSuccess: () => {
        void pendingInvite.clear();
        home();
      },
    });

  const data = preview.data;
  const email = data && data.status !== 'invalid' ? (data.email ?? '') : '';
  const alreadyMember = stage === 'ready' || stage === 'onboarding';

  if (preview.isPending) {
    return (
      <Screen title={t('invite.title')} subtitle={t('common.loading')}>
        {null}
      </Screen>
    );
  }

  if (preview.isError || !data || data.status === 'invalid') {
    return (
      <Screen title={t('invite.title')}>
        <Banner tone="danger">
          {preview.isError
            ? toAppError(preview.error).message
            : new AppError('invitation_invalid').message}
        </Banner>
        <Button label={t('invite.home')} onPress={home} />
      </Screen>
    );
  }

  if (data.status !== 'open') {
    const code = {
      revoked: 'invitation_revoked',
      expired: 'invitation_expired',
      accepted: 'invitation_accepted',
    }[data.status] as 'invitation_revoked';
    return (
      <Screen title={t('invite.title')}>
        <Banner tone="danger">{new AppError(code).message}</Banner>
        <Button label={t('invite.home')} onPress={home} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t('invite.heading', { company: data.company_name })}
      subtitle={t('invite.asRole', { role: t(`role.${data.role}`) })}
    >
      <View
        style={{
          gap: tokens.space[2],
          padding: tokens.space[4],
          borderWidth: 1,
          borderColor: data.accent_color ?? tokens.color.border,
          borderRadius: tokens.radius.lg,
        }}
      >
        <Text variant="title2">{data.display_name}</Text>
        {data.qualifications.length > 0 ? (
          <Text variant="small" color="textSecondary">
            {t('invite.qualifications', { list: data.qualifications.join(', ') })}
          </Text>
        ) : null}
        <Text variant="small" color="textSecondary">
          {t('invite.validUntil', { date: formatDate(data.expires_at) })}
        </Text>
      </View>

      {accept.error ? <Banner tone="danger">{toAppError(accept.error).message}</Banner> : null}

      {status === 'signedIn' ? (
        alreadyMember ? (
          <>
            <Banner tone="info">{new AppError('already_member').message}</Banner>
            <Button label={t('invite.home')} onPress={home} />
          </>
        ) : (
          <Button label={t('invite.join')} loading={accept.isPending} onPress={join} />
        )
      ) : (
        <>
          <Text variant="body" color="textSecondary">
            {t('invite.needAccount')}
          </Text>
          <Button
            label={t('invite.register')}
            onPress={() => router.push({ pathname: '/register', params: { email } })}
          />
          <Button
            label={t('invite.login')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/login', params: { email } })}
          />
        </>
      )}
    </Screen>
  );
}
