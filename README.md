# catering-app

Arbeitstitel einer Planungs-App für kleine Cateringfirmen (1–10 Mitarbeiter) im DACH-Raum.
Gebaut wird mit Expo (iOS, Android, Web) und Supabase. Das UI-Design entsteht mit Recherche über den Appllama-MCP.

> **Status** (Stand 18.10.2026): Meilensteine M0 bis M5 gebaut, M6 (Kundenportal), M7 (Schichtbörse) und M8 (Küchenlisten)
> im Kern. Es fehlen Push, E-Mail-Dienst, Abo/Stripe, Offline-Speicher und der Store-Build. Die Datenbank-Updates für den
> Supabase SQL Editor und eine Testanleitung stehen in [docs/08-testanleitung.md](docs/08-testanleitung.md); Umsetzungsstand und
> Abweichungen von der Planung in [docs/07-umsetzungsstand.md](docs/07-umsetzungsstand.md).

## Worum es geht

Kleine Caterer organisieren heute vieles über Excel, Papier und WhatsApp. Angebote dauern zu lange, Mengen und Einkauf werden von Hand gerechnet, und die Personalplanung ist chaotisch.
Die App bündelt Aufträge, Angebote, Gerichte, Küche und Personal an einem Ort und wird als SaaS mit Monatsabo angeboten.

## MVP auf einen Blick

| Bereich                | Inhalt                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aufträge & Kalender    | Ablauf Anfrage → Angebot → Optioniert → Bestätigt → Durchgeführt → Abgerechnet, Kalenderansicht, Auftrag kopieren (Business-Lunch)                |
| Angebots-Chat          | Geführter Chat mit selbst festgelegten Fragen (ein Katalog pro Firma, mit Verzweigungen). Die Antworten befüllen Auftrag und Angebot              |
| Angebote & Kalkulation | Menüpakete p. P., Einzelgerichte, Zusatzpositionen; Pauschalpreis oder Wareneinsatz + Aufschlag; Online-Angebot + PDF mit Branding des Caterers   |
| Gerichte               | Schlanke Datenbank mit Preis, 14 Allergenen, Diätformen und optionalen Zutaten                                                                    |
| Küche                  | Produktionsliste, Sonderessen/Allergien, Einkaufsliste, Zeitplan, ohne Preise                                                                     |
| Schichtbörse           | Slots je Event und Qualifikation. Mitarbeiter bewerben sich, der Admin sagt zu oder ab oder plant direkt ein, per Push. Absage bis zu einer Frist |
| Kundenportal (Web)     | Angebot ansehen und annehmen, Gästezahl/Menüwahl/Allergien anpassen                                                                               |
| Abo                    | 14 Tage gratis, danach Stripe-Abo nur im Web, ohne Kauf in der App; nach Ablauf Lesemodus                                                         |

Rollen: **Admin** (Inhaber), **Küche**, **Service/Aushilfe**. Endkunden nutzen nur das Portal.
Nach dem MVP: Equipment, Rechnungen und Buchhaltung, Einkauf und Lieferanten, volles Rezeptmodul, Zeiterfassung.

## Technik

Expo + Expo Router (TypeScript) · Supabase in der EU-Region (Postgres mit Row-Level-Security pro Firma, Auth, Storage, Edge Functions) · TanStack Query mit Offline-Lesen · Expo Push · Stripe Billing · E-Mail-Dienst · iCal-Feed.

## Roadmap (Kurzform)

| M   | Zeitraum      | Ergebnis                                                |
| --- | ------------- | ------------------------------------------------------- |
| M0  | 19.–23.10.    | Fundament: App auf iOS/Android/Web, Login, CI, Supabase |
| M1  | 26.–30.10.    | Firma anlegen, Team einladen, Tabs je Rolle             |
| M2  | 02.–05.11.    | Gerichte, Allergene, Zutaten, Pakete                    |
| M3  | 06.–16.11.    | Kunden, Aufträge, Kalender · **Pilot Stufe 1**          |
| M4  | 17.–25.11.    | Angebots-Chat, Angebots-Editor, Kalkulation             |
| M5  | 26.11.–02.12. | Versand mit PDF und E-Mail                              |
| M6  | 03.–09.12.    | Kundenportal · **Pilot Stufe 2**                        |
| M7  | 10.–18.12.    | Schichtbörse und Push · **Pilot Stufe 3**               |
| –   | 21.12.–01.01. | Weihnachtspuffer                                        |
| M8  | 04.–08.01.    | Küchenlisten, Einkaufsliste, iCal                       |
| M9  | 11.–15.01.    | Stripe-Abo, Lesemodus, Datenexport                      |
| M10 | 18.–22.01.    | Härtung, Store-Einreichung                              |
| ✔   | 05.02.2027    | MVP-Abnahme                                             |

Details, Definition of Done und Appllama-Termine stehen in [06-roadmap.md](docs/06-roadmap.md).

## Dokumente

| Datei                                                                   | Inhalt                                                                                                                  | Wann lesen                |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| [00-entscheidungen.md](docs/00-entscheidungen.md)                       | Verbindliche Entscheidungen aus der Planungsrunde                                                                       | **Zuerst**                |
| [01-produkt.md](docs/01-produkt.md)                                     | Personas, Rechte-Matrix, Feature-Katalog, User Stories, Abo-Stufen, Kennzahlen                                          | Bei fachlichen Fragen     |
| [02-ablaeufe.md](docs/02-ablaeufe.md)                                   | Statusautomat, Angebot und Kalkulation (Formeln), Portal, Schichtbörse, Benachrichtigungen, Küchenlisten, Angebots-Chat | Bei Geschäftsregeln       |
| [03-datenmodell.md](docs/03-datenmodell.md)                             | Supabase-Schema, RLS, SQL-Entwurf, Storage, Jobs                                                                        | Beim Bauen des Backends   |
| [04-screens-ux.md](docs/04-screens-ux.md)                               | Navigation, Screen-Inventar (SC-xx), Design-Tokens, Appllama-Rechercheplan                                              | Beim Screen-Design        |
| [05-architektur.md](docs/05-architektur.md)                             | Stack, Projektstruktur, Edge Functions, Auth, Stripe, Sicherheit, CI/EAS, ADRs                                          | Beim Projekt-Setup        |
| [06-roadmap.md](docs/06-roadmap.md)                                     | Meilensteine, Gantt, Pilot, Store-Einreichung, Risiken, nächste Schritte                                                | Für die Planung der Woche |
| [09-designsystem.md](docs/09-designsystem.md)                           | Designsystem: Farben, Typografie, Bausteine, Bewegung                                                                   | Bei UI-Arbeit             |
| [07-umsetzungsstand.md](docs/07-umsetzungsstand.md)                     | Was gebaut und geprüft ist, Abweichungen von der Planung                                                                | **Vor dem Weiterbauen**   |
| [research/appllama-onboarding.md](docs/research/appllama-onboarding.md) | Appllama-Recherche Onboarding: Muster, Lücken, Entscheidungsvorlage                                                     | Beim Screen-Design        |

Die Dokumente 01–06 sind bewusst ausführlich und dienen als Nachschlagewerk. Jedes endet mit einem Abschnitt „Vorschläge zur Freigabe“, der Annahmen auflistet, die noch bestätigt werden müssen.

## Entwickeln

```bash
npm install
cp .env.example .env.local   # Supabase-URL und anon key eintragen
npm run web                  # Web; npm run ios / npm run android für Geräte
npm run typecheck && npm run lint && npm test
npm run db:test              # Migrationen + pgTAP gegen ein lokales Postgres 16 (ohne Docker)
```

Mit Docker: `supabase start`, danach `supabase db reset` und `supabase test db`.

## Offene Entscheidungen

- App-Name und Marke
- Abo-Stufen und Preise (Vorschlag: 29 € / 59 € / 99 €)
- Buchhaltungs-Anbindung (fällt mit dem Rechnungsmodul)
- Restliche Vorschläge aus 01–06 in den Abschnitten „Vorschläge zur Freigabe“. Portal-Regeln, Statusübergänge, Rundung, Änderungsschluss, Küchengerät, Schichtbörse, Konto-/Firmenlöschung und Datenexport sind entschieden (siehe [00-entscheidungen.md](docs/00-entscheidungen.md) §9)
