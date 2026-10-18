import { Tabs, useRouter } from 'expo-router';
import {
  CalendarDays,
  ChefHat,
  ClipboardList,
  CookingPot,
  Ellipsis,
  Hand,
  House,
  MessageSquarePlus,
  Package,
  PartyPopper,
  UserPlus,
  UserRound,
  FilePlus,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ActionSheet } from '@/components/ui/action-sheet';
import { FloatingTabBar } from '@/components/ui/tab-bar';

import { useMembership } from '@/features/company/api';
import { tokens } from '@/theme/tokens';

type Role = 'admin' | 'kitchen' | 'staff';

// Tabs je Rolle (docs/04 §1.2); die übrigen bleiben als Routen bestehen, aber ohne Tab.
const TABS: Record<Role, string[]> = {
  admin: ['start', 'events', 'calendar', 'more'],
  kitchen: ['today', 'events', 'calendar', 'more'],
  staff: ['my-shifts', 'shift-board', 'more'],
};

export default function TabsLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const role = useMembership().data?.role ?? 'staff';
  const [creating, setCreating] = useState(false);
  const visible = (name: string) => (TABS[role].includes(name) ? undefined : (null as null));
  const icon = (Icon: typeof House) =>
    function TabIcon({ color, size }: { color: unknown; size: number }) {
      return <Icon color={String(color)} size={size} strokeWidth={2.1} />;
    };

  // Schnellanlage hinter dem „+“ in der Tab-Leiste (nur Admin): alles Neue mit einem Daumentipp.
  const create = [
    { key: 'intake', icon: MessageSquarePlus, href: '/events/intake' },
    { key: 'event', icon: FilePlus, href: '/events/new' },
    { key: 'customer', icon: UserRound, href: '/customers/new' },
    { key: 'dish', icon: CookingPot, href: '/dishes/new' },
    { key: 'package', icon: Package, href: '/packages/new' },
    { key: 'invite', icon: UserPlus, href: '/team/invite' },
  ] as const;

  return (
    <>
      <Tabs
        tabBar={(props) => (
          <FloatingTabBar
            {...props}
            onCreate={role === 'admin' ? () => setCreating(true) : undefined}
            createLabel={t('tabs.create')}
          />
        )}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: tokens.color.canvas } }}
      >
        <Tabs.Screen
          name="start"
          options={{ href: visible('start'), title: t('tabs.start'), tabBarIcon: icon(House) }}
        />
        <Tabs.Screen
          name="events"
          options={{
            href: visible('events'),
            title: t('tabs.events'),
            tabBarIcon: icon(PartyPopper),
          }}
        />
        <Tabs.Screen
          name="today"
          options={{ href: visible('today'), title: t('tabs.today'), tabBarIcon: icon(ChefHat) }}
        />
        <Tabs.Screen
          name="my-shifts"
          options={{
            href: visible('my-shifts'),
            title: t('tabs.myShifts'),
            tabBarIcon: icon(ClipboardList),
          }}
        />
        <Tabs.Screen
          name="shift-board"
          options={{
            href: visible('shift-board'),
            title: t('tabs.shiftBoard'),
            tabBarIcon: icon(Hand),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            href: visible('calendar'),
            title: t('tabs.calendar'),
            tabBarIcon: icon(CalendarDays),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{ href: visible('more'), title: t('tabs.more'), tabBarIcon: icon(Ellipsis) }}
        />
      </Tabs>
      {creating ? (
        <ActionSheet
          title={t('create.title')}
          onClose={() => setCreating(false)}
          actions={create.map((c) => ({
            label: t(`create.${c.key}`),
            hint: t(`create.${c.key}Hint`),
            icon: c.icon,
            onPress: () => router.push(c.href),
          }))}
        />
      ) : null}
    </>
  );
}
