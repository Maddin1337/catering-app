import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { webUrl } from '@/lib/env';
import { confirm } from '@/lib/confirm';
import { toAppError } from '@/lib/errors';
import { shareText } from '@/lib/share';
import { surfaceStyle } from '@/components/ui/surface';
import { tokens } from '@/theme/tokens';

import { useIcalToken, useResetIcalToken } from '../api';

/** SC-70 Kalender-Abo: persönlicher Link für Apple, Google oder Outlook Kalender. */
export function CalendarFeed() {
  const { t } = useTranslation();
  const token = useIcalToken();
  const reset = useResetIcalToken();
  const [notice, setNotice] = useState<string | null>(null);
  const base = webUrl || (Platform.OS === 'web' ? window.location.origin : '');
  const link = token.data ? `${base}/api/ical?token=${token.data}` : null;
  const webcal = link ? link.replace(/^https?:/, 'webcal:') : null;

  return (
    <View
      style={{
        gap: 8,
        padding: tokens.space[4],
        ...surfaceStyle(),
      }}
    >
      <Text variant="title2">{t('profile.calendar.title')}</Text>
      <Text variant="small" color="textSecondary">
        {t('profile.calendar.body')}
      </Text>
      {token.error || reset.error ? (
        <Banner tone="danger">{toAppError(token.error ?? reset.error).message}</Banner>
      ) : null}
      {notice ? <Banner tone="info">{notice}</Banner> : null}
      {link ? (
        <>
          <Text variant="small" selectable>
            {link}
          </Text>
          <Button
            label={t('profile.calendar.subscribe')}
            onPress={() => void Linking.openURL(webcal!)}
          />
          <Button
            label={t('profile.calendar.copy')}
            variant="secondary"
            onPress={async () => {
              const r = await shareText(link);
              setNotice(r === 'copied' ? t('profile.calendar.copied') : null);
            }}
          />
          <Button
            label={t('profile.calendar.reset')}
            variant="ghost"
            loading={reset.isPending}
            onPress={async () => {
              const ok = await confirm(
                t('profile.calendar.resetTitle'),
                t('profile.calendar.resetBody'),
                t('profile.calendar.resetAction'),
                t('common.cancel'),
              );
              if (ok) reset.mutate();
            }}
          />
          <Text variant="small" color="textTertiary">
            {t('profile.calendar.hint')}
          </Text>
        </>
      ) : null}
    </View>
  );
}
