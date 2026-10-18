import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ClipboardList } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { confirm } from '@/lib/confirm';
import { formatDate, formatDateTime, formatTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { surfaceStyle } from '@/components/ui/surface';
import { tokens } from '@/theme/tokens';

import { useCompanyProfile } from '../../company/api';
import { useCancelMine, useMyShifts } from '../api';
import type { MyShift } from '../types';

const CLOSED = ['rejected', 'withdrawn', 'cancelled_by_staff'];

/** SC-50/SC-51 Meine Einsätze: Status, Einsatzinfos nach der Zusage, Absagen bis zur Frist. */
export function MyShiftsScreen({ standalone = false }: { standalone?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const shifts = useMyShifts();
  const cancel = useCancelMine();
  const phone = useCompanyProfile().data?.phone ?? null;
  const [phoneHint, setPhoneHint] = useState(false);
  const list = shifts.data ?? [];
  const current = list.filter((s) => !CLOSED.includes(s.status));
  const error =
    shifts.error ??
    (cancel.error && toAppError(cancel.error).code !== 'deadline_passed' ? cancel.error : null);

  const doCancel = async (s: MyShift) => {
    const ok = await confirm(
      t('shifts.mine.cancelTitle'),
      t('shifts.mine.cancelBody', { date: formatDateTime(s.cancel_deadline_at) }),
      t('shifts.mine.cancelAction'),
      t('common.cancel'),
    );
    if (!ok) return;
    setPhoneHint(false);
    cancel.mutate(
      { id: s.application_id, reason: '' },
      { onError: (e) => setPhoneHint(toAppError(e).code === 'deadline_passed') },
    );
  };

  return (
    <Screen
      title={t('shifts.mine.title')}
      onBack={standalone ? () => router.back() : undefined}
      backLabel={t('common.back')}
    >
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {phoneHint ? <Banner tone="warning">{t('shifts.mine.phoneOnly')}</Banner> : null}
      {phoneHint && phone ? (
        <Button
          label={`${t('shifts.mine.call')}: ${phone}`}
          variant="secondary"
          onPress={() => void Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`)}
        />
      ) : null}
      {!shifts.isPending && current.length === 0 ? (
        <EmptyState icon={ClipboardList} text={t('shifts.mine.empty')} />
      ) : null}
      <View style={{ gap: 12 }}>
        {current.map((s) => (
          <View
            key={s.application_id}
            style={{
              gap: 6,
              padding: tokens.space[4],
              ...surfaceStyle(),
              opacity: s.is_called_off ? 0.6 : 1,
            }}
          >
            <Text variant="bodyStrong">
              {s.title} · {s.qualification_name}
            </Text>
            <Text variant="body">
              {formatDate(s.starts_at)} · {formatTime(s.starts_at)}–{formatTime(s.ends_at)}
            </Text>
            <Text variant="bodyStrong" color={s.is_called_off ? 'danger' : 'accent'}>
              {s.is_called_off ? t('shifts.mine.calledOff') : t(`shifts.status.${s.status}`)}
              {s.is_tentative && !s.is_called_off ? ` · ${t('shifts.board.tentative')}` : ''}
            </Text>
            {s.status === 'applied' ? (
              <Text variant="small" color="textSecondary">
                {t('shifts.mine.pending')}
              </Text>
            ) : null}
            {(s.status === 'accepted' || s.status === 'assigned') && !s.is_called_off ? (
              <Info s={s} />
            ) : null}
            {s.status === 'applied' ? (
              <Button
                label={t('shifts.mine.withdraw')}
                variant="secondary"
                onPress={() => cancel.mutate({ id: s.application_id, reason: '' })}
              />
            ) : null}
            {(s.status === 'accepted' || s.status === 'assigned') && !s.is_called_off ? (
              <>
                <Text variant="small" color="textSecondary">
                  {t('shifts.mine.deadline', { date: formatDateTime(s.cancel_deadline_at) })}
                </Text>
                <Button
                  label={t('shifts.mine.cancel')}
                  variant="secondary"
                  onPress={() => void doCancel(s)}
                />
              </>
            ) : null}
          </View>
        ))}
      </View>
    </Screen>
  );
}

function Info({ s }: { s: MyShift }) {
  const { t } = useTranslation();
  const place = [s.venue_name, s.street, [s.postal_code, s.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  const rows: [string, string | null][] = [
    [t('shifts.mine.venue'), place || null],
    [t('shifts.mine.meeting'), s.meeting_point],
    [t('shifts.mine.dress'), s.dress_code],
    [t('shifts.mine.notes'), [s.staff_notes, s.slot_notes].filter(Boolean).join('\n') || null],
  ];
  return (
    <View style={{ gap: 4, paddingTop: 4 }}>
      <Text variant="small" color="textSecondary">
        {t('shifts.mine.info')}
      </Text>
      {rows.map(([label, value]) =>
        value ? (
          <Text key={label} variant="body">
            {label}: {value}
          </Text>
        ) : null,
      )}
      {s.onsite_contact_name || s.onsite_contact_phone ? (
        <Text
          variant="body"
          color={s.onsite_contact_phone ? 'accent' : 'text'}
          onPress={
            s.onsite_contact_phone
              ? () => void Linking.openURL(`tel:${s.onsite_contact_phone!.replace(/\s+/g, '')}`)
              : undefined
          }
        >
          {t('shifts.mine.contact')}:{' '}
          {[s.onsite_contact_name, s.onsite_contact_phone].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}
