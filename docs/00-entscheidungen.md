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

## 9. Entscheidungen Runde 2 (17.10.2026, nach der Prüfung)

Diese Punkte haben Vorrang vor abweichenden Vorschlägen in 01–06.

| # | Thema | Entscheidung |
|---|---|---|
| R2-1 | Kundenportal | Die Menüwahl vor der Annahme wirkt direkt. Gästezahl und alle Änderungen nach der Bestätigung laufen als Änderungswunsch an den Admin (bestätigen oder ablehnen). Ab ± 20 % Gästezahl erscheint der Hinweis „bitte anrufen“. Sonderessen und Allergien gelten sofort |
| R2-2 | Direktbestätigung | Erlaubt: Ein Auftrag kann ohne versendetes Angebot direkt auf `confirmed` gesetzt werden (z. B. Stammkunde am Telefon) |
| R2-3 | „Durchgeführt“ | Wird **nicht** automatisch gesetzt. Der Admin setzt `completed` selbst und bekommt am Tag nach dem Event um 09:00 eine Erinnerung |
| R2-4 | Status-Korrekturen | **Keine Rückwärts-Übergänge** im MVP (kein `invoiced → completed`, kein `completed → confirmed`, keine Reaktivierung von `declined`/`cancelled`). Fehlbedienungen werden über eine Bestätigungsabfrage vor jedem Statuswechsel vermieden |
| R2-5 | Preisrundung | Preisvorschläge aus der Wareneinsatz-Kalkulation werden auf volle 10 Cent **aufgerundet** (26,32 € → 26,40 €) |
| R2-6 | Änderungsschluss im Portal | Standard 72 h vor Beginn bei Event-Catering, 24 h bei Business-Lunch; pro Auftrag änderbar |
| R2-7 | Zutatenmengen | „Menge p. P.“ = Rohware vor dem Garen. Die Einkaufsliste rechnet 5 % Puffer auf, die Produktionsliste nicht |
| R2-8 | Küchen-Gerät | **Kein Tablet**: Die Küche nutzt Smartphones (native App). Eine eigene Tablet-Optimierung kommt nach dem MVP |
| R2-9 | Schichtbörse: Qualifikation | Jeder Slot hat genau eine Qualifikation (Pflichtfeld). Wer sie nicht hat, sieht den Slot nicht |
| R2-10 | Schichtbörse: Verschiebung | **Kein** Sonderabsagerecht bei Verschiebung eines Events. Es gilt immer die normale Absagefrist (48 h, pro Firma einstellbar); danach nur über den Admin. Eingeplante werden über die Zeitänderung benachrichtigt |
| R2-11 | Kinderportionen | Nicht im MVP; Kinder werden als eigene Angebotsposition erfasst (Workaround) |
| R2-12 | Konto löschen | Freigegeben: Edge Function `delete-account` (App-Store-Pflicht, inkl. Widerruf von Sign in with Apple) |
| R2-13 | Firma löschen | Freigegeben: Edge Function `purge-company` löscht nach 30 Tagen alle Daten und Dateien der Firma |
| R2-14 | Datenexport | Per **Download-Link per E-Mail**: Der Export wird im Hintergrund erzeugt, im privaten Bucket `exports` abgelegt, und der Admin bekommt eine E-Mail mit einem signierten Link, der 7 Tage gültig ist; danach wird die Datei automatisch gelöscht |

## Offene Punkte

- App-Name und Marke
- Inhalt und Preise der Abo-Stufen
- Buchhaltungs-Anbindung (lexoffice, sevDesk, DATEV …)
- Genaue Absagefrist der Schichtbörse (Vorschlag: pro Firma einstellbar, Standard 48 h)
