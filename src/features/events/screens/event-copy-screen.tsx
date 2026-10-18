import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { RadioList } from '@/components/ui/radio-list';
import { Screen } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { SwitchRow } from '@/components/ui/switch';
import { addDays, berlinToIso, isoToBerlin } from '@/lib/berlin';
import { confirm } from '@/lib/confirm';
import { toAppError } from '@/lib/errors';

import { useCopyEvent, useEvent } from '../api';

type Channel = 'phone' | 'email' | 'in_person';
const MAX_DATES = 10;

/** SC-30 Auftrag kopieren: ein oder mehrere Termine, Startstatus Anfrage oder Bestätigt, Sonderessen optional. */
export function EventCopyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id).data;
  const copy = useCopyEvent();
  // Termine als „YYYY-MM-DD“; leere Einträge sind noch nicht gewählt
  const [dates, setDates] = useState<string[]>(['']);
  const [startStatus, setStartStatus] = useState<'inquiry' | 'confirmed'>('inquiry');
  const [channel, setChannel] = useState<Channel | null>(null);
  const [dietary, setDietary] = useState(false);
  const [tried, setTried] = useState(false);

  if (!event) {
    return (
      <Screen
        title={t('events.copy.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      >
        <SkeletonList rows={3} />
      </Screen>
    );
  }
  const origin = isoToBerlin(event.starts_at);

  const chosen = dates.filter(Boolean);
  const datesError = chosen.length === 0 ? t('events.copy.dateError') : undefined;
  const channelError =
    startStatus === 'confirmed' && !channel ? t('events.dialog.channelError') : undefined;

  const setAt = (i: number, v: string) => setDates((cur) => cur.map((d, j) => (j === i ? v : d)));

  const submit = async () => {
    setTried(true);
    if (datesError || channelError) return;
    if (
      startStatus === 'confirmed' &&
      !(await confirm(
        t('events.copy.confirmTitle'),
        t('events.dialog.irreversible'),
        t('events.copy.submit'),
        t('common.cancel'),
      ))
    ) {
      return;
    }
    copy.mutate(
      {
        eventId: event.id,
        startsAt: chosen.map((d) => berlinToIso(d, origin.time)),
        copyDietary: dietary,
        startStatus,
        channel: channel ?? undefined,
      },
      {
        onSuccess: (ids) =>
          router.replace(
            ids.length === 1 ? { pathname: '/events/[id]', params: { id: ids[0]! } } : '/events',
          ),
      },
    );
  };

  return (
    <Screen
      title={t('events.copy.title')}
      subtitle={t('events.copy.body')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
      footer={
        <Button
          style={{ flex: 1 }}
          label={t('events.copy.submit')}
          loading={copy.isPending}
          onPress={() => void submit()}
        />
      }
    >
      {copy.error ? <Banner tone="danger">{toAppError(copy.error).message}</Banner> : null}
      <View style={{ gap: 12 }}>
        <Text variant="small" color="textSecondary">
          {t('events.copy.dates')}
        </Text>
        {dates.map((d, i) => (
          <View key={i} style={{ gap: 4 }}>
            <DateField
              label={t('events.copy.dateN', { n: i + 1 })}
              value={d}
              onChange={(v) => setAt(i, v)}
              startMonthFrom={addDays(origin.date, 7)}
              error={tried && i === 0 ? datesError : undefined}
            />
            {dates.length > 1 ? (
              <Button
                label={t('common.remove')}
                variant="ghost"
                onPress={() => setDates((cur) => cur.filter((_, j) => j !== i))}
              />
            ) : null}
          </View>
        ))}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button
            label={t('events.copy.sameWeekday')}
            variant="secondary"
            onPress={() => setDates([addDays(origin.date, 7)])}
          />
          {dates.length < MAX_DATES ? (
            <Button
              label={t('picker.add')}
              variant="secondary"
              onPress={() => setDates((cur) => [...cur, ''])}
            />
          ) : null}
        </View>
        <RadioList
          label={t('events.copy.status')}
          value={startStatus}
          onChange={setStartStatus}
          options={[
            { value: 'inquiry', label: t('events.copy.startInquiry') },
            { value: 'confirmed', label: t('events.copy.startConfirmed') },
          ]}
        />
        {startStatus === 'confirmed' ? (
          <>
            <RadioList
              label={t('events.dialog.channel')}
              value={channel ?? ('' as Channel)}
              onChange={setChannel}
              options={(['phone', 'email', 'in_person'] as const).map((c) => ({
                value: c,
                label: t(`events.dialog.channels.${c}`),
              }))}
            />
            {tried && channelError ? (
              <Text variant="small" color="danger">
                {channelError}
              </Text>
            ) : null}
          </>
        ) : null}
        <SwitchRow label={t('events.copy.dietary')} value={dietary} onChange={setDietary} />
      </View>
    </Screen>
  );
}
