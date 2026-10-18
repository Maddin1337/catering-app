import { useRouter } from 'expo-router';
import { Hand } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DateTile } from '@/components/ui/date-tile';
import { Pill } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { Surface } from '@/components/ui/surface';
import { isoToBerlin } from '@/lib/berlin';
import { tokens } from '@/theme/tokens';

import { useApply, useShiftBoard } from '../api';

/** SC-48 Schichtbörse: offene, passende Schichten; Bewerben mit einem Tipp. Keine Adresse, keine Preise. */
export function ShiftBoardScreen({ standalone = false }: { standalone?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const board = useShiftBoard();
  const apply = useApply();
  const list = board.data ?? [];
  const error = board.error ?? apply.error;

  return (
    <Screen
      title={t('shifts.board.title')}
      onBack={standalone ? () => router.back() : undefined}
      backLabel={t('common.back')}
    >
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {!board.isPending && list.length === 0 ? (
        <EmptyState icon={Hand} tint="amber" text={t('shifts.board.empty')} />
      ) : null}
      <View style={{ gap: 12 }}>
        {list.map((s) => {
          const mine =
            s.my_application_status &&
            s.my_application_status !== 'withdrawn' &&
            s.my_application_status !== 'cancelled_by_staff'
              ? s.my_application_status
              : null;
          const place = [s.postal_code, s.city].filter(Boolean).join(' ');
          return (
            <Surface key={s.shift_slot_id} style={styles.card}>
              <View style={styles.head}>
                <DateTile date={isoToBerlin(s.starts_at).date} />
                <View style={styles.texts}>
                  <Text variant="bodyStrong">{s.title}</Text>
                  <Text variant="small" color="textSecondary">
                    {s.qualification_name} · {formatTime(s.starts_at)}–{formatTime(s.ends_at)}
                  </Text>
                  <View style={styles.pills}>
                    <Pill
                      label={t('shifts.board.free', { count: s.free_seats })}
                      tone={s.free_seats > 0 ? 'teal' : 'slate'}
                    />
                    <Pill label={t(`shifts.board.kind.${s.event_kind}`)} tone="indigo" />
                    {s.is_tentative ? (
                      <Pill label={t('shifts.board.tentative')} tone="amber" />
                    ) : null}
                  </View>
                </View>
              </View>
              <Text variant="small" color="textSecondary">
                {[
                  s.guest_count ? t('shifts.board.guests', { count: s.guest_count }) : null,
                  place || null,
                  s.dress_code,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {mine ? (
                <Pill label={t(`shifts.status.${mine}`)} tone="teal" />
              ) : (
                <Button
                  label={t('shifts.board.apply')}
                  loading={apply.isPending && apply.variables?.slotId === s.shift_slot_id}
                  onPress={() => apply.mutate({ slotId: s.shift_slot_id, comment: '' })}
                />
              )}
            </Surface>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: tokens.space[3], padding: tokens.space[4] },
  head: { flexDirection: 'row', gap: tokens.space[3] },
  texts: { flex: 1, gap: 2 },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[1],
    marginTop: tokens.space[1],
  },
});
