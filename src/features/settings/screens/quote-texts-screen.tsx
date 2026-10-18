import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { toAppError } from '@/lib/errors';

import { ItemTemplates } from '../components/item-templates';
import { useCompanySettings, useUpdateCompanySettings } from '../api';

const KEYS = ['quote_intro_text', 'quote_terms_text', 'quote_closing_text'] as const;
type Key = (typeof KEYS)[number];

/** Angebotstexte: Einleitung, Bedingungen und Schluss, die jedes neue Angebot vorbelegen. */
export function QuoteTextsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useCompanySettings();
  const update = useUpdateCompanySettings();
  const [draft, setDraft] = useState<Partial<Record<Key, string>>>({});
  const [saved, setSaved] = useState(false);
  const value = (k: Key) => draft[k] ?? settings.data?.[k] ?? '';

  const save = () => {
    const values = Object.fromEntries(
      KEYS.map((k) => [k, value(k).trim() === '' ? null : value(k).trim()]),
    );
    update.mutate(values, {
      onSuccess: () => {
        setSaved(true);
        setDraft({});
      },
    });
  };

  return (
    <Screen
      title={t('settings.quoteTexts.title')}
      subtitle={t('settings.quoteTexts.body')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
    >
      {update.error ? <Banner tone="danger">{toAppError(update.error).message}</Banner> : null}
      {saved ? <Banner tone="success">{t('common.saved')}</Banner> : null}
      <View style={{ gap: 16 }}>
        {KEYS.map((k) => (
          <TextField
            key={k}
            label={t(`settings.quoteTexts.${k}`)}
            helper={t(`settings.quoteTexts.${k}_hint`)}
            value={value(k)}
            onChangeText={(v) => {
              setSaved(false);
              setDraft((d) => ({ ...d, [k]: v }));
            }}
            multiline
          />
        ))}
      </View>
      <Button
        label={t('common.save')}
        disabled={Object.keys(draft).length === 0}
        loading={update.isPending}
        onPress={save}
      />
      <ItemTemplates
        value={settings.data?.quote_item_templates ?? []}
        saving={update.isPending}
        onChange={(next) => update.mutate({ quote_item_templates: next })}
      />
    </Screen>
  );
}
