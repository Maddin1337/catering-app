import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { RadioList } from '@/components/ui/radio-list';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { confirm } from '@/lib/confirm';
import { formatDate } from '@/lib/dates';
import { webUrl } from '@/lib/env';
import { messages, toAppError } from '@/lib/errors';
import { sharePdf } from '@/lib/pdf';
import { shareText } from '@/lib/share';
import { tokens } from '@/theme/tokens';

import { useDishes, usePackageDishLines, usePackages } from '../../catalog/api';
import { useTaxRates } from '../../company/api';
import { useCustomers } from '../../customers/api';
import { useEvent } from '../../events/api';
import { useCompanySettings } from '../../settings/api';
import {
  useDiscardChanges,
  useIssueToken,
  useQuoteForSend,
  useRevisions,
  useSendQuote,
} from '../api';
import { TotalsBlock } from '../components/totals-block';
import { renderQuoteHtml } from '../document';
import { buildSavePayload, costTotal, itemFromStored, runCalc } from '../model';
import { sendChecklist } from '../send-check';
import { buildSnapshot, snapshotCustomer, type QuoteSnapshot } from '../snapshot';

type Result = { revision: number; token: string; via: 'email' | 'link'; snapshot: QuoteSnapshot };

export function portalLink(token: string): string {
  const base = webUrl || (Platform.OS === 'web' ? window.location.origin : '');
  return `${base}/portal/${token}`;
}

/** SC-34 Vorschau und Versand: Prüfliste, Vorschau, Versandart; danach Link, E-Mail und PDF. */
export function QuoteSendScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id).data;
  const quote = useQuoteForSend(id);
  const rates = useTaxRates().data;
  const settings = useCompanySettings().data;
  const dishes = useDishes().data;
  const packages = usePackages().data;
  const packageLines = usePackageDishLines().data;
  const customersQuery = useCustomers();
  const customers = customersQuery.data;
  const revisions = useRevisions(quote.data?.header.id);
  const send = useSendQuote();
  const issue = useIssueToken();
  const discard = useDiscardChanges();

  const [mode, setMode] = useState<'confirm_required' | 'info_only'>('confirm_required');
  const [result, setResult] = useState<Result | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const back = () => router.replace({ pathname: '/events/[id]', params: { id } });
  const title = t('quoteSend.title');

  if (quote.error || customersQuery.error) {
    return (
      <Screen title={title} onBack={back} backLabel={t('quoteSend.back')}>
        <Banner tone="danger">{toAppError(quote.error ?? customersQuery.error).message}</Banner>
      </Screen>
    );
  }
  if (
    !event ||
    !quote.data ||
    !rates ||
    !settings ||
    !dishes ||
    !packages ||
    !packageLines ||
    !customers
  ) {
    return (
      <Screen title={title} onBack={back} backLabel={t('quoteSend.back')}>
        <Text>
          {quote.isSuccess && !quote.data ? t('quoteSend.block.no_items') : t('common.loading')}
        </Text>
      </Screen>
    );
  }

  const { header, items: stored } = quote.data;
  const customer = customers?.find((c) => c.id === event.customer_id);
  const items = stored.map(itemFromStored);
  const guests = event.guest_count;
  const display = header.price_display;
  const calcSettings = {
    entryMode: settings.price_entry_mode,
    display,
    discountBp: header.discount_bp,
    discountCents: header.discount_cents,
    depositBp: header.deposit_bp,
    depositCents: header.deposit_cents,
  };
  const calc = runCalc(items, rates, guests, calcSettings);
  const confirmedEvent = event.status === 'confirmed';

  const check = (via: 'email' | 'link') =>
    sendChecklist({
      eventStatus: event.status,
      items,
      guests,
      calc,
      customerEmail: customer?.email ?? null,
      validUntil: header.valid_until,
      dishes,
      rates,
      via,
    });
  const common = check('link');
  const emailBlocked = check('email').blockers.includes('no_email');

  const snapshotFor = (revision: number): QuoteSnapshot => {
    return buildSnapshot({
      revision,
      frozenAt: new Date().toISOString(),
      company: {
        name: settings.name,
        logo_path: settings.logo_path,
        accent_color: settings.accent_color,
        street: settings.street,
        postal_code: settings.postal_code,
        city: settings.city,
        phone: settings.phone,
        contact_email: settings.contact_email,
        vat_id: settings.vat_id,
        footer_text: settings.footer_text,
      },
      customer: customer
        ? snapshotCustomer(customer)
        : {
            type: 'private',
            name: event.customer_name ?? '',
            contact_person: null,
            email: null,
            billing_address: null,
          },
      event: {
        title: event.title,
        kind: event.kind,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        guest_count: guests,
        venue: [event.venue_name, event.city].filter(Boolean).join(', ') || null,
        option_expires_at: event.option_expires_at ?? null,
      },
      header,
      items,
      calc,
      rates,
      catalog: { dishes, packages, packageLines },
      guests,
      entryMode: settings.price_entry_mode,
      display,
    });
  };

  const html = (snap: QuoteSnapshot) => renderQuoteHtml(snap, (k, o) => t(k, o) as string);

  const doPdf = async (snap: QuoteSnapshot) => {
    setNotice(null);
    const r = await sharePdf(html(snap), `${snap.quote.number}-F${snap.revision}`);
    if (r === 'failed') setNotice(t('quoteSend.pdfFailed'));
  };

  const doSend = async (via: 'email' | 'link') => {
    const next = header.revision + 1;
    const ok = await confirm(
      t('quoteSend.confirmTitle'),
      t('quoteSend.confirmBody', { n: next }),
      t('quoteSend.confirmAction'),
      t('common.cancel'),
    );
    if (!ok) return;
    const snap = snapshotFor(next);
    const guestsNow = guests;
    send.mutate(
      {
        quoteId: header.id,
        expectedRevision: header.revision,
        savePayload: buildSavePayload({
          quoteId: header.id,
          header: {
            pricing_mode: header.pricing_mode,
            markup_bp: header.markup_bp,
            price_display: header.price_display,
            deposit_due_on: header.deposit_due_on,
            customer_reference: header.customer_reference,
            intro_text: header.intro_text,
            terms_text: header.terms_text,
            closing_text: header.closing_text,
            valid_until: header.valid_until,
          },
          settings: calcSettings,
          items,
          guests: guestsNow,
          calc,
          cost: costTotal(items, guestsNow),
          editorSeconds: 0,
        }),
        snapshot: snap,
        via,
        sendMode: confirmedEvent ? mode : null,
      },
      {
        onSuccess: (r) => {
          setResult({ revision: r.revision, token: r.token, via, snapshot: snap });
          if (via === 'email') void openMail(r.token, snap);
        },
      },
    );
  };

  const mailUrl = (token: string, snap: QuoteSnapshot) => {
    const name = customer?.contact_person || customer?.name;
    const subject = t('quoteSend.mailSubject', {
      number: snap.quote.number,
      company: settings.name,
    });
    const body = t('quoteSend.mailBody', {
      name: name ? ` ${name}` : '',
      link: portalLink(token),
      company: settings.name,
    });
    return `mailto:${encodeURIComponent(customer?.email ?? '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  const openMail = async (token: string, snap: QuoteSnapshot) => {
    try {
      await Linking.openURL(mailUrl(token, snap));
    } catch {
      setNotice(t('quoteSend.mailFailed'));
    }
  };
  const copyLink = async (token: string) => {
    const r = await shareText(portalLink(token));
    setNotice(r === 'failed' ? messages.unknown : r === 'copied' ? t('quoteSend.copied') : null);
  };

  if (result) {
    return (
      <Screen
        title={t('quoteSend.done', { n: result.revision })}
        subtitle={t('quoteSend.doneBody')}
      >
        {notice ? <Banner tone="info">{notice}</Banner> : null}
        <View
          style={{
            gap: 4,
            padding: tokens.space[3],
            borderWidth: 1,
            borderColor: tokens.color.border,
            borderRadius: tokens.radius.md,
          }}
        >
          <Text variant="small" color="textSecondary">
            {t('quoteSend.link')}
          </Text>
          <Text variant="body" selectable>
            {portalLink(result.token)}
          </Text>
        </View>
        <Button label={t('quoteSend.copyLink')} onPress={() => void copyLink(result.token)} />
        <Button
          label={t('quoteSend.openMail')}
          variant="secondary"
          disabled={!customer?.email}
          onPress={() => void openMail(result.token, result.snapshot)}
        />
        <Button
          label={t('quoteSend.pdf')}
          variant="secondary"
          onPress={() => void doPdf(result.snapshot)}
        />
        <Button label={t('quoteSend.back')} variant="ghost" onPress={back} />
      </Screen>
    );
  }

  const revs = revisions.data ?? [];
  return (
    <Screen
      title={title}
      subtitle={`${header.number} · ${event.title}`}
      onBack={back}
      backLabel={t('quoteSend.back')}
    >
      {send.error ? <Banner tone="danger">{toAppError(send.error).message}</Banner> : null}
      {discard.error ? <Banner tone="danger">{toAppError(discard.error).message}</Banner> : null}
      {notice ? <Banner tone="info">{notice}</Banner> : null}

      {header.revision > 0 ? (
        <Banner tone={header.has_unsent_changes ? 'warning' : 'info'}>
          {header.has_unsent_changes
            ? t('quoteSend.unsent')
            : t('quoteSend.sentBadge', { n: header.revision })}
        </Banner>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text variant="title2">{t('quoteSend.checks')}</Text>
        {common.blockers
          .filter((b) => b !== 'no_email')
          .map((b) => (
            <Banner key={b} tone="danger">
              {t(`quoteSend.block.${b}`)}
            </Banner>
          ))}
        {common.warnings.map((w) => (
          <Banner key={w} tone="warning">
            {t(`quoteSend.warn.${w}`)}
          </Banner>
        ))}
        {emailBlocked ? <Banner tone="warning">{t('quoteSend.block.no_email')}</Banner> : null}
        {common.blockers.length === 0 && common.warnings.length === 0 && !emailBlocked ? (
          <Text variant="body" color="textSecondary">
            {t('quoteSend.allOk')}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="title2">{t('quoteSend.preview')}</Text>
        <TotalsBlock calc={calc} display={display} guests={guests} />
        <Button
          label={t('quoteSend.pdf')}
          variant="secondary"
          onPress={() => void doPdf(snapshotFor(header.revision + 1))}
        />
      </View>

      {confirmedEvent ? (
        <RadioList
          label={t('quoteSend.mode')}
          value={mode}
          onChange={setMode}
          options={[
            {
              value: 'confirm_required',
              label: t('quoteSend.modeConfirm'),
              hint: t('quoteSend.modeConfirmHint'),
            },
            {
              value: 'info_only',
              label: t('quoteSend.modeInfo'),
              hint: t('quoteSend.modeInfoHint'),
            },
          ]}
        />
      ) : null}

      <View style={{ gap: 8 }}>
        <Button
          label={t('quoteSend.sendEmail')}
          loading={send.isPending}
          disabled={common.blockers.length > 0 || emailBlocked || send.isPending}
          onPress={() => void doSend('email')}
        />
        <Text variant="small" color="textSecondary">
          {t('quoteSend.emailHint')}
        </Text>
        <Button
          label={t('quoteSend.sendLink')}
          variant="secondary"
          disabled={common.blockers.length > 0 || send.isPending}
          onPress={() => void doSend('link')}
        />
      </View>

      {revs.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text variant="title2">{t('quoteSend.versions')}</Text>
          {revs.map((r) => (
            <View
              key={r.revision}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="body">
                  {t('quoteSend.versionRow', { n: r.revision, date: formatDate(r.sent_at) })}
                </Text>
                <Text variant="small" color="textSecondary">
                  {t(`quoteSend.via_${r.sent_via}`)}
                </Text>
              </View>
              <Button
                label={t('quoteSend.pdf')}
                variant="secondary"
                onPress={() => void doPdf(r.snapshot)}
              />
            </View>
          ))}
          <Button
            label={t('quoteSend.newLink')}
            variant="secondary"
            loading={issue.isPending}
            onPress={() =>
              issue.mutate(header.id, {
                onSuccess: (token) => void copyLink(token),
              })
            }
          />
          {issue.error ? <Banner tone="danger">{toAppError(issue.error).message}</Banner> : null}
          {header.has_unsent_changes ? (
            <Button
              label={t('quoteSend.discard')}
              variant="ghost"
              loading={discard.isPending}
              onPress={async () => {
                const ok = await confirm(
                  t('quoteSend.discardTitle'),
                  t('quoteSend.discardBody'),
                  t('quoteSend.discardAction'),
                  t('common.cancel'),
                );
                if (ok) discard.mutate(header.id);
              }}
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
