import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { tokens } from '@/theme/tokens';

import { useUnreadCount } from '../api';

/** Glocke für die Kopfleiste: Zahl der ungelesenen Mitteilungen springt mit einer Feder herein. */
export function NotificationBell() {
  const { t } = useTranslation();
  const router = useRouter();
  const count = useUnreadCount();
  return (
    <View>
      <IconButton
        icon={Bell}
        label={count > 0 ? t('notifications.bellUnread', { count }) : t('notifications.bell')}
        onPress={() => router.push('/notifications')}
      />
      {count > 0 ? (
        // Neuer Schlüssel bei jeder Änderung: Das Abzeichen „hüpft“, wenn etwas dazukommt.
        <Animated.View
          key={count}
          entering={ZoomIn.springify().damping(10)}
          style={styles.badge}
          pointerEvents="none"
        >
          <Text variant="caption" color="onAccent" style={styles.text}>
            {count > 9 ? '9+' : count}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.danger,
    borderWidth: 2,
    borderColor: tokens.color.canvas,
  },
  text: { fontSize: 11, lineHeight: 13 },
});
