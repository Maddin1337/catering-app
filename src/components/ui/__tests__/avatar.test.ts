import { initials, tintFor } from '../avatar';

describe('Avatar', () => {
  it('nimmt höchstens zwei Initialen', () => {
    expect(initials('Anna Admin')).toBe('AA');
    expect(initials('Müller GmbH')).toBe('MG');
    expect(initials('Hans Peter von Beispiel')).toBe('HB');
    expect(initials('  anna ')).toBe('A');
    expect(initials('')).toBe('');
  });

  it('überspringt Zeichen ohne Buchstaben', () => {
    expect(initials('& Söhne')).toBe('S');
    expect(initials('Élodie Ünal')).toBe('ÉÜ');
  });

  it('liefert für denselben Namen immer denselben Ton', () => {
    expect(tintFor('Müller GmbH')).toBe(tintFor('Müller GmbH'));
    expect(['teal', 'amber', 'indigo', 'rose', 'sky', 'violet']).toContain(tintFor('x'));
  });
});
