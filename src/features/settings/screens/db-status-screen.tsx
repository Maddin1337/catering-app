import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toAppError } from '@/lib/errors';
import { tokens } from '@/theme/tokens';

import { useDbStatus } from '../api';
import { UPDATES } from '../db-status';

/** Datenbank-Stand: zeigt, welche SQL-Updates im Supabase SQL Editor noch fehlen. */
export function DbStatusScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const status = useDbStatus();
  const missing = UPDATES.filter((u) => status.data?.[u.file] === false);

  return (
    <Screen
      title={t('settings.db.title')}
      subtitle={t('settings.db.body')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
    >
      {status.error ? <Banner tone="danger">{toAppError(status.error).message}</Banner> : null}
      {status.data ? (
        missing.length === 0 ? (
          <Banner tone="success">{t('settings.db.allOk')}</Banner>
        ) : (
          <Banner tone="warning">
            {t('settings.db.missing', { files: missing.map((u) => `${u.file}`).join(', ') })}
          </Banner>
        )
      ) : (
        <Text variant="body">{t('common.loading')}</Text>
      )}
      <View style={{ gap: 8 }}>
        {UPDATES.map((u) => {
          const s = status.data?.[u.file];
          return (
            <View
              key={u.file}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 12,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: tokens.color.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="body">{u.title}</Text>
                <Text variant="small" color="textSecondary">
                  remote-update-{u.file}.sql
                </Text>
              </View>
              <Text
                variant="bodyStrong"
                color={s === false ? 'danger' : s ? 'accent' : 'textSecondary'}
              >
                {s === undefined
                  ? '…'
                  : s === null
                    ? t('settings.db.unknown')
                    : s
                      ? t('settings.db.ok')
                      : t('settings.db.missingShort')}
              </Text>
            </View>
          );
        })}
      </View>
      <Button
        label={t('settings.db.recheck')}
        variant="secondary"
        loading={status.isFetching}
        onPress={() => void status.refetch()}
      />
    </Screen>
  );
}
