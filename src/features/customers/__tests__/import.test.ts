import { detectDelimiter, parseCustomerTable, splitLine } from '../import';
import type { Customer } from '../types';

const existing: Customer[] = [
  {
    id: 'c1',
    type: 'business',
    name: 'Müller GmbH',
    contact_person: null,
    email: 'info@mueller.de',
    phone: null,
    billing_street: null,
    billing_postal_code: null,
    billing_city: null,
    vat_id: null,
    notes: null,
  },
];

describe('Kundenimport', () => {
  it('erkennt das Trennzeichen (Excel: Tabulator)', () => {
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
    expect(detectDelimiter('a;b;c')).toBe(';');
    expect(detectDelimiter('a,b,c')).toBe(',');
  });

  it('zerlegt Felder in Anführungszeichen', () => {
    expect(splitLine('"Meier, Hans";x;"sagt ""hi"""', ';')).toEqual([
      'Meier, Hans',
      'x',
      'sagt "hi"',
    ]);
  });

  it('liest eine Tabelle mit Überschriften aus Excel', () => {
    const text =
      'Firma\tAnsprechpartner\tE-Mail\tTelefon\tStraße\tPLZ\tOrt\nBäckerei Schmitt GmbH\tHerr Schmitt\ts@baeckerei.de\t0171 1\tMarkt 1\t50667\tKöln';
    const [r] = parseCustomerTable(text, []);
    expect(r!.problem).toBeNull();
    expect(r!.values).toMatchObject({
      name: 'Bäckerei Schmitt GmbH',
      contact_person: 'Herr Schmitt',
      email: 's@baeckerei.de',
      phone: '0171 1',
      billing_street: 'Markt 1',
      billing_postal_code: '50667',
      billing_city: 'Köln',
      type: 'business',
    });
  });

  it('ohne Überschriften gilt die Reihenfolge Name, Ansprechpartner, E-Mail, Telefon …', () => {
    const [r] = parseCustomerTable('Familie Kraus;;kraus@mail.de;0151 2', []);
    expect(r!.values).toMatchObject({
      name: 'Familie Kraus',
      email: 'kraus@mail.de',
      phone: '0151 2',
      type: 'private',
    });
  });

  it('meldet Zeilen ohne Namen und Duplikate (im Bestand und in der Datei)', () => {
    const rows = parseCustomerTable(
      'Name;E-Mail\n;x@y.de\nMüller GmbH;neu@mueller.de\nNeu GmbH;a@neu.de\nneu gmbh;b@neu.de',
      existing,
    );
    expect(rows.map((r) => r.problem)).toEqual([
      'no_name',
      'duplicate_existing',
      null,
      'duplicate_in_file',
    ]);
    expect(rows[0]!.line).toBe(2);
  });

  it('leere Eingabe ergibt keine Zeilen', () => {
    expect(parseCustomerTable('  \n ', [])).toEqual([]);
  });
});
