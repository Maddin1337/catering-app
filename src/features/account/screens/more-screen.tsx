import {
  BookOpen,
  ChefHat,
  ClipboardList,
  Hand,
  LogOut,
  Settings,
  UserRound,
  Users,
  UsersRound,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Appear } from '@/components/ui/appear';
import { Avatar } from '@/components/ui/avatar';
import { Banner } from '@/components/ui/banner';
import { GroupRow, ListGroup } from '@/components/ui/list-group';
import { Screen } from '@/components/ui/screen';
import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { formatDate } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { tokens } from '@/theme/tokens';

import { useSignOut } from '../../auth/api';
import { useSession } from '../../auth/session-provider';
import { useCompanyProfile, useMembership, useSubscription } from '../../company/api';

/** Tab „Mehr“: Profilkarte oben, darunter die Arbeitsbereiche als gruppierte Liste, unten Abmelden. */
export function MoreScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const membership = useMembership();
  const profile = useCompanyProfile();
  const subscription = useSubscription();
  const signOut = useSignOut();
  const router = useRouter();
  const role = membership.data?.role;
  const name = membership.data?.display_name ?? '';
  const trialEnd =
    subscription.data?.status === 'trialing' ? subscription.data.trial_ends_at : null;
  const office = role === 'admin' || role === 'kitchen';

  return (
    <Screen title={t('more.title')}>
      {trialEnd ? (
        <Banner tone="info">{t('more.trial', { date: formatDate(trialEnd) })}</Banner>
      ) : null}
      {signOut.error ? <Banner tone="danger">{toAppError(signOut.error).message}</Banner> : null}

      <Appear>
        <Surface
          elevation="raised"
          accessibilityLabel={`${t('more.profileLink')}: ${name}`}
          onPress={() => router.push('/profile')}
          style={styles.profile}
        >
          <Avatar name={name || '?'} size={56} />
          <View style={styles.profileText}>
            <Text variant="title2" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="small" color="textSecondary" numberOfLines={1}>
              {[membership.data ? t(`role.${membership.data.role}`) : null, profile.data?.name]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text variant="small" color="textTertiary" numberOfLines={1}>
              {session?.user.email ?? ''}
            </Text>
          </View>
        </Surface>
      </Appear>

      {office ? (
        <Appear index={1}>
          <ListGroup title={t('more.groupWork')}>
            <GroupRow
              icon={UsersRound}
              tint="indigo"
              title={t('more.team')}
              subtitle={t('more.teamBody')}
              onPress={() => router.push('/team')}
            />
            {role === 'admin' ? (
              <GroupRow
                icon={Users}
                tint="sky"
                title={t('more.customers')}
                subtitle={t('more.customersBody')}
                onPress={() => router.push('/customers')}
              />
            ) : null}
            {role === 'kitchen' ? (
              <GroupRow
                icon={Hand}
                tint="amber"
                title={t('shifts.board.title')}
                subtitle={t('shifts.board.moreBody')}
                onPress={() => router.push('/shifts/board')}
              />
            ) : null}
            {role === 'kitchen' ? (
              <GroupRow
                icon={ClipboardList}
                tint="teal"
                title={t('shifts.mine.title')}
                subtitle={t('shifts.mine.moreBody')}
                onPress={() => router.push('/shifts/mine')}
              />
            ) : null}
            <GroupRow
              icon={ChefHat}
              tint="rose"
              title={t('kitchenPlan.more')}
              subtitle={t('kitchenPlan.moreBody')}
              onPress={() => router.push('/kitchen')}
            />
            <GroupRow
              icon={BookOpen}
              tint="violet"
              title={t('more.catalog')}
              subtitle={t('more.catalogBody')}
              onPress={() => router.push('/dishes')}
            />
          </ListGroup>
        </Appear>
      ) : null}

      <Appear index={2}>
        <ListGroup title={t('more.groupAccount')}>
          {role === 'admin' ? (
            <GroupRow
              icon={Settings}
              tint="slate"
              title={t('more.settings')}
              subtitle={t('more.settingsBody')}
              onPress={() => router.push('/settings')}
            />
          ) : null}
          <GroupRow
            icon={UserRound}
            tint="teal"
            title={t('more.profileLink')}
            subtitle={t('more.profileBody')}
            onPress={() => router.push('/profile')}
          />
          <GroupRow
            icon={LogOut}
            title={t('more.signOut')}
            destructive
            onPress={() => signOut.mutate()}
          />
        </ListGroup>
      </Appear>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[4],
    padding: tokens.space[4],
  },
  profileText: { flex: 1, gap: 2 },
});
