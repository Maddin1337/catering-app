import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { toAppError } from '@/lib/errors';

import { useCustomers, useImportCustomers } from '../api';
import { parseCustomerTable } from '../import';

/** Kunden aus Excel übernehmen: Zellen kopieren, einfügen, prüfen, importieren (am besten am Computer). */
export function CustomerImportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const customers = useCustomers();
  const importer = useImportCustomers();
  const [text, setText] = useState('');
  const [done, setDone] = useState<number | null>(null);

  const rows = parseCustomerTable(text, customers.data ?? []);
  const ok = rows.filter((r) => r.problem === null);
  const problems = rows.filter((r) => r.problem !== null);

  return (
    <Screen
      title={t('customers.import.title')}
      subtitle={t('customers.import.body')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
    >
      {importer.error ? <Banner tone="danger">{toAppError(importer.error).message}</Banner> : null}
      {done !== null ? (
        <Banner tone="success">{t('customers.import.done', { count: done })}</Banner>
      ) : null}
      <TextField
        label={t('customers.import.field')}
        helper={t('customers.import.hint')}
        value={text}
        onChangeText={(v) => {
          setDone(null);
          setText(v);
        }}
        multiline
        autoCorrect={false}
        autoCapitalize="none"
      />
      {rows.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text variant="title2">{t('customers.import.preview')}</Text>
          <Text variant="body">
            {t('customers.import.counts', { ok: ok.length, problems: problems.length })}
          </Text>
          {ok.slice(0, 5).map((r) => (
            <Text key={r.line} variant="small" color="textSecondary">
              {r.values.name}
              {r.values.email ? ` · ${r.values.email}` : ''}
              {r.values.billing_city ? ` · ${r.values.billing_city}` : ''}
            </Text>
          ))}
          {ok.length > 5 ? (
            <Text variant="small" color="textSecondary">
              {t('customers.import.more', { count: ok.length - 5 })}
            </Text>
          ) : null}
          {problems.map((r) => (
            <Text key={r.line} variant="small" color="danger">
              {t('customers.import.problem', {
                line: r.line,
                name: r.values.name || '–',
                reason: t(`customers.import.reason.${r.problem}`),
              })}
            </Text>
          ))}
        </View>
      ) : null}
      <Button
        label={t('customers.import.submit', { count: ok.length })}
        disabled={ok.length === 0 || importer.isPending}
        loading={importer.isPending}
        onPress={() =>
          importer.mutate(
            ok.map((r) => r.values),
            {
              onSuccess: (n) => {
                setDone(n);
                setText('');
              },
            },
          )
        }
      />
    </Screen>
  );
}
