import { templateFromDraft } from '../components/item-templates';

const base = {
  type: 'service' as const,
  name: 'Servicekraft',
  unit: 'Person',
  price: '32,00',
  hours: '6,5',
  perGuest: false,
};

describe('templateFromDraft', () => {
  it('wandelt Eingaben in Cent und Stunden', () => {
    expect(templateFromDraft(base)).toEqual({
      type: 'service',
      name: 'Servicekraft',
      unit_label: 'Person',
      unit_price_cents: 3200,
      quantity_mode: 'fixed',
      hours: 6.5,
    });
  });

  it('lehnt leere Bezeichnung und ungültigen Preis ab', () => {
    expect(templateFromDraft({ ...base, name: ' ' })).toBeNull();
    expect(templateFromDraft({ ...base, price: '3,999' })).toBeNull();
    expect(templateFromDraft({ ...base, hours: '' })).toBeNull();
  });

  it('ignoriert Stunden außerhalb von Personal und füllt die Einheit', () => {
    expect(
      templateFromDraft({ ...base, type: 'travel', unit: '', hours: '', perGuest: true }),
    ).toMatchObject({ hours: null, unit_label: 'pauschal', quantity_mode: 'per_guest' });
  });
});
