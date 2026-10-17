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
| A-3 | SC-07 Willkommen | `(auth)/welcome` | **`(app)/welcome`** | Mit Sitzung gehört die Seite in die geschützte Gruppe. Das Gate bekommt mit M1 eine dritte Stufe „Sitzung ohne Mitgliedschaft“ |
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

## Nicht in M0 gebaut (bewusst)

| Punkt | Warum | Wann |
|---|---|---|
| Deploy nach staging (Migrationen, Functions, EAS Update, Web-Hosting) | braucht Supabase-Projekt, Expo-Konto, Hosting (E-12) | sobald die Konten stehen |
| `expo-updates`, EAS-Projekt-ID, Build-Läufe | braucht Expo-Konto | M0 oder M1, nach Kontoanlage |
| Apple- und Google-Anmeldung | siehe A-9 | M1 |
| Bundle-ID | Platzhalter `com.example.cateringapp` in `app.config.ts` | vor dem ersten Store-Build, mit dem App-Namen (E-2) |
| Icon und Splash | Platzhalter-Dateien des Templates | mit Name und Marke (E-4) |
| Sentry, Maestro-E2E | in 05 §10 für später vorgesehen | M10 |
