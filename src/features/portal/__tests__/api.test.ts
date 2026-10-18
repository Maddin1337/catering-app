import { portalErrorKey } from '../api';

describe('portalErrorKey', () => {
  it('übersetzt Hinweise der Datenbank in Kundenmeldungen', () => {
    expect(portalErrorKey({ hint: 'changes_locked' })).toBe('errors.changes_locked');
    expect(portalErrorKey({ hint: 'quote_expired' })).toBe('errors.quote_expired');
    expect(portalErrorKey({ hint: 'revision_outdated' })).toBe('errors.revision_outdated');
  });
  it('fällt bei Unbekanntem auf die allgemeine Meldung zurück', () => {
    expect(portalErrorKey({ hint: 'irgendwas' })).toBe('errors.unknown');
    expect(portalErrorKey(null)).toBe('errors.unknown');
  });
});
