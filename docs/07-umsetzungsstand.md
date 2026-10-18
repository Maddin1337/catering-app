# 07 – Umsetzungsstand und Abweichungen von der Planung

Stand: 17.10.2026 · laufender Meilenstein: **M0 · Fundament** (Plan: `docs/06-roadmap.md` §1.3)

Dieses Dokument nennt, was gebaut und geprüft ist, und wo die Umsetzung **bewusst von 01–06 abweicht**. Wo es abweicht, gilt dieses Dokument. Die Pläne 01–06 bleiben als Soll erhalten und werden bei passender Gelegenheit nachgezogen.

## M0: Stand gegen die Definition of Done

| # | Prüfpunkt aus 06 §1.3 | Stand | Wie geprüft |
|---|---|---|---|
| 1 | Preview-Build auf Android, TestFlight, staging-URL | **offen** | braucht Expo-, Apple- und Hosting-Konten (E-2, E-12); lokal nicht prüfbar |
| 2 | Registrieren, Bestätigungsmail, an- und abmelden, Passwort zurücksetzen | **teilweise geprüft** | Oberfläche und Fehlerfälle im Browser gegen das **echte Projekt** (falsches Passwort, „Passwort vergessen“, falscher Code, ungültiger Link). Offen: erfolgreiche Registrierung und Mail-Zustellung, weil Migrationen, Vorlagen und Auth-Einstellungen dort noch nicht eingespielt sind (Abschnitt „Supabase-Projekt einrichten“) |
| 3 | Platzhalter „Willkommen“ nach Login, Abmelden führt zu SC-01 | **gebaut, nicht gegen Supabase geprüft** | Gate und Seiten vorhanden; Ablauf braucht eine echte Sitzung |
| 4 | Textänderung per EAS Update ohne Neuinstallation | **offen** | `expo-updates` und EAS-Projekt-ID brauchen das Expo-Konto |
| 5 | Grüner CI-Lauf mit bestandenem Mandantentest | **CI-Datei geschrieben, nie ausgeführt**; Mandantentest lokal grün | `.github/workflows/ci.yml` lief noch nicht; die Datenbanktests laufen lokal grün (Abschnitt unten) |

### Was lokal geprüft ist

| Prüfung | Ergebnis |
|---|---|
| `npm run typecheck` (TypeScript strict, `noUncheckedIndexedAccess`) | grün |
| `npm run lint` (`expo lint`) | grün |
| `npm test` (Jest: Geldrechnen, Zeitzonen, Fehlerabbildung, Formulare, Login-Screen) | 18 Tests grün |
| `npm run web:export` (SPA-Export) | grün |
| Browser-Test auf dem Web-Export (Playwright, Chromium): „/“ führt zu Login, Pflichtfeld-Meldungen, Registrierung, Passwort anzeigen, Passwort vergessen, abgelaufener Reset-Link, Kundenportal-Platzhalter, 404-Seite, keine Konsolenfehler | grün |
| `npm run db:test` (Postgres 16, alle Migrationen, pgTAP) | **37 Tests grün**: RLS auf jeder Tabelle, anon ohne Rechte, Funktionsrechte (Whitelist), neue Funktionen standardmäßig nicht ausführbar, Hilfsfunktionen für Firma A und B, Lesemodus, Referenzdaten |

Die Datenbanktests laufen ohne Docker gegen ein Wegwerf-Postgres 16 mit einem Nachbau der nötigen Supabase-Teile (`scripts/db/stubs.sql`). Die CI nutzt stattdessen `supabase db reset` und `supabase test db`. **Nicht geprüft** ist deshalb, ob die Migrationen auf der echten Supabase-Plattform (Postgres 17, eigene Rollen und Erweiterungen) fehlerfrei laufen. Das ist der erste Schritt, sobald Docker oder ein Supabase-Projekt verfügbar ist.

Ein Test hat beim Schreiben eine Lücke gezeigt: Die Prüfung „keine Funktion für `anon` ausführbar“ blieb grün, auch wenn die Default-Privileges fehlten, weil die Aufräum-Migration vorhandene Funktionen ohnehin bereinigt. Neu ist deshalb ein Test mit einer **frisch angelegten Funktion**; er schlägt fehl, wenn die Default-Privileges fehlen (geprüft durch Entfernen der Zeile).

## Abweichungen von der Planung

| # | Thema | Plan | Umsetzung | Grund |
|---|---|---|---|---|
| A-1 | Routenordner | `app/` im Repo-Root (05 §3.1, 04 §1.2) | **`src/app/`** | Vorgabe des Expo-SDK-58-Templates; Expo Router unterstützt beides. `AGENTS.md` des Templates verweist darauf |
| A-2 | Gruppe `(public)` | `verify-email`, `reset-password`, `invite/[token]` in `(auth)` | **eigene Gruppe `(public)`**, immer erreichbar | Der Reset-Link legt selbst eine Sitzung an; läge die Route in `(auth)` (nur ohne Sitzung), würde das Gate sie wegschalten |
| A-3 | SC-07 Willkommen und Onboarding | `(auth)/welcome`, `(auth)/onboarding/*` | **`(setup)/welcome`, `(setup)/onboarding/*`** | Mit Sitzung, aber ohne Firma oder mit offenem Onboarding gehören die Seiten in eine eigene geschützte Gruppe. Das Gate (`useSetupStage`) kennt seit M1 die Stufen `signedOut`, `noCompany`, `onboarding`, `ready` und `error` |
| A-4 | UI-Bibliothek | NativeWind + react-native-reusables (05 §2.2) | **`StyleSheet` mit Design-Tokens** (`src/theme/tokens.ts`), eigene Basis-Komponenten | NativeWind ist für SDK 58 und React Native 0.88 nur als Vorabversion (5.0.0-rc) verfügbar; die stabile 4.x ist dafür nicht belegt. Eigene Komponenten sind ohne Risiko lauffähig, auch im Web. Die Entscheidung wird mit dem Expo-SDK-Upgrade neu bewertet |
| A-5 | Speicher der Sitzung (nativ) | verschlüsseltes MMKV, Schlüssel im SecureStore (05 §2.3) | **SecureStore in Blöcken** (`src/lib/secure-kv.ts`) | MMKV braucht ein natives Modul und einen Development-Build, den es hier nicht gibt. MMKV kommt mit dem Offline-Lesen in M7 |
| A-6 | Mail-Bestätigung | Bestätigung optional; einrichten darf man vorher (01 US-01.7) | **Bestätigung vor der ersten Anmeldung** (`enable_confirmations = true`), **entschieden R3-1** | Supabase legt ohne Bestätigung keine Mail an und bestätigt automatisch. „Erst einrichten, dann bestätigen“ ginge nur mit eigener Logik. Die Schutzwirkung (kein Versand und keine Einladungen ohne bestätigte Adresse) ist damit ohnehin erfüllt. Der Gründer hat zugestimmt: US-01.7 entfällt (R3-1) |
| A-7 | Datenbanktypen | `createClient<Database>` ab M0 (05 §3.3) | **ohne Typparameter** bis M1 | In M0 fragt die App keine Tabellen ab; `supabase gen types` braucht die CLI mit Docker. Die CI prüft die Typdatei, sobald sie existiert |
| A-8 | Migrationsdaten | Dateinamen `20261102…` (03 §9.2) | **`20261019…`** und Aufteilung nach Meilensteinen | M0 legt Typen, Mandant, Referenzdaten und Rechte an; die übrigen Tabellen folgen mit den Meilensteinen (03 §9.2, „Aufteilung nach Meilensteinen“) |
| A-9 | Social-Login-Schaltflächen (M0) | Apple und Google „vorbereitet“ (06 §1.3) | **nicht eingebaut** | Ohne Zugangsdaten der Anbieter wären es tote Schaltflächen; sie kommen mit M1 |
| A-10 | Typografie Beschriftungen | `text.caption` Gewicht 500 (04 §4.4) | **Inter SemiBold (600)** | 04 §4.4 sieht nur die Schnitte 400 und 600 vor; ein dritter Schnitt wäre eine zusätzliche Schriftdatei |
| A-11 | Link-Art in Mails | `token_hash` (05 §6.3) | **Link und 6-stelliger Code** (R3-2), umgesetzt in SC-03 und SC-05, **Code-Felder hinter `EXPO_PUBLIC_AUTH_EMAIL_CODE`** (aus, bis eigener SMTP-Dienst und Vorlagen stehen); bis dahin Rückkehr über den Link der Standard-Mail (`?code=`, PKCE) | Der Code funktioniert auf jedem Gerät, auch ohne Universal Links; Vorlagen sind bei Supabase nur mit eigenem SMTP bearbeitbar |

## Supabase-Projekt einrichten (einmalig)

Das Projekt `lulaptdkzzmyjvdaxefv` (Frankfurt) ist angelegt und erreichbar: Ein Browser-Test gegen das echte Projekt lief grün (falsches Passwort → deutsche Fehlermeldung, „Passwort vergessen“ neutral, falscher Code und ungültiger Link → verständliche Meldung). **Noch nicht eingespielt** sind die Migrationen, die Mail-Vorlagen und die Auth-Einstellungen: Dafür braucht es Zugriff auf das Projekt, den die App-Schlüssel nicht geben. Auf einem Rechner mit Node.js:

```bash
npx supabase login
npx supabase link --project-ref lulaptdkzzmyjvdaxefv
npx supabase db push        # wendet die vier Migrationen an
npx supabase config push    # überträgt Auth-Einstellungen und Mail-Vorlagen aus supabase/config.toml
```

### Ohne Terminal: über das Supabase-Dashboard

1. **Datenbank:** Im Dashboard SQL Editor öffnen, „New query“ wählen, den gesamten Inhalt von `supabase/remote-setup.sql` einfügen und „Run“ drücken. Die Datei enthält alle vier Migrationen (erzeugt mit `npm run db:bundle`, geprüft gegen dieselben 37 Tests). Sie darf nur **einmal** laufen. Danach stehen unter „Table Editor“ die Tabellen `companies`, `company_members`, `subscriptions`, `allergens` (14 Zeilen) und `plan_limits` (4 Zeilen).
2. **Auth-Einstellungen** (Authentication, die Menünamen können leicht abweichen):
   - E-Mail-Anmeldung an, **„Confirm email“ an**
   - Mindestlänge des Passworts **10**
   - URL Configuration: Redirect-URLs `http://localhost:8081/**` und `cateringapp://**` eintragen (Site URL für den Moment `http://localhost:8081`)
3. **Mail-Vorlagen: vorerst weglassen.** Supabase lässt Vorlagen nur mit eigenem SMTP-Dienst bearbeiten (E-3). Bis dahin gelten die englischen Standard-Mails mit Link. Die App funktioniert damit (Link führt zurück in die App, die Adresse ist bestätigt, der Reset-Link öffnet „Neues Passwort“); die Code-Felder sind per `EXPO_PUBLIC_AUTH_EMAIL_CODE=false` ausgeblendet. Mit eigenem SMTP: Vorlagen aus `supabase/templates/` einfügen und das Flag auf `true` setzen.

Wer später doch die CLI nutzt, markiert die Migrationen vorher mit `npx supabase migration repair --status applied <Version>` als eingespielt, sonst versucht `db push` sie erneut.

Hinweise:
- `config.toml` enthält Werte für die lokale Entwicklung (`site_url` und Redirect-URLs zeigen auf `localhost`). Für das echte Staging bekommt das Projekt einen eigenen Block mit der Staging-Domain.
- **Mailversand:** Das eingebaute Supabase-SMTP verschickt nur an Mitglieder des Supabase-Teams und nur wenige Mails pro Stunde. Für echte Nutzer braucht es einen eigenen Mail-Dienst (E-3, Resend oder Postmark) als SMTP in den Auth-Einstellungen.
- Die Schlüssel stehen lokal in `.env.local` (nicht im Repo). Für die Profile `development` und `preview` in `eas.json` stehen die **öffentlichen** Werte (Projekt-URL und `sb_publishable_…`-Schlüssel) direkt als `env`, weil sie ohnehin in jeder fertigen App stecken. Für `production` kommen sie später als Umgebungsvariablen ins Expo-Projekt. Nie ein `service_role`-Schlüssel.

## Web-Version auf Vercel

`vercel.json` legt Build (`npx expo export -p web`), Ausgabeordner `dist`, den SPA-Fallback und die Sicherheits-Header fest (Vercel liest `public/_headers` und `public/_redirects` nicht; die Dateien bleiben für Netlify). Nach dem ersten Deployment muss die Vercel-Adresse in Supabase unter Authentication, URL Configuration als Site URL und Redirect-URL (`https://<adresse>/**`) eingetragen werden, sonst führen die Links in den Mails nach `localhost`.

## Updates ohne neuen Build (EAS Update)

`expo-updates` ist eingebunden (`runtimeVersion` folgt der App-Version, Update-URL des Expo-Projekts). `.eas/workflows/publish-preview-update.yml` veröffentlicht bei jedem Push auf `planung` einen Stand auf den EAS-Branch `preview`. Die öffentlichen Supabase-Werte stehen dafür in `.env` (im Repo, nur öffentliche Werte); persönliche Abweichungen gehören in `.env.local`. Das Workflow ist noch **nicht** gelaufen; ob Expo Go den Stand öffnet, ist ungeprüft.

## M1 · Firma, Team, Einladung

### Etappe 1 (gebaut): Firma anlegen und Tabs je Rolle

- **Datenbank:** `supabase/migrations/20261020090000_m1_company.sql` (`tax_rates`, `qualifications`, `member_qualifications`, Rechte und Policies für `companies`, `company_members`, `subscriptions`, Views `company_profile` und `team_directory`, RPC `create_company()` mit Standarddaten). Für das Supabase-Dashboard: `supabase/remote-update-20261020090000.sql` im SQL Editor ausführen (nur diese Datei, nicht noch einmal `remote-setup.sql`). 74 pgTAP-Tests laufen lokal.
- **App:** SC-07 Willkommen, SC-08 Firma, SC-09 Branding, SC-10 Arbeitsweise, SC-11 Fertig; Tabs je Rolle (admin: Start, Kalender, Mehr · Küche: Heute, Kalender, Mehr · Service: Meine Schichten, Schichtbörse, Mehr); „Mehr“ zeigt Konto, Firma, Testphase (nur admin) und Abmelden. Start, Kalender, Heute, Meine Schichten und Schichtbörse sind Platzhalter bis M3, M7 und M8.
- **Geprüft:** Typecheck, Lint, 29 Jest-Tests, Web-Export; der Ablauf vom Willkommen bis zum Start-Tab (und die Tabs je Rolle) im Browser gegen eine simulierte Datenbank. Gegen das echte Supabase-Projekt erst nach dem SQL-Update.

### Etappe 2 (gebaut): Team und Einladungen

- **Datenbank:** `supabase/migrations/20261021090000_m1_team.sql` (`invitations`, Schutz des letzten Admins, RPCs `create_invitation`, `resend_invitation`, `revoke_invitation`, `invitation_preview`, `accept_invitation`, `set_member_role`, `set_member_qualifications`, `remove_member`, `leave_company`, `delete_my_account`; Planlimits für Mitglieder und Admins). Für das Dashboard: `supabase/remote-update-20261021090000.sql` im SQL Editor ausführen. 118 pgTAP-Tests laufen lokal.
- **App:** SC-06 Einladung annehmen (mit und ohne Sitzung, Token überlebt Registrierung und Bestätigungs-Mail), SC-54 Team (Mitglieder, Einladungen), SC-55 Einladen (Link teilen), SC-56 Mitglied (Rolle, Qualifikationen, Entfernen), SC-68 Profil (Name, Telefon, Firma verlassen, Konto löschen), Firmendaten (Name, Kontakt, Adresse, Steuernummern) aus „Mehr“.
- **Geprüft:** Typecheck, Lint, 33 Jest-Tests; im Browser gegen eine simulierte Datenbank: Team-Liste, Link erzeugen und erneuern, Einladung annehmen mit und ohne Sitzung. Gegen das echte Supabase erst nach dem SQL-Update.

### Etappe 3 (gebaut): Einstellungen

- **App:** SC-57 Einstellungen (Hub) mit SC-58 Firma (Stammdaten, Fußzeile, Datenschutz- und Impressum-Link), SC-59 Branding (Akzentfarbe), SC-60 Steuersätze (anlegen, ändern, deaktivieren, Standard je Positionstyp, „Von mir geprüft“), SC-61 Qualifikationen (anlegen, umbenennen, archivieren, Anzahl Mitglieder), SC-62 Fristen & Standardwerte (Absagefrist, Änderungsschluss Event-Catering und Business-Lunch, Angebotsgültigkeit, Aufschlag, Einkaufspuffer, Kalkulationsart, Preisraster, je Feld Beispiel) und Angebotstexte. Erreichbar über „Mehr“ → „Einstellungen“.
- **Datenbank:** keine neue Migration; die Rechte und Policies aus M1 genügen. Es gibt kein neues SQL für den SQL Editor.
- **Geprüft:** Typecheck, Lint, 40 Jest-Tests (u. a. Grenzen der Fristen-Eingaben, Prozent-Umrechnung); im Browser gegen eine simulierte Datenbank: Hub, Fristen speichern mit Fehlermeldung bei ungültigem Wert, Steuersatz anlegen, Qualifikationen, Branding, Firma, Angebotstexte.

### Noch offen aus M1

Logo-Upload (braucht Bildauswahl als natives Modul, also einen neuen Build), Mail-Versand der Einladung (eigener Mail-Dienst, E-3), Apple- und Google-Anmeldung, Fragenkatalog, Abo und Datenschutz & Export (kommen mit späteren Meilensteinen). „Prozentsatz bei Verwendung gesperrt“ (SC-60) greift erst, wenn Angebote Steuersätze nutzen (M4).

### Abweichungen M1

| # | Thema | Plan | Umsetzung | Grund |
|---|---|---|---|---|
| A-12 | SC-08 Land | Auswahl DE, AT, CH | **nur Deutschland wählbar**, AT und CH „bald verfügbar“ | `create_company()` lehnt andere Länder ab, bis Steuersätze und Rechtstexte dafür stehen |
| A-13 | SC-09 und SC-59 Logo | Logo-Upload im Branding | **nur Akzentfarbe** | Das Logo braucht Bildauswahl (natives Modul, neuer Build) und den Bucket `logos`; es folgt mit dem nächsten Build |
| A-14 | SC-10 Änderungsschluss | Event-Catering 72 h, Business-Lunch 24 h | **im Onboarding nur Event-Catering** (48/72/120 h); Business-Lunch bleibt bei 24 h und ist in SC-62 einstellbar | Business-Lunch gibt es erst ab M3 |
| A-15 | AVV | Zustimmung mit Link auf das Dokument | **Checkbox ohne Link** | Der Vertragstext liegt noch nicht vor (juristische Prüfung offen); bis dahin ist die Zustimmung nur formal |
| A-16 | Annehmen und Konto löschen | Edge Functions `accept-invitation` und `delete-account` (03 §4.8) | **RPCs `accept_invitation` und `delete_my_account`** | Beide brauchen nur Datenbankzugriff; so entfällt das Deployment von Functions, das ohne Terminal schwierig ist. Das Apple-Token beim Löschen wird mit der Apple-Anmeldung nachgerüstet |
| A-17 | Einladung per E-Mail | Mail an die eingeladene Person (US-05.1) | **nur „Link teilen“** | Der Standard-Mailversand von Supabase erreicht nur Teammitglieder des Projekts. Der Link geht per Nachricht raus; der Mail-Versand folgt mit dem eigenen SMTP-Dienst (E-3) |
| A-18 | Einladungslink | im Klartext abrufbar | **nur einmal sichtbar**, danach „Neuer Link“ | In der Datenbank liegt nur der SHA-256-Hash des Tokens |

## M2 · Gerichte, Zutaten, Pakete

### Etappe 1 (gebaut): Katalog

- **Datenbank:** `supabase/migrations/20261022090000_m2_catalog.sql` (`dishes`, `dish_allergens`, `ingredients`, `dish_ingredients`, `menu_packages`, `menu_package_dishes`; RPCs `save_dish`, `save_ingredient`, `save_menu_package`; preisfreie Views `kitchen_dishes`, `kitchen_ingredients`, `kitchen_menu_packages` mit abgeleiteten Paket-Allergenen und -Diätformen). Für das Dashboard: `supabase/remote-update-20261022090000.sql` im SQL Editor ausführen. 161 pgTAP-Tests laufen lokal, darunter: Küche liest die Basistabellen mit Preisen nicht, keine `kitchen_*`-View hat eine Spalte mit `price`, `cost` oder `markup`, Prüfstatus der Allergene fällt bei Änderung, Mandantentrennung, Lesemodus.
- **Rechenmodul:** `supabase/functions/_shared/domain/costing.ts` (Wareneinsatz je Portion und Paket, Preisvorschlag mit Aufrunden aufs Raster, Wareneinsatzquote) und `dietary.ts` (Paket-Allergene und -Diätformen, Vegan-Widerspruch), getestet mit dem Rechenbeispiel aus docs/02 §3.3 (Schmorbraten: 3,642 € Wareneinsatz, Faktor 3,2 → 11,70 €, Quote 31,1 %). Jest führt jetzt auch diese Domänentests aus (vorher wurden sie wegen `testPathIgnorePatterns` nie ausgeführt).
- **App (über „Mehr“ → „Katalog“, für admin und Küche):** SC-38 Gerichte mit Suche, Kategorie-, Diät-, „Ohne Allergen“-, „Ungeprüft“- und Archiv-Filter, Allergen-Codes, Prüfstatus und Preis (nur admin); SC-39 Gericht mit Allergen-Raster, Diätformen, Zutaten (Menge pro Person, neue Zutat inline), Wareneinsatz und Preisvorschlag live (nur admin); SC-40/SC-41 Pakete mit Portionsfaktor, Reihenfolge, abgeleiteten Allergenen und Rohertrag (nur admin); SC-42/SC-43 Zutaten mit Einkaufspreis (nur admin).
- **Geprüft:** Typecheck, Lint, 75 Jest-Tests (Filter „vegan“ und „ohne Gluten“, Wareneinsatz, Eingabeformate); im Browser gegen eine simulierte Datenbank als admin (Liste, Filter, Gericht mit Wareneinsatz 2,92 € und Vorschlag 9,40 €, Speichern, Pakete, Zutaten) und als Küche (keine Preise sichtbar).

### Noch offen aus M2

Einmal-Import der Excel-Liste des Gründers (braucht die Datei), Produktions-Supabase-Projekt und Deploy-Workflow, Spike PDF (`render-quote-pdf`), Appllama-Recherche Bereich B, Löschen von Gerichten ohne Verwendung (bis dahin nur Archivieren), Zutaten-Vorschlag per Ähnlichkeitssuche (aktuell Teilstring-Suche).

### Abweichungen M2

| # | Thema | Plan | Umsetzung | Grund |
|---|---|---|---|---|
| A-19 | Menge pro Person | `numeric(10,1)` (03 §3.4) | **`numeric(10,2)`** | Das Rechenbeispiel selbst nutzt 0,25 Stück Ei (02 §3.3); eine Nachkommastelle würde das auf 0,3 verfälschen. Zwischenwerte des Wareneinsatzes daher in 1/100000 Cent |
| A-20 | Schreibweg Katalog | admin schreibt direkt in die Tabellen, Küche über RPC (03 §4.3) | **alle schreiben nur über die RPCs** | Prüfstatus der Allergene, Preisfelder und Zutatenlisten werden so einheitlich und atomar behandelt; stärker abgesichert als geplant |
| A-21 | `menu_packages` | Küche liest Pakete über View, Gerichte des Pakets über `menu_package_dishes` | wie geplant, plus RPC `save_menu_package` (nur admin) | Pakete und ihre Gerichte werden atomar ersetzt |

## M3 · Kunden, Aufträge, Kalender

### Etappe 1 (gebaut): Datenbank

- `supabase/migrations/20261023090000_m3_events.sql` (`customers`, `events`, `event_schedule_items`, `event_dietary_requirements`, `event_status_changes`; `private.is_allowed_event_transition()`, RPCs `set_event_status`, `set_invoice_details`, `copy_event`, Funktion `can_read_event`, View `kitchen_events`). Für das Dashboard: `supabase/remote-update-20261023090000.sql` im SQL Editor ausführen. 304 pgTAP-Tests laufen lokal, darunter alle 64 Statuspaare, Direktbestätigung mit Bestätigungsweg, keine Rückwärts-Übergänge, Rollen (Küche ohne Kundendaten, Aushilfe ohne Zugriff), Mandantentrennung, Lesemodus, Kopieren über die Zeitumstellung (25.10.2026, 28.03.2027) und über Mitternacht.

### Etappe 2 (gebaut): Kunden und Aufträge in der App

- **Domäne und Zeitlogik:** `_shared/domain/event-status.ts` (dieselbe Übergangstabelle wie in der Datenbank; ein Test hält beide gleich), `src/lib/berlin.ts` (Eingaben und Anzeige in Ortszeit, `berlinToIso`, Termine über Mitternacht, „heute“ nach Berliner Zeit) mit Tests über beide Zeitumstellungen.
- **Kunden:** SC-35 Liste mit Suche ab 2 Zeichen, Filter und nächstem Auftrag; SC-36 Detail mit Aufträgen; SC-37 Formular mit Duplikatwarnung. Über „Mehr“ → „Kunden“.
- **Aufträge:** Tab „Aufträge“ (SC-15: Suche, Anstehend/Vergangen/Archiv, Art); SC-16/SC-29 Schnellerfassung und Bearbeiten (Kunde suchen oder inline anlegen, Datum und Uhrzeit in Ortszeit, Ende nach Mitternacht, Titelvorschlag, Warnung bei Vergangenheit und mehreren Aufträgen am selben Tag, „Änderungen bis“ aus der Firmeneinstellung); SC-18/SC-19 Detail mit Übersicht, Statushistorie und Zeitplan (SC-26 mit Standardablauf); SC-31 Bestätigungsdialog vor jedem Statuswechsel (Pflichtangaben, Folgen, „nicht rückgängig“, „Abbrechen“ als Standard); SC-30 Kopieren (mehrere Termine, Startstatus Anfrage oder Bestätigt).
- **Geprüft:** Typecheck, Lint, 102 Jest-Tests; im Browser gegen eine simulierte Datenbank als admin (Liste, Detail, Dialog, Abbrechen ändert nichts, Direktbestätigung verlangt den Bestätigungsweg, Standardablauf, Kopieren, Anlegen über Mitternacht) und als Küche (keine Kunden, keine internen Notizen, keine Statusaktionen).

### Etappe 3 (gebaut): Kalender, Start, Küche

- **SC-14 Kalender:** Monatsraster mit Statuspunkten (vorläufige Termine blasser), Tagesliste mit „Fortsetzung“ für Aufträge über Mitternacht, Listenansicht, Filter nach Art; abgelehnte und abgesagte Aufträge sind ausgeblendet. Zuordnung nach Berliner Ortszeit, getestet.
- **SC-12 Start (admin):** Testphasen-Hinweis, Erste Schritte (Team, Gericht, Anfrage), „Heute und morgen“, „Zu erledigen“ (Anfragen länger als 24 h, Optionen mit Ablauf in höchstens 3 Tagen, „als durchgeführt markieren“ mit Sammelaktion über einen Bestätigungsdialog mit Liste).
- **SC-13 Heute (Küche):** Umschalter Heute/Morgen, Karten mit Gästen, Abfahrt und Ausgabe, Anzahl Sonderessen und Hinweisen; vorläufige Aufträge gekennzeichnet; keine Preise.
- **SC-25/SC-27 Tab Küche im Auftrag:** Hinweise und Sonderessen (Anzahl, Diätform, zu meidende Allergene, Gast und Tisch mit Datenschutzhinweis, Notiz, Quelle); die Datenbank prüft Summe ≤ Gästezahl und markiert Kurzfristiges.
- **Geprüft:** Typecheck, Lint, 114 Jest-Tests (Monatsraster, Aufträge pro Tag über Mitternacht, Zu-erledigen-Regeln); im Browser gegen eine simulierte Datenbank (Start, Kalender, Küche, Tab Küche).

### Noch offen aus M3

persistenter Abfrage-Cache mit „Offline – Stand: …“ (braucht ein natives Speichermodul und damit einen neuen Build, zusammen mit Logo-Upload), Ersatzgerichte bei Sonderessen, Produktionsliste im Tab Küche (kommt mit den Angeboten, M4/M5), Musterwahl aus Appllama Bereich B, Aufträge des Pilotbetriebs übertragen (Excel).

### Abweichungen M3

| # | Thema | Plan | Umsetzung | Grund |
|---|---|---|---|---|
| A-22 | `set_event_status()` | vier Parameter (03 §4.7) | **sieben Parameter** (zusätzlich „optioniert bis“ und Rechnungsdaten) | „Termin vormerken“ und „abgerechnet“ brauchen ihre Pflichtangaben im selben Aufruf; `quoted` setzt erst der Angebotsversand (M5) |
| A-23 | Endzustände schreibgeschützt | Aufträge nach `declined`/`cancelled` bleiben bearbeitbar | **nicht mehr änderbar** (RLS-Policy), nur `invoiced` behält Rechnungsdaten über `set_invoice_details()` | Passt zu „neuer Anlauf nur per Kopie“ (R2-4) |
| A-24 | Uhrzeit-Eingabe | Datums-/Zeitwähler | **Textfelder** (TT.MM.JJJJ, HH:MM) | Native Wähler brauchen ein natives Modul und damit einen neuen Build; die Eingaben werden geprüft und in Berliner Ortszeit umgerechnet |

## M4 (vorgezogen) · Angebots-Chat und eigener Fragenkatalog

Auf Wunsch des Gründers vor dem Angebots-Editor gebaut: Anfragen werden in einem geführten Chat mit selbst festgelegten Fragen erfasst (docs/02 §11, SC-17, SC-64, SC-65).

- **Datenbank:** `supabase/migrations/20261024090000_m4_intake.sql` (`intake_questions` mit Standardkatalog von 16 Fragen, für bestehende und neue Firmen; RPCs `create_event_from_intake` (Kunde, Anfrage, Sonderessen, Notizen und Antworten in einer Transaktion, auch als Ergänzung einer bestehenden Anfrage) und `reset_intake_questions`). Für das Dashboard: `supabase/remote-update-20261024090000.sql` im SQL Editor ausführen. 331 pgTAP-Tests laufen lokal.
- **Domäne:** `_shared/domain/intake.ts` (sichtbare Fragen mit Bedingungen `equals`, `in`, `not_equals`, `gt`, `lt`, `is_true`; verwerfen von Antworten bei geänderten Bedingungen; Zuordnung der Antworten zu den Auftragsfeldern; Prüfung des Katalogs: passende Zuordnung, Optionen, Bedingung nur auf frühere Fragen) mit 18 Tests.
- **App:** SC-17 Chat (Fragen links, Antworten rechts und antippbar zum Ändern, Fortschritt, Überspringen nur bei optionalen Fragen, alle zehn Antworttypen, Zusammenfassung mit Titelvorschlag, Verwerfen mit Rückfrage, Start mit vorgewähltem Kunden oder aus einer bestehenden Anfrage, Testlauf); SC-64/65 Fragenkatalog unter Einstellungen (Fragen anlegen, bearbeiten, sortieren, archivieren, Bedingungen, Zuordnung, Standard wiederherstellen). Einstiege: Tab „Aufträge“, Start und Kundendetail.
- **Geprüft:** Typecheck, Lint, 132 Jest-Tests; im Browser mit Handy-Profil gegen eine simulierte Datenbank: kompletter Chat bis zur Anfrage, Fragenkatalog bearbeiten.

### Noch offen

Angebotsentwurf am Ende des Chats (kommt mit dem Angebots-Editor, M4/M5; bis dahin steht „Ihre Referenz“ in den internen Notizen), „Auftrag anlegen und Angebot öffnen“, Antworten bleiben nur im Speicher der App (bei App-Neustart verloren).

## M4 · Angebots-Editor (Entwurf)

Angebote entstehen als Entwurf je Auftrag (docs/02 §3, SC-32/33). Versand, Schnappschuss, PDF und Portal folgen mit M5.

- **Datenbank:** `supabase/migrations/20261025090000_m4_quotes.sql` (`quotes` mit Nummer `A-JJJJ-NNNN`, `quote_items` mit Prüfregeln, RPCs `ensure_quote` und `save_quote`; `save_quote` ersetzt alle Positionen in einer Transaktion). Für das Dashboard: `supabase/remote-update-20261025090000.sql` ausführen. 356 pgTAP-Tests laufen lokal.
- **Domäne:** `_shared/domain/calc.ts` (Rechenseite = Anzeigemodus, USt je Satz auf die Summe, Rundung nach Largest-Remainder, keine negativen Preise, Rabatt nur über Felder; Beispiel 3.261,69 € getestet).
- **App:** Editor mit Positionen (Paket, Gericht, Personal, Freitext, Überschrift), Gesamtrabatt, Netto/Brutto-Anzeige, Summenblock mit USt je Satz, Warnungen, Autosave (1,5 s Verzögerung) und Referenzfeld. Einstieg über die Schaltfläche „Angebot“ im Auftrag.
- **Geprüft:** Typecheck, Lint, 160 Jest-Tests; im Browser mit Handy-Profil gegen eine simulierte Datenbank: Paket und Personal hinzufügen, 5 % Rabatt, Summen und Speicher-Payload stimmen.

### Ergänzt: Positionsvorlagen und Kopie

- **SC-63:** Unter Einstellungen → Angebotstexte lassen sich Positionsvorlagen (Servicekraft mit Stunden, Anfahrt, Getränkepauschale …) anlegen, ändern und löschen (`companies.quote_item_templates`, keine Migration nötig). Im Editor erscheinen sie in „Position hinzufügen“ mit einem Tipp.
- **Kopie:** `supabase/migrations/20261026090000_m4_copy_quote.sql` ersetzt `copy_event()`: Das Angebot wird als neuer Entwurf mitkopiert (Revision 0, neue Nummer, Gültigkeit ab heute, ohne Kundenreferenz). Für das Dashboard: `supabase/remote-update-20261026090000.sql`. 365 pgTAP-Tests laufen lokal, auch mit dem Gesamtbundle.

### Noch offen

Kundenportal (M6, Seite hinter dem Link), Annahme/Ablehnung durch den Kunden, verbindlicher Stand für die Küche.

## M5 · Versand, Revisionen, PDF (ohne E-Mail-Dienst)

- **Datenbank:** `supabase/migrations/20261027090000_m5_send.sql` (Spalten `snapshot`, `snapshot_hash`, `sent_*` an `quotes`; Tabellen `quote_revisions` und `portal_tokens` (nur Hash); RPCs `send_quote`, `issue_portal_token`, `revoke_portal_tokens`, `discard_quote_changes`). `send_quote` prüft den Snapshot (Schema, Revision, Positions-IDs, Summen), berechnet den Hash, legt Revision und Link an und setzt `inquiry` → `quoted` in einer Transaktion; Endzustände und `completed` sind gesperrt, bei `confirmed` ist die Versandart Pflicht. Für das Dashboard: `supabase/remote-update-20261027090000.sql`. 396 pgTAP-Tests laufen lokal, auch mit dem Gesamtbundle.
- **App:** SC-34 (`/events/[id]/quote-send`): Prüfliste (blockierend: leer, Gästezahl, Steuersatz, Rabatt, Wahlgruppen, Endzustand, E-Mail beim Versandweg E-Mail; Hinweise: Gültigkeit, ungeprüfte Allergene und Steuersätze), Vorschau mit Summen, Versandart bei `confirmed`, Bestätigungsdialog, Ergebnis mit Link, E-Mail-Entwurf (mailto) und PDF. Fassungen mit PDF, neuer Link, „Änderungen verwerfen“. Der Editor führt über „Weiter zum Versand“ (speichert vorher).
- **PDF:** `renderQuoteHtml` (Logo-frei, Akzentfarbe, Allergen-Codes mit Legende, Summenblock, Seitenumbruch ohne Zeilenbruch) → native `expo-print` + `expo-sharing`, im Web Druckdialog („Als PDF speichern“).
- **Geprüft:** Typecheck, Lint, 172 Jest-Tests; im Browser mit Handy-Profil gegen eine simulierte Datenbank: Prüfliste, Vorschau, Versand (Nutzlast mit Snapshot ohne Kalkulationsdaten), Ergebnisseite.

### Abweichungen M5

| Nr. | Thema | Plan | Umsetzung | Grund |
|---|---|---|---|---|
| A-25 | Versandweg | Edge Functions `render-quote-pdf`/`send-email`, `prepare/commit_quote_send` nur für `service_role` | RPC `send_quote` für Admins, Snapshot aus der App (Datenbank prüft Konsistenz und rechnet den Hash); PDF auf dem Gerät aus dem Snapshot; E-Mail über die E-Mail-App des Nutzers (mailto) mit Portal-Link | Es gibt weder SMTP (E-3) noch ein Edge-Function-Deployment; der Gründer kann nur SQL einspielen. Der Versand bleibt eine Transaktion, Revisionen bleiben abrufbar (`quote_revisions` statt PDF-Dateien) |
| A-26 | Zustellstatus | `email_status` mit Bounces | entfällt, solange kein Dienst sendet | siehe A-25 |
| A-27 | Portal-Links | ein neuer Link je Versand | frühere Links bleiben gültig (zeigen immer die aktuelle Fassung); neue Links über „Neuen Link erzeugen“, sperren über `revoke_portal_tokens` | einfacher für den Kunden |

### Noch offen

Portal-Seite hinter dem Link (M6), `binding_snapshot` und Annahme durch den Kunden (M6), Sperren der Links in der App, echter E-Mail-Versand mit PDF-Anhang (E-3), Allergen-Anzeige live im Portal.

## M6 (Kern) · Kundenportal

- **Datenbank:** `supabase/migrations/20261028090000_m6_portal.sql` (Spalten für Aufruf, Annahme, Ablehnung und Änderungswunsch an `quotes`; RPCs `portal_get`, `portal_accept_quote`, `portal_decline_quote`, `portal_request_change` für `anon` und `authenticated`, `resolve_pending_change` für Admins). Annahme: `quoted`/`optioned` → `confirmed` (Historie mit `actor_kind = 'portal'`); Ablehnung: `quoted` → `declined`, `optioned` → `cancelled`, beides endgültig; Annahme der neuen Fassung bei bestätigtem Auftrag mit „Bitte bestätigen“. Änderungsschluss nach R2-6 (72 h/24 h oder `changes_until`). Für das Dashboard: `supabase/remote-update-20261028090000.sql`. 429 pgTAP-Tests laufen lokal, auch mit dem Gesamtbundle.
- **App:** `/portal/[token]` (Siezen, ab 360 px): Auftragsdaten, Positionen mit Allergen-Codes und Legende, Summen, Anzahlung, Konditionen, PDF, Annehmen (Name, Haken, Kommentar), Ablehnen (Grund optional), Änderungswunsch (Name, Gästezahl, Nachricht), Zustände „Link ungültig“, „Link nicht mehr gültig“, abgelaufen, abgeschlossen, neue Fassung. Im Auftrag zeigt die Team-App, ob der Kunde angesehen, angenommen, abgelehnt oder eine Änderung gewünscht hat, und lässt den Wunsch als erledigt markieren.
- **Geprüft:** Typecheck, Lint, Jest, pgTAP (u. a. unbekannter/gesperrter Token, veraltete Fassung, doppelte Annahme, Änderungsschluss, keine internen Felder in der Antwort); im Browser mit Handy-Profil gegen eine simulierte Datenbank: Link ungültig, Ansicht, Annahme.

### Abweichungen M6

| Nr. | Thema | Plan | Umsetzung | Grund |
|---|---|---|---|---|
| A-28 | Portal-API | Edge Function `portal-api` mit Rate-Limit | RPCs für `anon`, der Token (244 Bit, nur als Hash gespeichert) ist das Geheimnis; feste Feldauswahl | kein Edge-Function-Deployment möglich (siehe A-25) |
| A-29 | Wahlgruppen und Sonderessen im Portal | Auswahlkarten, `portal_select_choice`, `portal_save_dietary` | Wahlgruppen gebaut (Summen im Portal per TS-Modul); Sonderessen gebaut; Änderungswunsch als Nachricht (Gästezahl, Text) | Sonderessen brauchen weitere Tabellenzugriffe, kommt als nächster Schritt |
| A-30 | Allergene | live aus dem Katalog | aus dem Snapshot der versendeten Fassung | einfacher; bei Allergenänderungen nach dem Versand neue Fassung senden |
| A-31 | Benachrichtigungen | Tabelle `notifications`, E-Mail an den Admin | Anzeige im Auftrag (Aufruf, Annahme, Ablehnung, Wunsch) | kein E-Mail-Dienst (E-3); Liste folgt mit M7 |

### Ergänzt: Menüwahl im Portal (Wahlgruppen)

- `supabase/migrations/20261031090000_m6_choices.sql` (`remote-update-20261031090000.sql`): `portal_select_choice`, Wahl in `quotes.portal_selection`, im Annahmeprotokoll und in `kitchen_event_lines`; `apply_portal_selection` übernimmt sie in den Entwurf; jede neue Fassung setzt sie zurück. 485 pgTAP-Tests laufen lokal.
- Portal: Alternativen einer Wahlgruppe sind Auswahlkarten (vor der Annahme), die Summen rechnet `applySelection` mit dem gemeinsamen Rechenmodul neu. Team-App: Hinweis „Kunde hat gewählt“ mit „Wahl ins Angebot übernehmen“. Der Snapshot enthält jetzt auch die Preise nicht gewählter Alternativen.

### Ergänzt: Sonderessen im Portal

- `supabase/migrations/20261102090000_m6_dietary.sql` (`remote-update-20261102090000.sql`): `portal_save_dietary`, `portal_delete_dietary` (nur eigene Einträge des Kunden, `source = 'customer'`, bis zum Änderungsschluss; Summe höchstens Gästezahl), `portal_get` liefert die eigenen Einträge. 504 pgTAP-Tests laufen lokal.
- Portal: Karte „Sonderessen und Allergien“ (Anzahl, Diätform, Allergene, Gast, Tisch, Hinweis). Im Auftrag stehen die Einträge unter „Küche“ und in der Küchenplanung.

### Noch offen

 Benachrichtigungsliste und Start-Karten „offene Änderungswünsche“, Jobs (Option-Erinnerung, Angebotsablauf), Annahme-PDF.

## M8 (Kern) · Küchenplanung

- **Datenbank:** `supabase/migrations/20261029090000_m8_kitchen_lines.sql`: `kitchen_events` nimmt Gästezahl und Kennzeichen „Änderung offen“ aus dem verbindlichen Stand (Entwurfszahl daneben); neue View `kitchen_event_lines` (Gerichte und Pakete je Auftrag aus der verbindlichen Fassung, ohne Preise, Live-Stand bei Revision 0). Für das Dashboard: `supabase/remote-update-20261029090000.sql`. 442 pgTAP-Tests laufen lokal, auch mit dem Gesamtbundle.
- **Domäne:** `_shared/domain/kitchen.ts`: Produktionsliste (Pakete mit Portionsfaktor, Einzelgerichte, Ersatzgerichte der Sonderessen), Einkaufsliste mit Puffer (ganzzahlig mit BigInt, Anzeige in g/kg, ml/l, Stück nach 02 §8.3, aufgerundet) und Prüfung Sonderessen gegen Gerichte. Das Rechenbeispiel 02 §8.5 (83/60/32 Portionen; 15,7 kg Rinderschulter …) ist als Test hinterlegt.
- **App:** `/kitchen` (Tab „Mehr“ → Küchenplanung, für admin und Küche): Zeitraum (von–bis, Standard 7 Tage), Optionen zuschaltbar, Tabs Produktion (je Tag, je Auftrag aufgeschlüsselt, Allergen-Codes, „vorläufig“, Aufträge ohne Positionen), Sonderessen (Konflikte rot, Ersatzgericht, „Küche entscheidet“), Einkauf (Puffer änderbar, nach Warengruppe, Abhaken lokal, Liste teilen).
- **Geprüft:** Typecheck, Lint, Jest, pgTAP; im Browser mit Handy-Profil gegen eine simulierte Datenbank: Rechenbeispiel aus 02 §8.5 Zahl für Zahl.
- **Ersatzgerichte:** Im Formular der Sonderessen (Tab Küche im Auftrag) lässt sich „Gericht B statt Gericht A“ wählen (A aus dem Angebot des Auftrags, B aus dem Katalog); Produktion und Konfliktprüfung werten es aus.

### Abweichungen M8

| Nr. | Thema | Plan | Umsetzung | Grund |
|---|---|---|---|---|
| A-32 | Verbindlicher Stand | Spalte `binding_snapshot` | aus den Revisionen abgeleitet: zuletzt angenommene Fassung, bei „Zur Info“ an einen bestätigten Auftrag die neueste, sonst die neueste (vorläufig), ohne Angebot der Live-Stand | keine doppelte Speicherung; gleiche Wirkung |
| A-33 | Menüwahl | `portal_selection` fließt ein | entfällt, solange es im Portal keine Wahlgruppen gibt (A-29) | siehe A-29 |

### Noch offen

Push an die Küche, Offline-Speicher, Druckansicht, `log_usage_event` (K-10), Einkaufsliste als CSV.

## M7 (Kern) · Schichtbörse

- **Datenbank:** `supabase/migrations/20261030090000_m7_shifts.sql`: `shift_slots`, `shift_applications` mit Überbuchungsschutz (Trigger `track_slot_occupancy`), `can_read_event()` mit staff-Zweig, Views `shift_board`, `my_shifts`, `event_staffing`, `event_colleagues`, RPCs `save_slot`, `publish_slots`, `cancel_slot`, `apply_for_slot`, `decide_application`, `cancel_my_application`, `assign_member`, `record_late_cancellation`. Eine Qualifikation je Schicht ist Pflicht (R2-9), die Absagefrist gilt immer ab der aktuellen Schichtzeit (R2-10). Für das Dashboard: `supabase/remote-update-20261030090000.sql`. 472 pgTAP-Tests laufen lokal, auch mit dem Gesamtbundle (u. a. Qualifikation, Zusage, volle Schicht, Überbuchung, Frist, Adresse erst nach der Zusage).
- **App:** Admin: Tab „Personal“ im Auftrag (Schichten anlegen und ändern, veröffentlichen, Bewerbungen zu- und absagen, Person einplanen (ohne Qualifikation nur nach Bestätigungsdialog), späte Absage eintragen, Schicht absagen). Aushilfen: „Schichtbörse“ (nur passende offene Schichten, Bewerben) und „Meine Schichten“ (Status, Einsatzinfos erst nach der Zusage, Absagen bis zur Frist, danach Hinweis mit Anrufknopf).
- **Geprüft:** Typecheck, Lint, pgTAP; im Browser mit Handy-Profil gegen eine simulierte Datenbank (Personal-Tab, Schichtbörse, Meine Einsätze).

### Abweichungen M7

| Nr. | Thema | Plan | Umsetzung | Grund |
|---|---|---|---|---|
| A-34 | Push und Benachrichtigungen | `notifications`, `push-dispatch`, Push bei Zusage und Zeitänderung | entfällt vorerst; Zu- und Absagen stehen in „Meine Einsätze“, Bewerbungen im Tab „Personal“ | Push braucht ein natives Build und Edge Functions |
| A-35 | `assign_member` | `INSERT … ON CONFLICT` | getrennt in SELECT, UPDATE oder INSERT | Bei `ON CONFLICT` zählt der BEFORE-INSERT-Trigger den Platz schon vor der Konflikterkennung, der UPDATE-Pfad ein zweites Mal (falsches `slot_full`); die Variante in docs/03 ist damit fehlerhaft und wird dort nachgezogen |
| A-36 | Warteliste | dritte Bewerbung auf der Warteliste | Bewerbungen auf volle Schichten werden abgelehnt (`slot_full`); wer sich vorher beworben hat, bleibt „Beworben“ | einfacher; Warteliste kann folgen |

### Noch offen

Zeitänderungen melden (kommt mit Push), Start-Karten „unbesetzte Schichten“ und „offene Bewerbungen“, Offline-Vorladen der Einsätze, Nebenläufigkeitstest mit zwei Sitzungen, Monatsübersicht der Stunden, Schichten für die Küche (Rolle `kitchen` bewirbt sich über die Funktionen, hat aber noch keinen eigenen Tab).

## Ergänzung · Firmenlogo

- `supabase/migrations/20261101090000_m1_logos.sql` (`remote-update-20261101090000.sql`): öffentlicher Bucket `logos` (2 MB, PNG/JPEG), Upload und Löschen nur Admin der Firma im Schreibmodus, Ordner = `company_id`. 492 pgTAP-Tests laufen lokal (die Testumgebung bildet `storage` minimal nach, `scripts/db/stubs.sql`).
- App: Einstellungen → Branding → „Logo wählen“ (`expo-image-picker`, neuer Dateiname je Upload, alte Dateien bleiben für bereits versendete Angebote); das Logo steht im Angebots-PDF und im Kundenportal. Nur Pfade der Form `{company_id}/logo-{uuid}.{png|jpg}` werden eingebunden.
- Neues natives Modul (`expo-image-picker`): In Expo Go und im Web läuft es; für einen Store-Build braucht es einen neuen EAS-Build.

## Ergänzung · Datenbank-Stand und Korrektur

- Einstellungen → **Datenbank-Stand**: zeigt je SQL-Update, ob es eingespielt ist (Probe auf Tabelle, Spalte oder Funktion), und nennt die fehlenden Dateien. So muss niemand raten, welche Datei noch fehlt.
- Korrektur: Der **Fragenkatalog** (Einstellungen → Fragenkatalog) war nur per Adresse erreichbar und stand nicht in der Einstellungsliste; er steht jetzt dort.

## Korrekturen aus dem Sicherheits-Review (M5–M8)

Eine unabhängige Prüfung der neuen SQL-Dateien fand 11 Punkte; alle sind in `supabase/migrations/20261103090000_review_fixes.sql` (`remote-update-20261103090000.sql`) behoben und mit Tests abgedeckt (516 pgTAP-Tests):

1. Sonderessen schreiben nur noch admin und Küche (vorher konnte auch Personal mit zugesagter Schicht schreiben).
2. Die Annahme speichert die Summe der angenommenen Fassung, nicht die des laufenden Entwurfs.
3. Die Küche behält die angenommene Menüwahl (`acceptance_selection`).
4. Die verbindliche Fassung steht als Spalte (`binding_revision`) am Angebot, nicht mehr abgeleitet vom aktuellen Auftragsstatus; „Zur Info“ ist nur bei bestätigten Aufträgen möglich.
5. `events.portal_locked` wirkt im Portal; Sonderessen löschen nur bei offenem Auftrag.
6. Portal-Links laufen nach Eventende plus `portal_token_ttl_days` (60) ab.
7. Eine fehlende Fassung umgeht die Prüfung „Angebot aktualisiert“ nicht mehr.
8. Eine späte Absage lässt sich nicht durch erneutes Bewerben löschen.
9. Alte Logo-Dateien werden nicht mehr gelöscht (versendete Angebote verweisen darauf).
10. Sonderessen-Summe: Auftrag wird gesperrt, damit zwei gleichzeitige Eingaben die Gästezahl nicht überschreiten.
11. „Kein Änderungsschluss“ (leeres `changes_until`) bleibt ohne Frist; neue Aufträge bekommen die Vorbelegung aus den Firmeneinstellungen (72 h bzw. 24 h), bestehende werden nachgetragen.

Bewusst nicht geändert: Die Gültigkeit („gültig bis“) gilt weiter live, damit „Gültigkeit verlängern“ ohne neue Fassung wirkt (docs/03).

## Ergänzung · Annahme durch das Team

`supabase/migrations/20261104090000_admin_acceptance.sql` (`remote-update-20261104090000.sql`): Wird ein Auftrag aus „Angebot versendet“ oder „Optioniert“ auf „Bestätigt“ gesetzt (Telefon, E-Mail, persönlich), wird die versendete Fassung verbindlich und angenommen (Annahmeprotokoll mit Bestätigungsweg). Vorher blieb die Küche in diesem Fall bei „vorläufig“. 521 pgTAP-Tests.

## Ergänzung · Kalender-Abo (iCal)

- `supabase/migrations/20261105090000_ical.sql` (`remote-update-20261105090000.sql`): `calendar_tokens`, `get_ical_token()` (anzeigen/zurücksetzen), `ical_feed(token)` (anon). Admin und Küche sehen optionierte und bestätigte Aufträge ohne Kundendaten, Personal die eigenen zugesagten Schichten. 530 pgTAP-Tests.
- `api/ical.ts` (Vercel-Funktion, `/api/ical?token=…`) baut mit `_shared/domain/ical.ts` (RFC 5545: UTC, Escape, Faltung) die Datei. Profil → Kalender-Abo zeigt den Link mit „Abonnieren“, „Kopieren“, „Zurücksetzen“.
- Abweichung A-37: Vercel-Funktion statt Edge Function (kein Supabase-Function-Deployment möglich); der Token liegt im Klartext in `calendar_tokens` (nur das Mitglied selbst liest ihn), damit sich der Link wieder anzeigen lässt.
- Nicht getestet gegen die echte Vercel-Umgebung; Handler und Kalenderdatei sind per Unit-Test geprüft.

## Mobil-Prüfung (iPhone und iPad-Browser)

Automatische Prüfung `scripts/smoke/mobile-audit.mjs` (Chromium mit iPhone-Profil SE/13/15 Pro Max, simulierte Datenbank, 60 Seiten in drei Rollen): kein waagerechter Überlauf, alle Tippflächen ≥ 44 px, alle Eingabefelder ≥ 16 px (sonst vergrößert iOS die Seite), keine Skriptfehler. Echte iPhones oder ein iOS-Simulator standen nicht zur Verfügung (kein WebKit); der Safari-Test steht aus.

Gefunden und behoben: kein `viewport-fit=cover` (sichere Bereiche, neues `src/app/+html.tsx`); Chips, Kalender-Pfeile und Textlinks zu klein; Tastenzeile im Paketformular lief auf dem SE über; Auswahlblätter ohne Abstand zur Home-Anzeige; **Schichtbörse und Meine Schichten waren für die Küche nicht erreichbar** (versteckte Tabs leiten um, jetzt eigene Seiten unter Mehr); neuer Link wurde automatisch in die Zwischenablage kopiert (iOS erlaubt das nur direkt nach einer Berührung, jetzt Tipp auf „Link kopieren“). iOS-Konfiguration geprüft per `expo prebuild` (Fotos-Hinweistext, `ITSAppUsesNonExemptEncryption`, Sprache Deutsch); iOS- und Android-Bundle (Hermes) bauen fehlerfrei, `expo-doctor` meldet nichts.

Bekannte iOS-Eigenheiten der Web-App: Safari löscht Daten von Websites nach 7 Tagen ohne Nutzung (erneut anmelden); „E-Mail vorbereiten“ und PDF öffnen sich in Safari über Tipp auf die Schaltfläche (Pop-up-Regeln).

## Ergänzung · Kundenimport aus Excel

Kunden → „Aus Excel importieren“: Zellen aus Excel kopieren und einfügen (Tabulator, Semikolon oder Komma; Überschriften wie Firma, Ansprechpartner, E-Mail, Telefon, Straße, PLZ, Ort werden erkannt, sonst feste Reihenfolge). Vorschau mit Zählung, Hinweise für Zeilen ohne Name und Duplikate (im Bestand und in der Tabelle), dann ein Klick. Keine Migration nötig. Für Aufträge und Gerichte gibt es noch keinen Import (dafür fehlt die Excel-Datei des Pilotbetriebs).

Außerdem ein neuer Test `m9_app_writes` (alle direkten Schreibzugriffe der App gegen Spaltenrechte und Richtlinien) und eine einmalige Prüfung aller Leseabfragen (`select`) der App gegen das echte Schema in allen drei Rollen: keine falschen Spaltennamen; alle Funktionsaufrufe (`rpc`) stimmen in den Parameternamen.

## Nicht in M0 gebaut (bewusst)

| Punkt | Warum | Wann |
|---|---|---|
| Deploy nach staging (Migrationen, Functions, EAS Update, Web-Hosting) | braucht Supabase-Projekt, Expo-Konto, Hosting (E-12) | sobald die Konten stehen |
| `expo-updates`, EAS-Projekt-ID, Build-Läufe | braucht Expo-Konto | M0 oder M1, nach Kontoanlage |
| Apple- und Google-Anmeldung | siehe A-9 | M1, Etappe 2 |
| Bundle-ID | Platzhalter `com.example.cateringapp` in `app.config.ts` | vor dem ersten Store-Build, mit dem App-Namen (E-2) |
| Icon und Splash | Platzhalter-Dateien des Templates | mit Name und Marke (E-4) |
| Sentry, Maestro-E2E | in 05 §10 für später vorgesehen | M10 |

## Design-Überarbeitung

Komplette Überarbeitung der Oberfläche nach Appllama-Recherche, siehe [09-designsystem.md](09-designsystem.md): warmer Hintergrund mit weißen, weich beschatteten Karten, Plus Jakarta Sans für Überschriften, Pillen-Schaltflächen mit Verlauf, Federeffekt und Haptik, schlanke schwebende Tab-Leiste (58 px, nach Rückmeldung verkleinert), Segment-Reiter, Symbol-Plaketten, leere Zustände, Marken-Plakette auf Anmeldeseiten. Keine Datenbankänderung. Neue Pakete: `expo-linear-gradient`, `expo-haptics`, `@expo-google-fonts/plus-jakarta-sans`.

Danach: neue Startseite für Admin (Begrüßung, Wochenleiste, Hero-Karte, Kennzahlen), Umsatzkarte mit neuer Funktion `revenue_overview()` (Migration `20261106090000`, `remote-update-20261106090000.sql`, 560 pgTAP-Tests, 225 Jest-Tests) und neu gestaltete Startseiten für Küche und Personal, siehe [09-designsystem.md](09-designsystem.md). Abweichung A-38: Die Monatssumme stammt aus dem gesendeten Angebotsstand und berücksichtigt spätere Auswahl-Änderungen des Kunden im Portal nicht.

## UX-Überarbeitung, zweite Runde (18.10.2026)

Ziel: übersichtlicher, Aktionen in Daumenreichweite, moderne Übergänge. Details und Bewegungsregeln in `docs/09-designsystem.md` (Abschnitt „UX-Überarbeitung“).

- Neuer Seitenrahmen: kompakte Kopfleiste mit rundem Zurück, Aktionen und „⋯“-Menü, einklappender Titel, feste Aktionsleiste unten, Ziehen zum Aktualisieren.
- Schnellanlage über das „+“ in der Tab-Leiste (Admin); große „Anlegen“-Knöpfe auf Listen sind dem „+“ oben rechts gewichen, Excel-Import und Archivieren liegen im Menü.
- Auftragsdetail: Bearbeiten oben, nächster Status unten fest, Absagen/Stornieren/Löschen nur noch rot im Menü. Statuswechsel und Sammelaktion als Blatt von unten.
- Einstellungen, „Mehr“ und Kundendetail als gruppierte Listen; Gerichte mit einzeiliger Kategorie-Leiste und Filterblatt.
- Bewegung: gestaffeltes Einblenden, hochzählende Kennzahlen, wachsende Umsatzbalken, gleitende Tab-/Segment-Markierung, Toasts statt „Gespeichert“-Banner, Platzhalter statt „Lädt …“, Haptik auf dem Gerät. Anlegen-Seiten fahren von unten herein.
- Die Startseite verzichtet auf die zwei Schnellaktions-Knöpfe (jetzt im „+“).
- Prüfung: Typecheck, Lint, 233 Jest-Tests (neu: Aktionsmenü), Mobil-Prüfung in drei iPhone-Größen ohne Befund, iOS-Bundle baut. Auf einem echten iPhone noch nicht getestet (Haptik, Wischgesten, Übergänge).

## Auftragsreiter übersichtlicher, Schichten ohne Entwurf (18.10.2026)

- **Abweichung A-39 (US-42):** Eine neue Schicht ist kein Entwurf mehr. Ist der Auftrag optioniert oder bestätigt, wird sie beim Speichern sofort veröffentlicht. Vorher angelegte Schichten gehen automatisch in die Börse, sobald der Auftrag über den Statuswechsel optioniert oder bestätigt wird. Ältere Entwürfe zeigt der Reiter mit „Jetzt veröffentlichen“. Umgesetzt in der App (`useSaveSlot` mit `publish`, `usePublishEventDrafts`), ohne Datenbankänderung; die Regel „veröffentlichen erst ab optioniert“ prüft weiterhin `publish_slots()`.
- **Reiter „Personal“:** Besetzungsübersicht (Fortschritt, Zähler Besetzt / Bewerbungen / Frei), Schichtkarten mit Datumskachel, Status („In der Schichtbörse“, „Ab Vormerkung in der Börse“), Plätzen als Kreise (besetzt mit Initialen → Ausplanen oder späte Absage; frei gestrichelt → Person einplanen), offenen Bewerbungen mit ✕/✓ und „⋯“ je Schicht (Bearbeiten, Einplanen, Absagen). Frühere Bewerbungen sind eingeklappt. Das Formular ist ein Blatt mit +/− für die Plätze; Treffpunkt, Dresscode und Hinweis liegen unter „Details“. Offene Bewerbungen stehen als Zahl am Reiter.
- **Zeitplan:** Zeitleiste mit Uhrzeit, farbigem Symbol je Art (Abfahrt, Anlieferung, Aufbau, Ausgabe, Abbau) und Notiz; Formular als Blatt.
- **Küche:** Hinweise der Küche als gelbe Notiz, Sonderessen mit Zähler und Anteil an den Gästen, Einträge mit Anzahl-Kachel, Allergenen und „kurzfristig“; Formular als Blatt mit +/− für die Personen.
- Vorbilder aus Appllama: Partiful (Zähler-Kreise, Werkzeugleiste, Aktionsblatt), Supershift (Schichtliste mit „Schicht hinzufügen“), TimeTree (Ablauf). Neue Bausteine: `Stepper`, `IconButton` mit `tone`, `SegmentedTabs` mit `badge`. Logik in `src/features/shifts/staffing.ts` (getestet).

## Mitteilungen in der App (18.10.2026)

- **Abweichung A-40 (docs/01 §3.6, docs/02 §9):** Statt Push und E-Mail (braucht ein natives Build bzw. einen Mail-Dienst, A-34/E-3) gibt es Mitteilungen in der App: Glocke mit Zähler auf Start, Heute und Meine Schichten, Seite „Mitteilungen“ (Heute/Früher, Neues hervorgehoben, Tippen führt zum Auftrag bzw. zu den Schichten, nach kurzem Ansehen gelesen). Aktualisierung jede Minute und beim Zurückkehren in die App.
- **Auslöser (Migration `20261107090000`, `remote-update-20261107090000.sql`):** neue Bewerbung, Rückzug, Absage durch Personal (an Admins); Zusage, Absage (an das Mitglied); neue veröffentlichte Schicht (an Küche/Personal mit passender Qualifikation); abgesagte Schicht (an Beworbene und Eingeplante); Annahme, Ablehnung, Änderungswunsch im Portal (an Admins); Sonderessen vom Kunden (an Admin und Küche, nur Anzahl und „kurzfristig“, keine Namen oder Diätformen). Wer etwas selbst auslöst, bekommt keine Mitteilung. Die Texte stehen in der App (`notifications.kind.*`), die Datenbank speichert nur Art und Rohdaten.
- **Tests:** 16 pgTAP-Tests (Empfänger, kein Auslöser, nur eigene lesbar, keine andere Firma, keine Gesundheitsdaten), Jest-Tests für Texte, Ziele und Tagesaufteilung.
- **Pilotdatenbank:** über den Supabase-Konnektor eingespielt; Abgleich mit der lokalen Referenz in allen 8 Bereichen identisch. Hinweis: Der Konnektor wertet Anweisungen mit dem Wort „delete“ (auch in Funktionskörpern) als Löschaktion und wartet auf eine Bestätigung, die in der Sitzung nicht erscheint; daher bricht er dort nach 60 s ab. `mark_notifications_read()` räumt deshalb keine alten Mitteilungen ab; die App zeigt die letzten 50.

## Datenbank des Pilotprojekts auf dem neuesten Stand (18.10.2026)

Über den Supabase-Konnektor eingespielt: Updates 2 bis 17 (`20261022090000` bis `20261106090000`). Update 1 war schon vorhanden. Geprüft per `supabase/check-updates.sql` (alle OK) und per Abgleich mit einer lokal aus allen Migrationen aufgebauten Datenbank: Spalten, Einschränkungen, Tabellen- und Spaltenrechte, alle Funktionen (Inhalt, Rechte, `security definer`), Regeln (auch Storage), Trigger und Ansichten sind identisch.

Abweichung im Weg, nicht im Ergebnis: Der Konnektor bricht `drop …`-Anweisungen und manche großen Funktionsdefinitionen nach 60 Sekunden ab. Die drei Sonderessen-Regeln aus `20261103090000` wurden deshalb mit `alter policy` statt `drop`/`create policy` geändert (gleicher Name, gleiche Aktion, gleiche Bedingung). Große Funktionen wurden über eine Hilfstabelle `public._mig_parts` stückweise zusammengesetzt. Die Tabelle ist gegen API-Zugriff gesperrt (keine Rechte für `anon`/`authenticated`, RLS an) und kann mit `drop table public._mig_parts;` im SQL Editor entfernt werden.

## Bencho-Bausteine (18.10.2026)

Dritte Runde der Oberfläche mit Bausteinen nach Bencho (bencho.dev; bench.dev war nicht erreichbar). Verwendet wurden nur die 41 frei lizenzierten Blöcke (MIT), davon elf, die in einer Arbeits-App auf dem Handy einen Nutzen haben; sie sind für React Native neu gebaut, der Lizenztext steht in `THIRD_PARTY_NOTICES.md`. Übersicht in [09-designsystem.md](09-designsystem.md) (Abschnitt „Bencho-Bausteine“).

- Neu: Schieben zum Bestätigen (Statuswechsel, Sammelaktion), flüssiger Schalter (`SwitchRow` statt Kästchen bei Ja/Nein-Einstellungen), gezeichneter Haken mit Durchstreichen (Einkaufsliste), Felder mit schwebender Beschriftung, Code-Kästchen (E-Mail bestätigen, Passwort zurücksetzen), ausklappende Suche (Aufträge, Kunden, Gerichte, Zutaten), Anlegen-Menü wächst aus dem „+“, gestapelte Toasts, Gesichter der Eingeplanten im Auftrag, Live-Insel für laufende und baldige Aufträge/Schichten, Monatswahl per Wischen über die Umsatzbalken.
- Keine Datenbankänderung, keine neuen Pakete.
- Prüfung: Typecheck, Lint, 249 Jest-Tests (neu: Live-Insel-Logik, Schieben zum Bestätigen), Mobil-Prüfung in drei iPhone-Größen, Bildschirmfotos aller Bausteine im iPhone-13-Format. Auf einem echten iPhone noch nicht getestet (Gesten, Haptik, Code-Vorschlag der Tastatur).

## Angebotseditor übersichtlicher, Speicherfehler behoben (18.10.2026)

- **Fehler „22P02 – invalid input syntax for type integer“ beim Speichern:** Der Editor zählte die aktive Bearbeitungszeit (Kennzahl K-01) in Sekunden mit Nachkommastellen und schickte sie so an `save_quote()`, das ganze Sekunden erwartet. Das trat auf, sobald zwischen zwei Änderungen mehr als eine Sekunde lag. Jetzt werden ganze Sekunden gesendet, der Rest zählt beim nächsten Speichern mit. Keine Datenbankänderung.
- **Editor neu aufgebaut** (SC-32/SC-33), Details in [09-designsystem.md](09-designsystem.md) („Angebotseditor“): Seite nur mit Positionen und Summe, Einstellungen (Kalkulation, Rabatt, Anzahlung, Gültigkeit, Texte) als Zeilen mit Wert und eigenem Blatt, Positionen als Karten, „Ordnen“ statt Pfeilen an jeder Position, Hinzufügen in Schritten mit Schnell-„+“ aus dem Katalog, Bearbeiten als Blatt mit dem Wesentlichen und „Weitere Optionen“, feste Leiste mit Summe und Versand. Gerichte aus dem Katalog kommen jetzt „pro Gast“ ins Angebot, wenn der Auftrag eine Gästezahl hat. Die Kartenbeträge zeigen Menge × Preis (abzüglich Positionsrabatt), der Gesamtrabatt steht in der Summe.
- **Nach unabhängiger Code-Prüfung nachgebessert:** Duplizieren übernimmt gerade getippte Änderungen (Kopie in einer Wahlgruppe ist nicht gewählt), Positionsrabatt mit Komma, Wechsel von „pro Gast“ zu fester Anzahl startet mit der Gästezahl, „Ohne Steuersatz“ und freie Gerichte/Pakete wieder möglich, Schnell-„+“ bestätigt mit Haken am Knopf (ein Toast läge hinter dem Blatt), Blätter weichen auf dem iPhone der Tastatur aus, runde Knöpfe werden nicht mehr unter 44 dp gestaucht.
- **Prüfung:** Typecheck, Lint, 260 Jest-Tests (neu: Positionseingaben, Zeilenrechnung, Zeilenwerte, alle Textschlüssel des Angebotsbereichs vorhanden), Klickdurchlauf im iPhone-13- und iPhone-SE-Format gegen eine simulierte Datenbank (Hinzufügen per „+“ und in Schritten, freie Position Personal mit Stunden, Zwischenüberschrift, Bearbeiten, Duplizieren, Entfernen, Ordnen, Rabatt, Anzahlung, Texte, Gültigkeit; gespeicherte Nutzlast mit ganzen Sekunden und richtigen Summen geprüft), Mobil-Prüfung der Seiten und aller Blätter ohne Befund.
- **Nachtrag, Fehler „23514 – quote_items_dish“:** Die Datenbank erlaubt die Art „Gericht“ bzw. „Paket“ nur mit Katalogeintrag. Frei angelegte Gerichte und Pakete (ohne Katalog) werden deshalb als freie Position gespeichert, mit dem Steuersatz für Speisen und Einheit „Portion“ bzw. „Person“ (`storedType` in `model.ts`, getestet). Der Fehler steckte schon in der alten Fassung („Freie Gericht-Position“). Alle übrigen Regeln der Tabelle `quote_items` mit dem Editor abgeglichen.
