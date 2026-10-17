import { Tabs } from 'expo-router';
import { CalendarDays, ChefHat, ClipboardList, Ellipsis, Hand, House } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useMembership } from '@/features/company/api';
import { tokens } from '@/theme/tokens';

type Role = 'admin' | 'kitchen' | 'staff';

// Tabs je Rolle (docs/04 §1.2); die übrigen bleiben als Routen bestehen, aber ohne Tab.
const TABS: Record<Role, string[]> = {
  admin: ['start', 'calendar', 'more'],
  kitchen: ['today', 'calendar', 'more'],
  staff: ['my-shifts', 'shift-board', 'more'],
};

export default function TabsLayout() {
  const { t } = useTranslation();
  const role = useMembership().data?.role ?? 'staff';
  const visible = (name: string) => (TABS[role].includes(name) ? undefined : (null as null));
  const icon = (Icon: typeof House) =>
    function TabIcon({ focused, size }: { focused: boolean; size: number }) {
      return <Icon color={focused ? tokens.color.accent : tokens.color.textTertiary} size={size} />;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.color.accent,
        tabBarInactiveTintColor: tokens.color.textTertiary,
        tabBarLabelStyle: { fontFamily: tokens.font.semibold, fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="start"
        options={{ href: visible('start'), title: t('tabs.start'), tabBarIcon: icon(House) }}
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
