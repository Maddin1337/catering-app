import { Tabs } from 'expo-router';
import {
  CalendarDays,
  ChefHat,
  ClipboardList,
  Ellipsis,
  Hand,
  House,
  PartyPopper,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

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
  const role = useMembership().data?.role ?? 'staff';
  const visible = (name: string) => (TABS[role].includes(name) ? undefined : (null as null));
  const icon = (Icon: typeof House) =>
    function TabIcon({ color, size }: { color: unknown; size: number }) {
      return <Icon color={String(color)} size={size} strokeWidth={2.1} />;
    };

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
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
  );
}
