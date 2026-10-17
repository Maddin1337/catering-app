import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import portal from './de/portal.json';
import team from './de/team.json';

// Nur Deutsch im MVP (docs/00 §1). Namensräume: `team` (Du, Team-App) und `portal` (Sie, Kundenportal).
// Texte stehen nicht im Code, damit weitere Sprachen später ohne Umbau möglich sind (P-22).
const i18n = createInstance();

void i18n.use(initReactI18next).init({
  lng: 'de',
  fallbackLng: 'de',
  ns: ['team', 'portal'],
  defaultNS: 'team',
  resources: { de: { team, portal } },
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
