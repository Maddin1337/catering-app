import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { RadioList } from '@/components/ui/radio-list';
import { FormSection } from '@/components/ui/form-section';
import { Screen } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { TimeField } from '@/components/ui/time-field';
import { SwitchRow } from '@/components/ui/switch';
import { berlinToIso, endIso, formatGermanDate, isoToBerlin, todayBerlin } from '@/lib/berlin';
import { toAppError } from '@/lib/errors';

import { useCompanySettings } from '../../settings/api';
import { useCreateEvent, useEvent, useEvents, useUpdateEvent, type EventInput } from '../api';
import { CustomerPicker } from '../components/customer-picker';
import type { EventKind, EventRow } from '../types';

const n = (s: string) => (s.trim() === '' ? null : s.trim());

/** SC-16 Schnellerfassung und SC-29 Bearbeiten: dasselbe Formular. */
export function EventFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, customerId } = useLocalSearchParams<{ id?: string; customerId?: string }>();
  const events = useEvents();
  const existing = useEvent(id).data;
  const settings = useCompanySettings();

  if ((id && !existing) || events.isPending) {
    return (
      <Screen
        title={t('events.form.edit')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      >
        {events.isPending ? (
          <SkeletonList rows={3} />
        ) : (
          <Banner tone="info">{t('events.detail.gone')}</Banner>
        )}
      </Screen>
    );
  }
  return (
    <EventForm
      key={id ?? 'new'}
      existing={existing}
      presetCustomerId={customerId}
      all={events.data ?? []}
      leadHours={{
        event_catering: settings.data?.portal_change_lead_hours ?? null,
        business_lunch: settings.data?.portal_change_lead_hours_business_lunch ?? null,
      }}
    />
  );
}

function EventForm({
  existing,
  presetCustomerId,
  all,
  leadHours,
}: {
  existing: EventRow | undefined;
  presetCustomerId: string | undefined;
  all: EventRow[];
  leadHours: Record<EventKind, number | null>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const start = existing ? isoToBerlin(existing.starts_at) : null;
  const end = existing?.ends_at ? isoToBerlin(existing.ends_at) : null;

  const [customerId, setCustomerId] = useState<string | null>(
    existing?.customer_id ?? presetCustomerId ?? null,
  );
  const [kind, setKind] = useState<EventKind>(existing?.kind ?? 'event_catering');
  const [date, setDate] = useState(start?.date ?? '');
  const [startTime, setStartTime] = useState(start?.time ?? '');
  const [endTime, setEndTime] = useState(end?.time ?? '');
  const [titleDraft, setTitleDraft] = useState<string | null>(existing?.title ?? null);
  const [occasion, setOccasion] = useState(existing?.occasion ?? '');
  const [guests, setGuests] = useState(existing?.guest_count ? String(existing.guest_count) : '');
  const [venue, setVenue] = useState(existing?.venue_name ?? '');
  const [street, setStreet] = useState(existing?.street ?? '');
  const [postal, setPostal] = useState(existing?.postal_code ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [pickup, setPickup] = useState(existing?.is_pickup ?? false);
  const [onsiteName, setOnsiteName] = useState(existing?.onsite_contact_name ?? '');
  const [onsitePhone, setOnsitePhone] = useState(existing?.onsite_contact_phone ?? '');
  const [kitchenNotes, setKitchenNotes] = useState(existing?.kitchen_notes ?? '');
  const [staffNotes, setStaffNotes] = useState(existing?.staff_notes ?? '');
  const [internalNotes, setInternalNotes] = useState(existing?.internal_notes ?? '');
  // Änderungsschluss: bis zur ersten Eingabe gilt die Vorbelegung bzw. der gespeicherte Wert
  const [changesDraft, setChangesDraft] = useState<{ date: string; time: string } | null>(
    existing
      ? existing.changes_until
        ? isoToBerlin(existing.changes_until)
        : { date: '', time: '' }
      : null,
  );
  const [tried, setTried] = useState(false);

  const isoDate = date || null;
  const startOk = startTime || null;
  const endOk = endTime || null;
  const guestNum =
    guests.trim() === ''
      ? null
      : /^\d+$/.test(guests.trim()) && Number(guests) >= 1
        ? Number(guests)
        : NaN;

  const suggestion = `${occasion.trim() || t(`events.kind.${kind}`)}${isoDate ? ` ${formatGermanDate(isoDate)}` : ''}`;
  const title = titleDraft ?? suggestion;

  const startsAt = isoDate && startOk ? berlinToIso(isoDate, startOk) : null;
  // Änderungsschluss: Vorbelegung aus der Firmeneinstellung der Auftragsart, wenn nichts eingetragen ist
  const lead = leadHours[kind];
  let defaultChanges = { date: '', time: '' };
  if (lead !== null && startsAt) {
    defaultChanges = isoToBerlin(new Date(Date.parse(startsAt) - lead * 3_600_000));
  }
  const changes = changesDraft ?? defaultChanges;
  const changesDate = changes.date || null;
  const changesTime = changes.time || null;
  const changesError =
    (changes.date === '') !== (changes.time === '')
      ? t('events.form.errors.changesUntil')
      : undefined;

  const errors = {
    customer: !customerId ? t('events.form.errors.customer') : undefined,
    date: !isoDate ? t('events.form.errors.date') : undefined,
    start: !startOk ? t('events.form.errors.start') : undefined,
    title: title.trim() === '' ? t('events.form.errors.title') : undefined,
    guests: Number.isNaN(guestNum) ? t('events.form.errors.guests') : undefined,
    changes: changesError,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const sameDay = isoDate
    ? all.filter(
        (e) =>
          e.event_date === isoDate &&
          e.id !== existing?.id &&
          !['declined', 'cancelled'].includes(e.status),
      ).length
    : 0;
  const inPast = !!isoDate && isoDate < todayBerlin();

  const submit = () => {
    setTried(true);
    if (hasErrors || !isoDate || !startOk || !customerId) return;
    const values: EventInput = {
      customer_id: customerId,
      kind,
      title: title.trim(),
      occasion: n(occasion),
      starts_at: berlinToIso(isoDate, startOk),
      ends_at: endOk ? endIso(isoDate, startOk, endOk) : null,
      guest_count: typeof guestNum === 'number' ? guestNum : null,
      venue_name: n(venue),
      street: n(street),
      postal_code: n(postal),
      city: n(city),
      is_pickup: pickup,
      onsite_contact_name: n(onsiteName),
      onsite_contact_phone: n(onsitePhone),
      meeting_point: existing?.meeting_point ?? null,
      dress_code: existing?.dress_code ?? null,
      staff_notes: n(staffNotes),
      kitchen_notes: n(kitchenNotes),
      internal_notes: n(internalNotes),
      changes_until: changesDate && changesTime ? berlinToIso(changesDate, changesTime) : null,
      cancellation_agreement: existing?.cancellation_agreement ?? null,
    };
    if (existing) {
      update.mutate(
        { id: existing.id, values },
        {
          onSuccess: () => {
            showToast(t('common.saved'));
            router.back();
          },
        },
      );
    } else {
      create.mutate(values, {
        onSuccess: (id) => router.replace({ pathname: '/events/[id]', params: { id } }),
      });
    }
  };

  const error = create.error ?? update.error;

  return (
    <Screen
      title={existing ? t('events.form.edit') : t('events.form.new')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
      footer={
        <Button
          style={{ flex: 1 }}
          label={t('events.form.save')}
          loading={create.isPending || update.isPending}
          onPress={submit}
        />
      }
      backIcon={existing ? 'back' : 'close'}
    >
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      <FormSection title={t('events.form.section.customer')}>
        <CustomerPicker
          value={customerId}
          onChange={setCustomerId}
          error={tried ? errors.customer : undefined}
        />
        <RadioList
          label={t('events.form.kind')}
          value={kind}
          onChange={setKind}
          options={(['event_catering', 'business_lunch'] as const).map((k) => ({
            value: k,
            label: t(`events.kind.${k}`),
          }))}
        />
      </FormSection>
      <FormSection title={t('events.form.section.when')}>
        <DateField
          label={t('events.form.date')}
          value={date}
          onChange={setDate}
          error={tried ? errors.date : undefined}
        />
        {inPast ? <Banner tone="warning">{t('events.form.warnPast')}</Banner> : null}
        {sameDay > 0 && isoDate ? (
          <Banner tone="info">
            {t('events.form.warnSameDay', { date: formatGermanDate(isoDate), count: sameDay })}
          </Banner>
        ) : null}
        <TimeField
          label={t('events.form.start')}
          value={startTime}
          onChange={setStartTime}
          error={tried ? errors.start : undefined}
        />
        <TimeField
          label={t('events.form.end')}
          value={endTime}
          onChange={setEndTime}
          optional
          defaultHour={14}
        />
        <Text variant="small" color="textTertiary">
          {t('events.form.endHint')}
        </Text>
      </FormSection>
      <FormSection title={t('events.form.section.what')}>
        <TextField label={t('events.form.occasion')} value={occasion} onChangeText={setOccasion} />
        <TextField
          label={t('events.form.title')}
          helper={t('events.form.titleHint')}
          value={title}
          onChangeText={setTitleDraft}
          error={tried ? errors.title : undefined}
          maxLength={120}
        />
        <TextField
          label={t('events.form.guests')}
          value={guests}
          onChangeText={setGuests}
          error={tried ? errors.guests : undefined}
          inputMode="numeric"
          keyboardType="number-pad"
        />
      </FormSection>
      <FormSection title={t('events.form.section.where')}>
        <TextField label={t('events.form.venue')} value={venue} onChangeText={setVenue} />
        <TextField label={t('events.form.street')} value={street} onChangeText={setStreet} />
        <TextField
          label={t('events.form.postal_code')}
          value={postal}
          onChangeText={setPostal}
          inputMode="numeric"
        />
        <TextField label={t('events.form.city')} value={city} onChangeText={setCity} />
        <SwitchRow label={t('events.form.pickup')} value={pickup} onChange={setPickup} />
      </FormSection>
      <FormSection title={t('events.form.section.contact')}>
        <TextField
          label={t('events.form.onsiteName')}
          value={onsiteName}
          onChangeText={setOnsiteName}
        />
        <TextField
          label={t('events.form.onsitePhone')}
          value={onsitePhone}
          onChangeText={setOnsitePhone}
          inputMode="tel"
        />
      </FormSection>
      <FormSection title={t('events.form.section.notes')}>
        <TextField
          label={t('events.form.kitchenNotes')}
          value={kitchenNotes}
          onChangeText={setKitchenNotes}
          multiline
        />
        <TextField
          label={t('events.form.staffNotes')}
          value={staffNotes}
          onChangeText={setStaffNotes}
          multiline
        />
        <TextField
          label={t('events.form.internalNotes')}
          value={internalNotes}
          onChangeText={setInternalNotes}
          multiline
        />
      </FormSection>
      <FormSection title={t('events.form.section.portal')}>
        <DateField
          label={t('events.form.changesUntilDate')}
          value={changes.date}
          onChange={(d) => setChangesDraft({ ...changes, date: d })}
          optional
          startMonthFrom={date || undefined}
        />
        <TimeField
          label={t('events.form.changesUntilTime')}
          value={changes.time}
          onChange={(v) => setChangesDraft({ ...changes, time: v })}
          optional
          error={tried ? errors.changes : undefined}
        />
        <Text variant="small" color="textTertiary">
          {t('events.form.changesUntilHint')}
        </Text>
      </FormSection>
    </Screen>
  );
}
