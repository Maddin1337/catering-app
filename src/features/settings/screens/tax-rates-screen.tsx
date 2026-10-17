import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ListRow } from '@/components/ui/list-row';
import { RadioList } from '@/components/ui/radio-list';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { confirm } from '@/lib/confirm';
import { toAppError } from '@/lib/errors';
import { bpToPercentString, parsePercentToBp } from '@/lib/percent';

import {
  useArchiveTaxRate,
  useConfirmAllTaxRates,
  useCreateTaxRate,
  useTaxRateList,
  useUpdateTaxRate,
} from '../api';
import { TAX_CATEGORIES, type TaxCategory, type TaxRateRow } from '../types';

type Editing = { mode: 'new' } | { mode: 'edit'; row: TaxRateRow };

/** SC-60 Steuersätze: Sätze pflegen und je Positionstyp einen Standard festlegen. */
export function TaxRatesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const list = useTaxRateList();
  const create = useCreateTaxRate();
  const updateRate = useUpdateTaxRate();
  const archive = useArchiveTaxRate();
  const confirmAll = useConfirmAllTaxRates();
  const [editing, setEditing] = useState<Editing | null>(null);

  const error = list.error ?? create.error ?? updateRate.error ?? archive.error ?? confirmAll.error;
  const rows = list.data ?? [];
  const unreviewed = rows.some((r) => r.reviewed_at === null);

  return (
    <Screen
      title={t('settings.tax.title')}
      subtitle={t('settings.tax.body')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
    >
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {editing ? (
        <RateForm
          key={editing.mode === 'edit' ? editing.row.id : 'new'}
          editing={editing}
          busy={create.isPending || updateRate.isPending || archive.isPending}
          onCancel={() => setEditing(null)}
          onSave={(input) => {
            const done = { onSuccess: () => setEditing(null) };
            if (editing.mode === 'new') create.mutate(input, done);
            else updateRate.mutate({ ...input, id: editing.row.id, current: editing.row }, done);
          }}
          onArchive={async () => {
            if (editing.mode !== 'edit') return;
            const ok = await confirm(
              t('settings.tax.archiveTitle', { name: editing.row.name }),
              t('settings.tax.archiveBody'),
              t('settings.tax.archive'),
              t('common.cancel'),
            );
            if (ok) archive.mutate(editing.row.id, { onSuccess: () => setEditing(null) });
          }}
        />
      ) : (
        <>
          {unreviewed ? <Banner tone="warning">{t('settings.tax.unreviewed')}</Banner> : null}
          <Button label={t('settings.tax.add')} onPress={() => setEditing({ mode: 'new' })} />
          {unreviewed ? (
            <Button
              label={t('settings.tax.confirmAll')}
              variant="secondary"
              loading={confirmAll.isPending}
              onPress={() => confirmAll.mutate()}
            />
          ) : null}
          <View style={{ gap: 8 }}>
            {rows.map((r) => (
              <ListRow
                key={r.id}
                title={`${r.name} · ${bpToPercentString(r.rate_bp)} %`}
                subtitle={[
                  t(`settings.tax.categories.${r.category}`),
                  r.is_default ? t('settings.tax.default') : null,
                  r.reviewed_at ? null : t('settings.tax.notReviewed'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => setEditing({ mode: 'edit', row: r })}
              />
            ))}
          </View>
          <Text variant="small" color="textTertiary">
            {t('settings.tax.countryNote')}
          </Text>
        </>
      )}
    </Screen>
  );
}

function RateForm({
  editing,
  busy,
  onCancel,
  onSave,
  onArchive,
}: {
  editing: Editing;
  busy: boolean;
  onCancel: () => void;
  onSave: (v: { name: string; rateBp: number; category: TaxCategory; isDefault: boolean }) => void;
  onArchive: () => void;
}) {
  const { t } = useTranslation();
  const row = editing.mode === 'edit' ? editing.row : null;
  const [name, setName] = useState(row?.name ?? '');
  const [percent, setPercent] = useState(row ? bpToPercentString(row.rate_bp) : '');
  const [category, setCategory] = useState<TaxCategory>(row?.category ?? 'food');
  const [isDefault, setIsDefault] = useState(row?.is_default ?? false);
  const [tried, setTried] = useState(false);

  const rateBp = parsePercentToBp(percent, 0, 100);
  const nameError =
    name.trim() === '' || name.trim().length > 60 ? t('settings.tax.nameError') : undefined;
  const rateError = rateBp === null ? t('settings.tax.rateError') : undefined;

  return (
    <View style={{ gap: 16 }}>
      <TextField
        label={t('settings.tax.name')}
        value={name}
        onChangeText={setName}
        error={tried ? nameError : undefined}
        maxLength={60}
      />
      <TextField
        label={t('settings.tax.rate')}
        value={percent}
        onChangeText={setPercent}
        error={tried ? rateError : undefined}
        inputMode="decimal"
        keyboardType="decimal-pad"
      />
      {!row ? (
        <RadioList
          label={t('settings.tax.category')}
          value={category}
          onChange={setCategory}
          options={TAX_CATEGORIES.map((c) => ({
            value: c,
            label: t(`settings.tax.categories.${c}`),
          }))}
        />
      ) : null}
      {row?.is_default ? (
        <Text variant="small" color="textSecondary">
          {t('settings.tax.isDefaultNote')}
        </Text>
      ) : (
        <Checkbox
          label={t('settings.tax.makeDefault', {
            category: t(`settings.tax.categories.${category}`),
          })}
          checked={isDefault}
          onChange={setIsDefault}
        />
      )}
      <Button
        label={t('common.save')}
        loading={busy}
        onPress={() => {
          setTried(true);
          if (nameError || rateBp === null) return;
          onSave({
            name: name.trim(),
            rateBp,
            category,
            isDefault: isDefault || !!row?.is_default,
          });
        }}
      />
      {row && !row.is_default ? (
        <Button label={t('settings.tax.archive')} variant="danger" onPress={onArchive} />
      ) : null}
      <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
    </View>
  );
}
