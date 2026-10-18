import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatDate, formatTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { tokens } from '@/theme/tokens';

import { useApply, useShiftBoard } from '../api';

/** SC-48 Schichtbörse: offene, passende Schichten; Bewerben mit einem Tipp. Keine Adresse, keine Preise. */
export function ShiftBoardScreen() {
  const { t } = useTranslation();
  const board = useShiftBoard();
  const apply = useApply();
  const list = board.data ?? [];
  const error = board.error ?? apply.error;

  return (
    <Screen title={t('shifts.board.title')}>
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {!board.isPending && list.length === 0 ? (
        <Text variant="body" color="textSecondary">
          {t('shifts.board.empty')}
        </Text>
      ) : null}
      <View style={{ gap: 12 }}>
        {list.map((s) => (
          <View
            key={s.shift_slot_id}
            style={{
              gap: 6,
              padding: tokens.space[4],
              borderWidth: 1,
              borderColor: tokens.color.border,
              borderRadius: tokens.radius.lg,
            }}
          >
            <Text variant="bodyStrong">
              {s.title} · {s.qualification_name}
            </Text>
            <Text variant="body">
              {formatDate(s.starts_at)} · {formatTime(s.starts_at)}–{formatTime(s.ends_at)}
            </Text>
            <Text variant="small" color="textSecondary">
              {[
                t(`shifts.board.kind.${s.event_kind}`),
                s.guest_count ? t('shifts.board.guests', { count: s.guest_count }) : null,
                [s.postal_code, s.city].filter(Boolean).join(' ') || null,
                s.dress_code,
                t('shifts.board.free', { count: s.free_seats }),
                s.is_tentative ? t('shifts.board.tentative') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {s.my_application_status &&
            s.my_application_status !== 'withdrawn' &&
            s.my_application_status !== 'cancelled_by_staff' ? (
              <Text variant="bodyStrong" color="accent">
                {t(`shifts.status.${s.my_application_status}`)}
              </Text>
            ) : (
              <Button
                label={t('shifts.board.apply')}
                loading={apply.isPending && apply.variables?.slotId === s.shift_slot_id}
                onPress={() => apply.mutate({ slotId: s.shift_slot_id, comment: '' })}
              />
            )}
          </View>
        ))}
      </View>
    </Screen>
  );
}
