import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  Mail,
  MapPin,
  MessageSquarePlus,
  Pencil,
  Phone,
  StickyNote,
  Trash2,
} from 'lucide-react-native';
import { Linking, StyleSheet, View } from 'react-native';

import { Appear } from '@/components/ui/appear';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { GroupRow, ListGroup } from '@/components/ui/list-group';
import { Screen } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { confirm } from '@/lib/confirm';
import { formatDate } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { tints, tokens } from '@/theme/tokens';

import { useEvents } from '../../events/api';
import { StatusBadge } from '../../events/components/status-badge';
import { useCustomers, useDeleteCustomer } from '../api';

/** SC-36 Kundendetail: Kontakt, Rechnungsanschrift, Notiz und Aufträge. */
export function CustomerDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useCustomers().data?.find((c) => c.id === id);
  const events = (useEvents().data ?? [])
    .filter((e) => e.customer_id === id)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const del = useDeleteCustomer();

  if (!customer) {
    return (
      <Screen
        title={t('customers.detail.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      >
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  const remove = async () => {
    if (
      await confirm(
        t('customers.detail.deleteTitle', { name: customer.name }),
        t('customers.detail.deleteBody'),
        t('customers.detail.delete'),
        t('common.cancel'),
      )
    ) {
      del.mutate(id!, { onSuccess: () => router.back() });
    }
  };
  const billing = [
    customer.billing_street,
    [customer.billing_postal_code, customer.billing_city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');

  // Kontaktwege als zwei große Kacheln in Daumenhöhe; Bearbeiten oben, Löschen hinter „⋯“.
  const contact = [
    customer.phone
      ? {
          key: 'call',
          icon: Phone,
          tint: 'teal' as const,
          label: t('customers.detail.call'),
          value: customer.phone,
          url: `tel:${customer.phone}`,
        }
      : null,
    customer.email
      ? {
          key: 'mail',
          icon: Mail,
          tint: 'sky' as const,
          label: t('customers.detail.mail'),
          value: customer.email,
          url: `mailto:${customer.email}`,
        }
      : null,
  ].filter((c) => c !== null);

  return (
    <Screen
      title={customer.name}
      subtitle={[t(`customers.type.${customer.type}`), customer.contact_person]
        .filter(Boolean)
        .join(' · ')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
      actions={
        <IconButton
          icon={Pencil}
          label={t('customers.detail.edit')}
          onPress={() =>
            router.push({ pathname: '/customers/[id]/edit', params: { id: customer.id } })
          }
        />
      }
      menu={[
        {
          label: t('customers.detail.delete'),
          icon: Trash2,
          destructive: true,
          onPress: () => void remove(),
        },
      ]}
      footer={
        <Button
          label={t('customers.detail.newEvent')}
          icon={MessageSquarePlus}
          style={{ flex: 1 }}
          onPress={() =>
            router.push({ pathname: '/events/intake', params: { customerId: customer.id } })
          }
        />
      }
    >
      {del.error ? <Banner tone="danger">{toAppError(del.error).message}</Banner> : null}
      {contact.length > 0 ? (
        <Appear style={styles.contact}>
          {contact.map((c) => (
            <Surface
              key={c.key}
              accessibilityRole="link"
              accessibilityLabel={`${c.label}: ${c.value}`}
              onPress={() => void Linking.openURL(c.url)}
              style={styles.tile}
            >
              <View style={[styles.tileIcon, { backgroundColor: tints[c.tint].bg }]}>
                <c.icon color={tints[c.tint].fg} size={20} strokeWidth={2.2} />
              </View>
              <Text variant="bodyStrong">{c.label}</Text>
              <Text variant="small" color="textSecondary" numberOfLines={1}>
                {c.value}
              </Text>
            </Surface>
          ))}
        </Appear>
      ) : null}
      {billing || customer.notes ? (
        <Appear index={1}>
          <ListGroup>
            {billing ? (
              <GroupRow
                icon={MapPin}
                tint="slate"
                title={billing}
                subtitle={t('customers.detail.billing')}
              />
            ) : null}
            {customer.notes ? (
              <GroupRow
                icon={StickyNote}
                tint="amber"
                title={customer.notes}
                subtitle={t('customers.detail.notes')}
              />
            ) : null}
          </ListGroup>
        </Appear>
      ) : null}
      <Appear index={2}>
        <ListGroup title={t('customers.detail.events')}>
          {events.length === 0 ? (
            <GroupRow icon={CalendarDays} title={t('customers.detail.noEvents')} />
          ) : null}
          {events.map((e) => (
            <GroupRow
              key={e.id}
              title={e.title}
              subtitle={formatDate(e.starts_at)}
              right={<StatusBadge status={e.status} />}
              onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })}
            />
          ))}
        </ListGroup>
      </Appear>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contact: { flexDirection: 'row', gap: tokens.space[3] },
  tile: { flex: 1, gap: 2, padding: tokens.space[4] },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.space[2],
  },
});
