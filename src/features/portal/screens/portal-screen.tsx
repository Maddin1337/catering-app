import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioList } from '@/components/ui/radio-list';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { formatGermanDate } from '@/lib/berlin';
import { formatDate, formatDateTime } from '@/lib/dates';
import { logoUrl } from '@/lib/logo';
import { formatCents } from '@/lib/money';
import { sharePdf } from '@/lib/pdf';
import { tokens } from '@/theme/tokens';

import { DietaryCard } from '../components/dietary-card';
import { renderQuoteHtml } from '../../quotes/document';
import { applySelection } from '../../quotes/selection';
import { SnapshotView } from '../../quotes/components/snapshot-view';
import {
  portalErrorKey,
  usePortal,
  usePortalAccept,
  usePortalChange,
  usePortalDecline,
  usePortalSelect,
  type PortalCompany,
} from '../api';

type Panel = 'accept' | 'decline' | 'change' | null;

const REASONS = ['price', 'other_provider', 'cancelled', 'other'] as const;

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        gap: 12,
        padding: tokens.space[4],
        borderWidth: 1,
        borderColor: tokens.color.border,
        borderRadius: tokens.radius.lg,
      }}
    >
      {children}
    </View>
  );
}

/** SC-71 – SC-76 Kundenportal: Angebot ansehen, verbindlich annehmen, ablehnen, Änderung wünschen. Siezen. */
export function PortalScreen() {
  const { t } = useTranslation('portal');
  const { t: tTeam } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const portal = usePortal(token);
  const accept = usePortalAccept(token ?? '');
  const decline = usePortalDecline(token ?? '');
  const change = usePortalChange(token ?? '');
  const select = usePortalSelect(token ?? '');

  const [panel, setPanel] = useState<Panel>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [guests, setGuests] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const data = portal.data;
  if (portal.isLoading || (!data && !portal.error)) {
    return (
      <Screen title={t('loading')}>
        <View />
      </Screen>
    );
  }
  if (portal.error || !data || data.state === 'invalid') {
    return (
      <Screen title={t('invalid.title')} subtitle={t('invalid.body')}>
        <View />
      </Screen>
    );
  }
  if (data.state === 'revoked') {
    return (
      <Screen
        title={t('revoked.title')}
        subtitle={t('revoked.body', { company: data.company.name })}
      >
        <ContactButtons company={data.company} />
      </Screen>
    );
  }

  const { company, quote, event } = data;
  const snapshot = applySelection(data.snapshot, data.selection ?? {});
  const status = event.status;
  const accepted = quote.acceptance_revision === quote.revision && !!quote.accepted_at;
  const needsConfirm =
    status === 'confirmed' &&
    quote.send_mode === 'confirm_required' &&
    (quote.acceptance_revision ?? 0) < quote.revision;
  const open = (status === 'quoted' || status === 'optioned') && quote.status === 'sent';
  const canAccept = (open && !quote.expired) || needsConfirm;
  const canDecline = open;
  const canChange = ['quoted', 'optioned', 'confirmed'].includes(status) && !event.changes_locked;
  const closed = ['declined', 'cancelled', 'completed', 'invoiced'].includes(status);

  const firstError = accept.error ?? decline.error ?? change.error ?? select.error;
  const errorKey = firstError ? portalErrorKey(firstError) : null;
  const reset = () => {
    accept.reset();
    decline.reset();
    change.reset();
    select.reset();
  };
  const toggle = (p: Panel) => {
    reset();
    setNotice(null);
    setPanel((cur) => (cur === p ? null : p));
  };

  const pdf = async () => {
    const r = await sharePdf(
      renderQuoteHtml(snapshot, (k, o) => tTeam(k, o) as string),
      `${snapshot.quote.number}-F${snapshot.revision}`,
    );
    setNotice(r === 'failed' ? t('pdfFailed') : null);
  };

  const statusLine = () => {
    if (accepted)
      return t('status.accepted', {
        date: formatDateTime(quote.accepted_at!),
        name: quote.acceptance_name ?? '',
      });
    if (quote.declined_at) return t('status.declined', { date: formatDate(quote.declined_at) });
    if (needsConfirm) return t('status.newVersion');
    if (closed) return t('status.closed');
    if (quote.expired) return t('status.expired', { company: company.name });
    return [
      t('status.open', { date: formatDate(quote.sent_at) }),
      quote.valid_until
        ? t('status.validUntil', { date: formatGermanDate(quote.valid_until) })
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
  };

  const total = formatCents(snapshot.totals.gross_cents);

  return (
    <Screen title={t('title', { number: quote.number })} subtitle={company.name}>
      {logoUrl(snapshot.company.logo_path) ? (
        <Image
          source={{ uri: logoUrl(snapshot.company.logo_path)! }}
          style={{ width: 220, height: 64 }}
          contentFit="contain"
          accessibilityLabel={company.name}
        />
      ) : null}
      <View
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: /^#[0-9a-fA-F]{6}$/.test(company.accent_color ?? '')
            ? company.accent_color!
            : tokens.color.accent,
        }}
      />
      <Banner tone={accepted ? 'success' : quote.expired || closed ? 'warning' : 'info'}>
        {statusLine()}
      </Banner>
      {data.has_pending_change ? (
        <Banner tone="info">{t('status.pendingChange', { company: company.name })}</Banner>
      ) : null}
      {notice ? <Banner tone="info">{notice}</Banner> : null}
      {errorKey ? <Banner tone="danger">{t(errorKey)}</Banner> : null}

      <Card>
        <Text variant="title2">{t('event')}</Text>
        <Text variant="bodyStrong">{snapshot.event.title}</Text>
        <Text variant="body">{formatDateTime(snapshot.event.starts_at)}</Text>
        {snapshot.event.venue ? <Text variant="body">{snapshot.event.venue}</Text> : null}
        {snapshot.event.guest_count ? (
          <Text variant="body">{t('guests', { count: snapshot.event.guest_count })}</Text>
        ) : null}
      </Card>

      {snapshot.quote.intro_text ? <Text variant="body">{snapshot.quote.intro_text}</Text> : null}

      <Card>
        <Text variant="title2">{t('items')}</Text>
        <SnapshotView
          snapshot={snapshot}
          onChoose={
            open && !quote.expired
              ? (group, itemId) => {
                  reset();
                  select.mutate({ revision: quote.revision, group, itemId });
                }
              : undefined
          }
        />
      </Card>

      {snapshot.quote.terms_text ? (
        <Card>
          <Text variant="title2">{t('terms')}</Text>
          <Text variant="body">{snapshot.quote.terms_text}</Text>
        </Card>
      ) : null}
      {snapshot.quote.closing_text ? (
        <Text variant="body">{snapshot.quote.closing_text}</Text>
      ) : null}

      {['quoted', 'optioned', 'confirmed'].includes(status) ? (
        <DietaryCard
          token={token ?? ''}
          rows={data.dietary ?? []}
          guests={snapshot.event.guest_count}
          canEdit={canChange}
        />
      ) : null}

      <Button label={t('pdf')} variant="secondary" onPress={() => void pdf()} />

      {panel === 'accept' ? (
        <Card>
          <Text variant="title2">{t('accept.title')}</Text>
          <Text variant="body">{t('accept.body', { company: company.name })}</Text>
          <Text variant="small" color="textSecondary">
            {t('accept.summary', {
              date: formatDate(snapshot.event.starts_at),
              guests: snapshot.event.guest_count ?? '–',
              total,
            })}
          </Text>
          <TextField
            label={t('accept.name')}
            value={name}
            onChangeText={setName}
            autoComplete="name"
          />
          <TextField
            label={t('accept.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextField
            label={t('accept.comment')}
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <Checkbox
            label={t('accept.check', { number: quote.number, revision: quote.revision })}
            checked={agreed}
            onChange={setAgreed}
          />
          <Button
            label={t('accept.submit')}
            loading={accept.isPending}
            disabled={!agreed || name.trim().length < 2 || accept.isPending}
            onPress={() =>
              accept.mutate(
                { revision: quote.revision, name, email, comment },
                { onSuccess: () => setPanel(null) },
              )
            }
          />
          <Button label={t('cancel')} variant="ghost" onPress={() => toggle(null)} />
        </Card>
      ) : null}

      {panel === 'decline' ? (
        <Card>
          <Text variant="title2">{t('decline.title')}</Text>
          <Text variant="body">{t('decline.body', { company: company.name })}</Text>
          <RadioList
            label={t('decline.reason')}
            value={reason}
            onChange={setReason}
            options={REASONS.map((r) => ({ value: r, label: t(`decline.reasons.${r}`) }))}
          />
          <TextField
            label={t('decline.comment')}
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <Button
            label={t('decline.submit')}
            variant="secondary"
            loading={decline.isPending}
            onPress={() =>
              decline.mutate(
                {
                  revision: quote.revision,
                  reason: reason ? t(`decline.reasons.${reason}`) : '',
                  comment,
                },
                { onSuccess: () => setPanel(null) },
              )
            }
          />
          <Button label={t('cancel')} variant="ghost" onPress={() => toggle(null)} />
        </Card>
      ) : null}

      {panel === 'change' ? (
        <Card>
          <Text variant="title2">{t('change.title')}</Text>
          <Text variant="body">{t('change.body', { company: company.name })}</Text>
          {company.phone ? (
            <Text variant="small" color="textSecondary">
              {t('change.big', { phone: company.phone })}
            </Text>
          ) : null}
          <TextField
            label={t('change.name')}
            value={name}
            onChangeText={setName}
            autoComplete="name"
          />
          <TextField
            label={t('change.guests')}
            value={guests}
            onChangeText={setGuests}
            keyboardType="number-pad"
          />
          <TextField
            label={t('change.comment')}
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <Button
            label={t('change.submit')}
            loading={change.isPending}
            disabled={change.isPending || name.trim().length < 2}
            onPress={() =>
              change.mutate(
                {
                  revision: quote.revision,
                  name,
                  comment,
                  guests: /^\d{1,5}$/.test(guests.trim()) ? Number(guests.trim()) : null,
                },
                {
                  onSuccess: () => {
                    setPanel(null);
                    setNotice(t('change.sent'));
                  },
                },
              )
            }
          />
          <Button label={t('cancel')} variant="ghost" onPress={() => toggle(null)} />
        </Card>
      ) : null}

      {panel === null ? (
        <View style={{ gap: 8 }}>
          {canAccept ? (
            <Button label={t('accept.button')} onPress={() => toggle('accept')} />
          ) : null}
          {canChange ? (
            <Button
              label={t('change.button')}
              variant="secondary"
              onPress={() => toggle('change')}
            />
          ) : company.phone && !closed ? (
            <Text variant="small" color="textSecondary">
              {t('change.locked', { phone: company.phone })}
            </Text>
          ) : null}
          {canDecline ? (
            <Button label={t('decline.button')} variant="ghost" onPress={() => toggle('decline')} />
          ) : null}
          {canChange && event.changes_until ? (
            <Text variant="small" color="textSecondary">
              {t('change.until', { date: formatDateTime(event.changes_until) })}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Card>
        <Text variant="title2">{t('contact')}</Text>
        <ContactButtons company={company} />
      </Card>

      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
        {company.imprint_url ? (
          <Text
            variant="small"
            color="accent"
            onPress={() => void Linking.openURL(company.imprint_url!)}
          >
            {t('legal.imprint')}
          </Text>
        ) : null}
        {company.privacy_policy_url ? (
          <Text
            variant="small"
            color="accent"
            onPress={() => void Linking.openURL(company.privacy_policy_url!)}
          >
            {t('legal.privacy')}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

function ContactButtons({ company }: { company: PortalCompany }) {
  const { t } = useTranslation('portal');
  return (
    <View style={{ gap: 8 }}>
      {company.phone ? (
        <Button
          label={`${t('call')}: ${company.phone}`}
          variant="secondary"
          onPress={() => void Linking.openURL(`tel:${company.phone!.replace(/\s+/g, '')}`)}
        />
      ) : null}
      <Button
        label={t('mail')}
        variant="secondary"
        onPress={() => void Linking.openURL(`mailto:${company.contact_email}`)}
      />
    </View>
  );
}
