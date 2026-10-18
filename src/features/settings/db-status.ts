/** SQL-Updates der Datenbank und wie sich prüfen lässt, ob sie eingespielt sind (Einstellungen → Datenbank-Stand). */
export type Probe =
  | { kind: 'table'; table: string; column?: string }
  | { kind: 'rpc'; name: string; args: Record<string, unknown> };

export type Update = { file: string; title: string; probe: Probe | null };

export const UPDATES: Update[] = [
  {
    file: '20261021090000',
    title: 'Team und Einladungen',
    probe: { kind: 'table', table: 'invitations' },
  },
  {
    file: '20261022090000',
    title: 'Gerichte, Zutaten, Pakete',
    probe: { kind: 'table', table: 'dish_ingredients' },
  },
  {
    file: '20261023090000',
    title: 'Kunden und Aufträge',
    probe: { kind: 'table', table: 'event_dietary_requirements' },
  },
  {
    file: '20261024090000',
    title: 'Angebots-Chat',
    probe: { kind: 'table', table: 'intake_questions' },
  },
  {
    file: '20261025090000',
    title: 'Angebote (Entwurf)',
    probe: { kind: 'table', table: 'quote_items' },
  },
  { file: '20261026090000', title: 'Angebot beim Kopieren mitnehmen', probe: null },
  {
    file: '20261027090000',
    title: 'Angebot versenden',
    probe: { kind: 'table', table: 'quote_revisions' },
  },
  {
    file: '20261028090000',
    title: 'Kundenportal',
    probe: { kind: 'table', table: 'quotes', column: 'accepted_at' },
  },
  {
    file: '20261029090000',
    title: 'Küche: verbindlicher Stand',
    probe: { kind: 'table', table: 'kitchen_event_lines' },
  },
  { file: '20261030090000', title: 'Schichtbörse', probe: { kind: 'table', table: 'shift_slots' } },
  {
    file: '20261031090000',
    title: 'Menüwahl im Portal',
    probe: { kind: 'table', table: 'quotes', column: 'portal_selection' },
  },
  { file: '20261101090000', title: 'Firmenlogo', probe: null },
  {
    file: '20261102090000',
    title: 'Sonderessen im Portal',
    probe: {
      kind: 'rpc',
      name: 'portal_save_dietary',
      args: {
        p_token: 'probe',
        p_id: null,
        p_person_count: 1,
        p_diet: null,
        p_avoid: [],
        p_note: null,
        p_guest_name: null,
        p_table: null,
        p_author: null,
      },
    },
  },
  {
    file: '20261103090000',
    title: 'Korrekturen Sicherheitsprüfung',
    probe: { kind: 'table', table: 'quotes', column: 'binding_revision' },
  },
  {
    file: '20261104090000',
    title: 'Annahme durch das Team macht die Fassung verbindlich',
    probe: null,
  },
  {
    file: '20261105090000',
    title: 'Kalender-Abo',
    probe: { kind: 'table', table: 'calendar_tokens' },
  },
];

/** Tabelle oder Funktion fehlt: Postgres 42P01/42703, PostgREST PGRST200–PGRST205 bzw. 404. */
export function isMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const c = error.code ?? '';
  return (
    c === '42P01' ||
    c === '42703' ||
    c === '42883' ||
    c.startsWith('PGRST20') ||
    c === 'PGRST202' ||
    /schema cache|does not exist|could not find/i.test(error.message ?? '')
  );
}
