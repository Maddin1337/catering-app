import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatDate } from '@/lib/dates';
import { shareText } from '@/lib/share';
import { tokens } from '@/theme/tokens';

import { buildInviteLink } from './invite-link';
import type { InvitationToken } from './types';

/**
 * Zeigt den Einladungslink. Der Klartext-Token existiert nur jetzt: In der Datenbank liegt nur der
 * Hash. Wer den Link verliert, erzeugt mit „Neuer Link“ einen neuen.
 */
export function InviteLinkCard({
  token,
  onClose,
}: {
  token: InvitationToken;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const link = buildInviteLink(token.token);

  const share = async () => {
    const result = await shareText(t('team.shareMessage', { link }));
    setCopied(result === 'copied');
  };

  return (
    <View
      style={{
        gap: tokens.space[3],
        padding: tokens.space[4],
        borderWidth: 1,
        borderColor: tokens.color.accent,
        borderRadius: tokens.radius.lg,
        backgroundColor: tokens.color.accentSubtle,
      }}
    >
      <Text variant="title2">{t('team.link.title')}</Text>
      <Text variant="small" selectable style={{ wordBreak: 'break-all' } as object}>
        {link}
      </Text>
      <Text variant="small" color="textSecondary">
        {t('team.link.hint', { date: formatDate(token.expires_at) })}
      </Text>
      {copied ? <Banner tone="success">{t('team.link.copied')}</Banner> : null}
      <Button label={t('team.link.share')} onPress={() => void share()} />
      <Button label={t('common.done')} variant="ghost" onPress={onClose} />
    </View>
  );
}
