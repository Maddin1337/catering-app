import type { CustomerInput } from './api';
import { findDuplicate } from './duplicates';
import type { Customer } from './types';

// Kundenimport durch Einfügen aus Excel (Tabulator-getrennt) oder CSV (Semikolon/Komma). Die erste Zeile
// darf Überschriften enthalten; erkannt werden die üblichen deutschen Namen.

const HEADERS: Record<string, keyof CustomerInput | 'address'> = {
  name: 'name',
  firma: 'name',
  kunde: 'name',
  firmenname: 'name',
  kundenname: 'name',
  ansprechpartner: 'contact_person',
  kontakt: 'contact_person',
  ansprechperson: 'contact_person',
  email: 'email',
  'e-mail': 'email',
  mail: 'email',
  telefon: 'phone',
  tel: 'phone',
  handy: 'phone',
  mobil: 'phone',
  straße: 'billing_street',
  strasse: 'billing_street',
  adresse: 'billing_street',
  plz: 'billing_postal_code',
  postleitzahl: 'billing_postal_code',
  ort: 'billing_city',
  stadt: 'billing_city',
  ustid: 'vat_id',
  'ust-idnr': 'vat_id',
  'ust-id': 'vat_id',
  ustidnr: 'vat_id',
  notiz: 'notes',
  notizen: 'notes',
  bemerkung: 'notes',
};

/** Trennzeichen der Tabelle: Tabulator (Excel), sonst Semikolon, sonst Komma. */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  if (first.includes('\t')) return '\t';
  if (first.includes(';')) return ';';
  return ',';
}

/** Zerlegt eine Zeile; Felder in Anführungszeichen dürfen das Trennzeichen enthalten. */
export function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export type ImportRow = {
  line: number;
  values: CustomerInput;
  /** Hinweis, warum die Zeile nicht importiert wird. */
  problem: 'no_name' | 'duplicate_existing' | 'duplicate_in_file' | null;
};

const EMPTY: CustomerInput = {
  type: 'business',
  name: '',
  contact_person: null,
  email: null,
  phone: null,
  billing_street: null,
  billing_postal_code: null,
  billing_city: null,
  vat_id: null,
  notes: null,
};

const key = (h: string) => h.toLowerCase().replace(/[.\s]/g, '').replace(/­/g, '');

/**
 * Liest die eingefügte Tabelle. Mit Überschriftenzeile gilt die Zuordnung der Spalten, ohne Überschriften
 * die Reihenfolge Name, Ansprechpartner, E-Mail, Telefon, Straße, PLZ, Ort. Ein „@“ im Namen oder eine
 * USt-IdNr. ändern nichts; `type` ist „business“, außer es gibt keinen Firmennamen-Hinweis (dann „private“,
 * wenn das Feld Ansprechpartner leer ist und der Name zwei Wörter hat).
 */
export function parseCustomerTable(text: string, existing: Customer[]): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(text);
  const first = splitLine(lines[0]!, delimiter);
  const mapped = first.map((h) => HEADERS[key(h)]);
  const hasHeader = mapped.filter(Boolean).length >= 1 && mapped.some((m) => m === 'name');
  const columns: (keyof CustomerInput | undefined)[] = hasHeader
    ? (mapped as (keyof CustomerInput | undefined)[])
    : [
        'name',
        'contact_person',
        'email',
        'phone',
        'billing_street',
        'billing_postal_code',
        'billing_city',
      ];
  const body = hasHeader ? lines.slice(1) : lines;

  const seen: Customer[] = [];
  return body.map((l, i) => {
    const cells = splitLine(l, delimiter);
    const values: CustomerInput = { ...EMPTY };
    columns.forEach((c, idx) => {
      const v = cells[idx];
      if (c && c !== 'type' && v) (values as Record<string, unknown>)[c] = v;
    });
    values.name = values.name.trim();
    const person =
      !values.contact_person &&
      values.name.split(/\s+/).length === 2 &&
      !/\b(gmbh|ag|kg|ug|e\.v\.|mbh|gbr|ohg)\b/i.test(values.name);
    values.type = person ? 'private' : 'business';
    let problem: ImportRow['problem'] = null;
    if (values.name.length < 2) problem = 'no_name';
    else if (findDuplicate(existing, { name: values.name, email: values.email ?? '' }))
      problem = 'duplicate_existing';
    else if (findDuplicate(seen, { name: values.name, email: values.email ?? '' }))
      problem = 'duplicate_in_file';
    if (!problem) seen.push({ id: `row-${i}`, ...values });
    return { line: i + 1 + (hasHeader ? 1 : 0), values, problem };
  });
}
