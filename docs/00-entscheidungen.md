# Entscheidungsprotokoll

Stand: 17.10.2026 · Ergebnis der Planungsrunde (Fragen & Antworten)

Arbeitstitel: **catering-app** (Name noch offen)

## 1. Zielgruppe & Geschäftsmodell

| Thema | Entscheidung |
|---|---|
| Produkttyp | SaaS für viele Cateringfirmen (mandantenfähig) |
| Firmengröße | Klein (1–10 Mitarbeiter) |
| Catering-Arten | Event-Catering und Business-/Office-Lunch |
| Markt & Sprache | DACH, Oberfläche nur Deutsch |
| Preismodell | Monatsabo mit Stufen (Inhalte der Stufen noch offen) |
| Testphase | 14 Tage gratis, volle Funktionen, ohne Zahlungsdaten |
| Pilot | Der Gründer ist selbst Caterer und testet mit dem eigenen Betrieb |
| Probleme heute | Excel/Papier/WhatsApp, Angebote dauern zu lang, Mengen/Einkauf ungenau, Personalplanung chaotisch |

## 2. Nutzer & Rollen

- **Inhaber/Admin**: sieht alles (Finanzen, Einstellungen, Team, Abo)
- **Küche/Koch**: Produktionslisten, Gerichte, Mengen, Allergene, keine Preise
- **Service-/Aushilfspersonal**: eigene Einsätze, Schichtbörse
- **Fahrer/Logistik**: keine eigene Rolle im MVP
- **Endkunde**: Kundenportal im Web (kein Login-Account in der App)
- **Ein Account pro Firma**: Ein Nutzer gehört genau einer Firma an (keine Multi-Firma-Mitgliedschaft)

## 3. Kernfunktionen

### MVP
- **Aufträge/Events + Kalender**
  - Status-Ablauf mit Option/Reservierung: Anfrage → Angebot → Optioniert → Bestätigt → Durchgeführt → Abgerechnet (dazu Abgesagt/Abgelehnt)
  - Business-Lunch-Lieferungen sind normale Events (keine Serienaufträge; Kopieren erleichtert die Wiederholung)
- **Angebote & Kalkulation**
  - Positionen: Menüpakete pro Person, Einzelgerichte à la carte, Zusatzpositionen (Personal, Equipment-Miete, Anfahrt, Getränkepauschale)
  - Kalkulation wählbar: Pauschalpreis pro Person ODER aus dem Wareneinsatz berechnet (Zutatenkosten + Aufschlag)
  - Ausgabe als Online-Angebot im Kundenportal plus PDF (Logo und Farbe des Caterers)
  - Anzahlung, Fristen und Storno: keine festen Regeln, werden individuell gehandhabt (bestenfalls Freitext/optionale Felder)
  - **Angebots-Chat (Fragenkatalog)**: Ein Angebot wird über einen geführten Chat erstellt
    - Der Admin legt die Fragen selbst fest (Fragenkatalog in den Einstellungen: Fragen anlegen, sortieren, bearbeiten)
    - Wird intern vom Admin durchlaufen (z. B. während eines Kundentelefonats), nicht vom Kunden
    - Feste Fragen in Chat-Optik, ohne KI: eine Frage nach der anderen, Antworttypen z. B. Auswahl (Buttons), Mehrfachauswahl, Zahl, Datum/Uhrzeit, Text, Ja/Nein
    - Antworten befüllen Auftrags- und Angebotsfelder (z. B. Datum, Gästezahl, Ort, Anlass, Kunde, Sonderessen); Fragen ohne Feldzuordnung werden als Notiz am Auftrag gespeichert
    - Verzweigungen: Folgefragen erscheinen abhängig von vorherigen Antworten (z. B. nur bei Anlass „Hochzeit“)
    - Ein Fragenkatalog pro Firma (keine Kataloge je Anlass; Unterschiede über Verzweigungen)
    - Danach folgt der normale Angebots-Editor mit den vorbefüllten Daten (Positionen werden dort gewählt; automatische Positionsvorschläge sind nicht vorgesehen)
    - Mit einem sinnvollen Standard-Fragenkatalog für neue Firmen
- **Schlanke Gerichte-Datenbank**
  - Gerichte mit Preis, 14 Pflichtallergenen, Diätformen (vegetarisch/vegan/halal …), optional Zutaten + Menge pro Person
  - Grundlage für Allergenkennzeichnung, Wareneinsatz-Kalkulation und Einkaufsliste
- **Küchensicht pro Event**: Produktionsliste (auch über mehrere Events/Tage), Allergiker & Sonderessen, Einkaufsliste (summiert aus Zutaten), Zeitplan (Abfahrt, Aufbau, Ausgabe, Abbau)
- **Allergene & Diätformen**: 14 Pflichtallergene je Gericht, automatische Kennzeichnung, Erfassung von Sonderessen/Allergien pro Event (kein HACCP)
- **Schichtbörse (Personal)**
  - Der Admin legt pro Event Slots an (Rolle/Qualifikation, Zeit, Anzahl)
  - Mitarbeiter sehen nur Slots, für die sie qualifiziert sind, und bewerben sich
  - Der Admin sagt zu oder ab; der Mitarbeiter bekommt eine Benachrichtigung über die Entscheidung
  - Der Admin kann Mitarbeiter auch direkt einplanen (ohne Bewerbung)
  - Mitarbeiter können nach einer Zusage bis zu einer Frist wieder absagen; der Admin wird informiert, der Slot ist wieder frei
  - Zugesagte sehen die Einsatzinfos: Adresse, Treffpunkt, Dresscode, Ablaufplan, Ansprechpartner
- **Kundenportal (Web)**: Angebot ansehen und annehmen; Details ändern (Gästezahl, Menüwahl, Allergien der Gäste)

### Nach dem MVP
- Equipment & Mietartikel (Bestand, Reservierung, Packlisten, Rücklauf/Bruch)
- Rechnungen & Zahlungen (dann auch die Buchhaltungs-Anbindung; welche, ist noch offen)
- Einkauf & Lieferanten (Bestellungen, Preispflege)
- Volles Rezeptmodul (Zubereitung, Ausbeute, Skalierung)
- Verfügbarkeiten und Zeiterfassung für das Personal
- Lieferung/Touren (bewusst nicht ausgewählt)

## 4. Plattformen

- Expo-App für iOS und Android, für alle Rollen
- Web-Admin über Expo Web (Angebote/Kalkulation bequem am PC)
- Kundenportal im Web
- Offline: bereits geladene Daten (Einsatzinfos, Ablaufpläne, Listen) sind lesbar, Änderungen nur online

## 5. Technik

| Thema | Entscheidung |
|---|---|
| Framework | Expo (React Native) + Expo Router, TypeScript |
| Backend | Supabase (Postgres, Row-Level-Security, Auth, Storage, Edge Functions), EU-Region Frankfurt |
| Login | E-Mail + Passwort, Sign in with Apple, Google; Mitarbeiter treten per Einladung durch den Admin bei (Firma + Rolle festgelegt) |
| Benachrichtigungen | Push in der App (Expo Notifications) |
| Abo-Zahlung | Stripe, Abschluss nur im Web-Admin; Mobile-App ohne Kauf-Button |
| Dokumente | Online-Angebot im Portal + serverseitig erzeugtes PDF |
| E-Mail | Versand über einen Dienst (z. B. Resend/Postmark), Absendername = Firma, Reply-To = E-Mail der Firma |
| Kalender | iCal-Abo-Link (ICS) pro Mitarbeiter/Admin, nur lesend |
| Buchhaltung | noch offen (Entscheidung mit dem Rechnungsmodul) |

## 6. Design & UX

- Stil: clean und professionell (hell, viel Weißraum, eine Akzentfarbe; Vorbild sind moderne B2B-Tools)
- Branding: Logo und Akzentfarbe des Caterers auf Angeboten, PDFs und im Kundenportal; die Team-App bleibt im App-Design
- Name: noch offen
- Appllama-Recherche vor dem Screen-Design: Onboarding & Firmen-Setup, Kalender & Listen, Schichten & Jobs, Formulare & Angebote

## 7. Recht & Datenschutz

- DSGVO-Standard: EU-Hosting, AVV für Kunden, Datenschutzerklärung, Datenexport und Löschung pro Firma
- Steuersätze pro Position konfigurierbar (Speisen/Getränke/Personal/Equipment); DE zuerst, AT/CH vorbereiten
- Bewusst später: Arbeitszeit-Dokumentation, GoBD/E-Rechnung (mit dem Rechnungsmodul)

## 8. Rahmen

- Entwicklung: Gründer + Claude
- Zeitrahmen MVP: ca. 2–3 Monate, in kleinen testbaren Etappen
- UI-Recherche und -Design mit dem Appllama-MCP

## Offene Punkte

- App-Name und Marke
- Inhalt und Preise der Abo-Stufen
- Buchhaltungs-Anbindung (lexoffice, sevDesk, DATEV …)
- Genaue Absagefrist der Schichtbörse (Vorschlag: pro Firma einstellbar, Standard 48 h)
