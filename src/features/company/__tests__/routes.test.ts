import { defaultRoute } from '../routes';

describe('defaultRoute', () => {
  it('schickt Abgemeldete zur Anmeldung', () => {
    expect(defaultRoute('signedOut', null)).toBe('/login');
  });
  it('schickt Konten ohne Firma zum Willkommen', () => {
    expect(defaultRoute('noCompany', null)).toBe('/welcome');
  });
  it('setzt das Onboarding beim Branding fort', () => {
    expect(defaultRoute('onboarding', 'admin')).toBe('/onboarding/branding');
  });
  it('wählt den ersten Tab je Rolle', () => {
    expect(defaultRoute('ready', 'admin')).toBe('/start');
    expect(defaultRoute('ready', 'kitchen')).toBe('/today');
    expect(defaultRoute('ready', 'staff')).toBe('/my-shifts');
  });
});
