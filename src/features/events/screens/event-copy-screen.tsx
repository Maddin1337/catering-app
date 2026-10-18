import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioList } from '@/components/ui/radio-list';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { addDays, berlinToIso, formatGermanDate, isoToBerlin, parseGermanDate } from '@/lib/berlin';
import { confirm } from '@/lib/confirm';
import { toAppError } from '@/lib/errors';

import { useCopyEvent, useEvent } from '../api';

type Channel = 'phone' | 'email' | 'in_person';

/** SC-30 Auftrag kopieren: ein oder mehrere Termine, Startstatus Anfrage oder Bestätigt, Sonderessen optional. */
export function EventCopyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id).data;
  const copy = useCopyEvent();
  const [dates, setDates] = useState('');
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
        <Text>{t('common.loading')}</Text>
      </Screen>
    );
  }
  const origin = isoToBerlin(event.starts_at);

  const lines = dates
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const parsed = lines.map(parseGermanDate);
  const datesError =
    lines.length === 0 || lines.length > 10 || parsed.some((p) => !p)
      ? t('events.copy.dateError')
      : undefined;
  const channelError =
    startStatus === 'confirmed' && !channel ? t('events.dialog.channelError') : undefined;

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
    )
      return;
    copy.mutate(
      {
        eventId: event.id,
        startsAt: (parsed as string[]).map((d) => berlinToIso(d, origin.time)),
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
    >
      {copy.error ? <Banner tone="danger">{toAppError(copy.error).message}</Banner> : null}
      <View style={{ gap: 12 }}>
        <TextField
          label={t('events.copy.dates')}
          value={dates}
          onChangeText={setDates}
          error={tried ? datesError : undefined}
          multiline
        />
        <Button
          label={t('events.copy.sameWeekday')}
          variant="secondary"
          onPress={() => setDates(formatGermanDate(addDays(origin.date, 7)))}
        />
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
        <Checkbox label={t('events.copy.dietary')} checked={dietary} onChange={setDietary} />
      </View>
      <Button
        label={t('events.copy.submit')}
        loading={copy.isPending}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
