import { useRouter } from 'expo-router';
import {
  Ban,
  Bell,
  Check,
  CheckCheck,
  Hand,
  MessageSquareWarning,
  PartyPopper,
  Salad,
  Sparkles,
  Undo2,
  UserX,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Appear } from '@/components/ui/appear';
import { Banner } from '@/components/ui/banner';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton';
import { surfaceStyle } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { toAppError } from '@/lib/errors';
import { tints, tokens } from '@/theme/tokens';

import { useMembership } from '../../company/api';
import { useMarkNotificationsRead, useNotifications } from '../api';
import { ago, describe, splitByDay } from '../describe';
import type { AppNotification } from '../types';

const ICONS: Record<string, LucideIcon> = {
  hand: Hand,
  undo: Undo2,
  'user-x': UserX,
  check: Check,
  x: X,
  sparkles: Sparkles,
  ban: Ban,
  party: PartyPopper,
  message: MessageSquareWarning,
  salad: Salad,
};

// Wer die Liste so lange offen hat, hat die neuen Mitteilungen gesehen.
const MARK_READ_AFTER_MS = 1500;

/** Mitteilungen: Heute und Früher, Neues hervorgehoben; Tippen führt zum Auftrag bzw. zu den Schichten. */
export function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const role = useMembership().data?.role ?? 'staff';
  const list = useNotifications();
  const mark = useMarkNotificationsRead();
  const items = list.data ?? [];
  const unread = items.some((n) => !n.read_at);
  const { today, earlier } = splitByDay(items);
  const markAll = mark.mutate;

  useEffect(() => {
    if (!unread) return;
    const id = setTimeout(() => markAll(undefined), MARK_READ_AFTER_MS);
    return () => clearTimeout(id);
  }, [unread, markAll]);

  const section = (label: string, rows: AppNotification[], offset: number) =>
    rows.length > 0 ? (
      <View style={styles.section}>
        <Text variant="caption" color="textSecondary" style={styles.sectionTitle}>
          {label.toUpperCase()}
        </Text>
        <View style={[surfaceStyle('card'), styles.card]}>
          {rows.map((n, i) => {
            const d = describe(n, role, t);
            const Icon = ICONS[d.icon] ?? Bell;
            return (
              <Appear key={n.id} index={offset + i}>
                <PressableScale
                  accessibilityRole={d.target ? 'button' : undefined}
                  accessibilityLabel={`${n.read_at ? '' : `${t('notifications.unread')}: `}${d.title}. ${d.body}`}
                  disabled={!d.target}
                  onPress={() => d.target && router.push(d.target)}
                  scale={0.985}
                  pressedStyle={{ backgroundColor: tokens.color.bgSubtle }}
                  style={[styles.row, i > 0 && styles.divider, !n.read_at && styles.unreadRow]}
                >
                  <View style={[styles.icon, { backgroundColor: tints[d.tint].bg }]}>
                    <Icon color={tints[d.tint].fg} size={18} strokeWidth={2.2} />
                  </View>
                  <View style={styles.texts}>
                    <View style={styles.titleRow}>
                      <Text variant="bodyStrong" style={styles.title}>
                        {d.title}
                      </Text>
                      <Text variant="caption" color="textTertiary">
                        {ago(n.created_at, t)}
                      </Text>
                    </View>
                    <Text variant="small" color="textSecondary">
                      {d.body}
                    </Text>
                  </View>
                  {!n.read_at ? <View style={styles.dot} /> : null}
                </PressableScale>
              </Appear>
            );
          })}
        </View>
      </View>
    ) : null;

  return (
    <Screen
      title={t('notifications.title')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
      actions={
        unread ? (
          <IconButton
            icon={CheckCheck}
            label={t('notifications.markAll')}
            onPress={() => markAll(undefined)}
          />
        ) : null
      }
      onRefresh={() => void list.refetch()}
      refreshing={list.isRefetching}
    >
      {list.error ? <Banner tone="danger">{toAppError(list.error).message}</Banner> : null}
      {list.isPending ? <SkeletonList rows={4} /> : null}
      {!list.isPending && items.length === 0 ? (
        <EmptyState icon={Bell} tint="indigo" text={t('notifications.empty')} />
      ) : null}
      {section(t('notifications.today'), today, 0)}
      {section(t('notifications.earlier'), earlier, today.length)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: tokens.space[2] },
  sectionTitle: { paddingHorizontal: tokens.space[4], letterSpacing: 0.6 },
  card: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space[3],
    paddingVertical: tokens.space[3],
    paddingHorizontal: tokens.space[4],
    minHeight: 64,
  },
  unreadRow: { backgroundColor: '#F2FAF8' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.color.border },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.space[2] },
  title: { flex: 1 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    backgroundColor: tokens.color.accent,
  },
});
