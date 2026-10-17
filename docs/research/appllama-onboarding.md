# Appllama-Recherche · Bereich A: Onboarding & Firmen-Setup

Stand: 17.10.2026 · Meilenstein M0 · Plan: `docs/04-screens-ux.md` §5.3 und §5.4

Dieses Dokument enthält **nur eigene Beschreibungen und `screen_ref`-Verweise** (`app_id/screen_id`, wie sie Appllama über „Copy Screen ID“ liefert). Bilder, Videos und Medien-URLs sind nicht gespeichert: Die URLs laufen nach etwa einer Stunde ab, und das Appllama-Wasserzeichen ist Herkunftsangabe, kein Teil des Designs.

## Ergebnis in einem Absatz

Der Katalog besteht überwiegend aus Verbraucher-Apps. Für den Kern des Onboardings finden sich gute, belastbare Muster bei **Slack, Notion und Wave** (eine Frage je Screen, kompakter Wizard mit Auswahllisten, Einladungswege, Hinweisseite nach der Registrierung) sowie bei **UNSCRIPTED** (Branding-Einstellungen mit Logo und Farbe, strukturell am nächsten an unserem Kundenportal-Branding). Für drei Punkte gibt es **keine brauchbaren Vorbilder**: die Einladungs-Landingpage zum Beitritt, die Setup-Checkliste auf der Startseite und die Testphase ohne Kauf-Link auf iOS. Dafür entwerfen wir eigene Lösungen (Abschnitt „Lücken“).

## Verbrauch

| Aufruf | Anzahl |
|---|---|
| Phase 0 (`list_ui_elements`, 4 × `list_flows`) | 5 |
| `search_apps` | 3 |
| `search_screens` (semantic 4, keyword 2, davon 1 mit Filter `section: onboarding`) | 6 |
| `list_app_screens` (Slack, Wave, Notion; je Seite 1, `section: onboarding`) | 3 |
| `search_screens` semantic (Testphase-Banner) | 1 |
| **Summe Bereich A** | **13** (Plan 30, Obergrenze 40) |
| **Summe gesamt inkl. Phase 0** | **18** von 1.500 im Monat |

Nicht ausgeführt, weil die Treffer schon genügten: `get_screen` je Ziel-Screen (Ähnlichkeitssuche), `get_flow_apps`. Die Reserve (22 Credits dieses Bereichs) bleibt für die Nachrecherche beim Screen-Design.

## Orientierung (Phase 0)

| Bereich | Flow-Slug im Katalog | Treffer |
|---|---|---|
| Onboarding | `onboarding` | 22.139 Screens in 1.407 Apps; kleine Sonderflows `business-onboarding` (5 Screens), `restaurant-onboarding` (5) |
| Kalender | `calendar`, `calendar-management`, `calendar-events` | 68 Screens in 20 Apps – dünn |
| Rechnungen/Angebote | `invoices`, `invoice-customization`, `invoice-creation`, `invoice-preview` | 2 Apps, wenige Screens – sehr dünn |
| Schichtplanung | `schedule`, `schedule-creation`, `schedule-management` | 1–2 Apps – sehr dünn |

Folge für die späteren Bereiche B, C und D: Die Flow-Suche allein trägt dort nicht. Die semantische Suche und Analog-Apps (Terminbuchung, Gig-Apps) sind der Hauptweg; das ist in 04 §5.1 schon vorgesehen.

**Element-Familien für die Komponentenliste (04 §4.9):** `tab-bars` (Bottom Tab Bar), `progress` (Top Progress Bar, Step Progress Bar), `buttons-ctas` (Rounded Primary CTA), `segmented-controls`, `sheets-modals` (Rounded Bottom Sheet), `chips-pills`, `inputs-fields`, `text-links` (Skip Text Link), `loading-empty`, `banners-toasts`, `selected-states` (Radio, Checkbox).

## Muster-Steckbriefe

### M-A-01 · Eine Frage je Screen mit Fortschrittsbalken
- **Quellen:** Slack `618783545/onb_8wpsb` (Firma benennen), `618783545/onb_41ffx` (Profilname), `618783545/onb_pg7hh`; Todoist `572688855/onb_1pyvo` (Teamname)
- **Löst:** Eine Pflichtangabe ohne Ablenkung; der Fortschritt bleibt sichtbar.
- **Aufbau (oben nach unten):** Zurück-Pfeil im Kreis links, dünner Fortschrittsbalken daneben; große Frage („Wie heißt deine Firma oder dein Team?“) mit einem Satz Erklärung; **Eingabe und runder Weiter-Pfeil in einer Zeile**; Rest der Seite leer.
- **Interaktion:** Der Weiter-Pfeil ist grau, bis die Eingabe gültig ist; die Tastatur öffnet sich automatisch.
- **Übertrag auf:** SC-08 nur teilweise (siehe unten)
- **Anpassung für uns:** Wir haben **drei Pflichtfelder** (Name, Land, Kontakt-E-Mail) plus AVV – das ist zu viel für „eine Frage je Screen“. 
- **Bewertung:** anpassen – für SC-08 **nicht** übernehmen, sondern das Wave-Muster M-A-02 nutzen. Der Fortschrittsbalken („Schritt x von 3“) ist für den Wizard SC-08 bis SC-10 gut.
- **Umsetzung in Expo:** `ProgressBar` und `ScreenHeader` aus 04 §4.9; niedriger Aufwand.

### M-A-02 · Kompakter Wizard mit Auswahllisten
- **Quellen:** Wave `881629660/onb_92wdg` (Firmenname mit Zeichenzähler 8/50 und Land als Auswahlliste), `881629660/onb_sq0td` (Rechtsform als Radio-Liste mit Hilfetext und Link „Nicht sicher? Hier erfährst du mehr“), `881629660/onb_gjdk1`, `881629660/onb_lknzl`
- **Löst:** Mehrere zusammengehörige Pflichtangaben mit klarer Reihenfolge, ohne Tippaufwand bei Auswahlfeldern.
- **Aufbau:** Kopfzeile „Konto erstellen“ mit Zurück und **„Abbrechen“**; Abschnittstitel; Eingabefeld mit Beschriftung darüber und Zähler darunter; Auswahl als Karte mit **Radio-Zeilen** (Land, Währung, Rechtsform); **feste Schaltfläche „Weiter“ am unteren Rand**, über der Tastatur.
- **Interaktion:** Die ganze Zeile ist tippbar, nicht nur der Radio-Punkt; Hilfetext erscheint unter dem Titel, nicht im Tooltip.
- **Übertrag auf:** SC-08, SC-10
- **Anpassung für uns:** Land als Radio-Liste mit **DE aktiv und AT/CH sichtbar, aber deaktiviert („bald verfügbar“)** (US-01.2). Kontakt-E-Mail direkt darunter; bei „E-Mail verbergen“ über Apple bleibt das Feld leer und Pflicht (US-01.4). AVV-Checkbox mit PDF-Link über dem Button.
- **Bewertung:** **übernehmen** – eine Seite „Firma“ mit allen Pflichtfeldern, optionale Felder (Telefon, Anschrift) unter „Weitere Angaben“ eingeklappt.
- **Umsetzung in Expo:** `TextField` (vorhanden), neue `RadioList`; feste Aktionsleiste (`StickyActionBar` aus 04 §4.9). Aufwand niedrig bis mittel.

### M-A-03 · Hinweisseite nach der Registrierung
- **Quellen:** Slack `618783545/onb_r5m1h` („Prüfe deine E-Mail!“) und `618783545/onb_gi21e` (Auswahl der Mail-App); Notion `1232780281/onb_73s5s` (Code-Feld mit **Countdown „Erneut senden in 13 s“**)
- **Löst:** Der Nutzer weiß, was passiert ist und was als Nächstes zu tun ist.
- **Aufbau (Slack):** Titel, Adresse **fett** im Text, Illustration, **primäre Schaltfläche „E-Mail-App öffnen“**, darunter ein kleiner Hilfelink bei Problemen.
- **Interaktion:** „Erneut senden“ ist gesperrt, bis der Countdown abgelaufen ist – das entspricht unserer Sperre von 60 s (SC-03).
- **Übertrag auf:** SC-03 (bereits so umgesetzt: Adresse im Text, Countdown, „E-Mail-App öffnen“)
- **Anpassung für uns:** Notion nutzt einen **6-stelligen Code** statt eines Links. Siehe Hinweis unten zur Link-Frage.
- **Bewertung:** **übernehmen**; offene Frage zum Code statt Link.
- **Umsetzung in Expo:** bereits in M0 (`VerifyEmailScreen`).

### M-A-04 · Einladungswege
- **Quellen:** Slack `618783545/onb_mqvsy` („Wer gehört noch zum Team?“ mit drei gleich großen Schaltflächen: Link teilen, Aus Kontakten, Per E-Mail); Notion `1232780281/onb_algty` („Link kopieren“ und „Teilen …“); CamCard `349447615/oth_uaifk`
- **Löst:** Mitglieder lassen sich über den Kanal einladen, den sie tatsächlich nutzen.
- **Aufbau:** große Frage mit Firmenname hervorgehoben; **drei umrandete Schaltflächen** untereinander; „Weiter“ ist deaktiviert, bis eine Einladung verschickt ist – bei Notion bleibt „Weiter“ aktiv und der Schritt ist überspringbar.
- **Übertrag auf:** SC-11 (Startaufgabe „Team einladen“), SC-54, SC-55
- **Anpassung für uns:** Aushilfen erreichen wir am besten über **WhatsApp**: „Link teilen“ öffnet das System-Teilen-Blatt (WhatsApp, SMS, Mail). Die Einladung ist an keine E-Mail gebunden (01 US-06). Der Schritt im Onboarding ist **überspringbar** (kein Zwang, wie bei Notion).
- **Bewertung:** **übernehmen** (Schaltflächen-Block), aber mit „Link teilen“ als erste und hervorgehobene Aktion.
- **Umsetzung in Expo:** `Share.share` bzw. Teilen-Blatt; Einladungslink aus `create_invitation`. Aufwand niedrig (M1).

### M-A-05 · Push-Erklärung vor der Systemabfrage
- **Quellen:** Slack `618783545/onb_ksugb` (Vollseite: Überschrift, Telefon-Grafik mit Beispiel-Mitteilungen, **„Benachrichtigungen aktivieren“** und Textlink **„Überspringen“**); MoonPay `1635031432/onb_6z9vs` (Bottom Sheet: Symbol, Überschrift, **ein Satz Nutzen**, „Erlauben“ und „Vielleicht später“); Birdbuddy `1622355240/onb_5ab20` (Systemdialog darüber, mit „Vielleicht später“-Link)
- **Löst:** Die Systemabfrage erscheint erst, wenn der Nutzer den Nutzen kennt. Ein „Nicht erlauben“ lässt sich auf iOS später kaum noch rückgängig machen.
- **Aufbau (MoonPay):** Sheet mit Griff, Symbol, Überschrift, kurzer konkreter Satz, zwei Schaltflächen untereinander (primär hell, sekundär gedämpft).
- **Interaktion:** Nur „Erlauben“ löst die Systemabfrage aus; „Vielleicht später“ schließt das Sheet, ohne die Abfrage zu verbrauchen.
- **Übertrag auf:** SC-06 nach dem Beitritt, SC-11, SC-47–SC-51 (später)
- **Anpassung für uns:** Der Nutzen ist **konkret**, nicht allgemein: „Wir sagen dir Bescheid, wenn deine Bewerbung zu- oder abgesagt wird.“ (Mitarbeiter) bzw. „…wenn sich jemand auf einen Slot bewirbt.“ (Admin). **Keine Gesundheitsdaten im Text** (01 US-54.7). Wird die Abfrage abgelehnt, zeigt die App einen Hinweis „Benachrichtigungen sind aus“ mit Link in die Systemeinstellungen.
- **Bewertung:** **übernehmen** (Sheet nach MoonPay, Textlink wie Slack).
- **Umsetzung in Expo:** `@gorhom/bottom-sheet` nativ, `expo-notifications` (M7). Aufwand niedrig.

### M-A-06 · Branding: Logo hochladen und Farbe wählen
- **Quellen:** UNSCRIPTED `1438843099/oth_1xn60` („Profil-Einstellungen · Branding“: Karten für **Profilbild**, **Titelbild** und **Markenfarbe** mit dem Satz „Das wirkt sich auf das Design der Schaltflächen in deinem Kundenportal aus“; Hex-Feld mit Farbkreis, **„Auf Standardfarben zurücksetzen“**); FLYP `1605986264/oth_y3okh` (Logo-Kachel mit gestricheltem Rand „Logo hochladen“, darunter Auswahl; „Weiter“ deaktiviert); Storybeat `1381520124/oth_34b81` und Mojo `1434861974/oth_1pyjg` (Brand-Kit mit leeren Kacheln „+“)
- **Löst:** Branding ist ein einmaliger, optionaler Schritt mit sofort sichtbarer Wirkung.
- **Aufbau (UNSCRIPTED):** Je Eigenschaft eine Karte mit Titel, **Satz, wo es wirkt**, Eingabe und Tipp. Farbe als **Hex-Feld plus Farbkreis**; „Zurücksetzen“ in Warnfarbe.
- **Übertrag auf:** SC-09, SC-59
- **Anpassung für uns:** Logo (PNG/JPG, ≤ 2 MB) und Akzentfarbe (8 Vorschläge plus Hex) mit **Live-Vorschau von Portal-Kopf und PDF-Kopf**, **Kontrastwarnung** unter 4,5:1 für weißen Text, immer **„Überspringen“** (US-01.3). Der erklärende Satz „wirkt auf Portal und neue PDFs, versendete PDFs bleiben unverändert“ kommt aus UNSCRIPTED.
- **Bewertung:** **übernehmen**, mit eigener Vorschau (die Vorbilder haben keine).
- **Umsetzung in Expo:** `expo-image-picker`, `expo-image-manipulator` (Logo normalisieren), eigene `ColorSwatchPicker` und `BrandPreview`. Aufwand mittel (M1).

### M-A-07 · Anordnung der Anmeldearten
- **Quellen:** Wave `881629660/onb_pmqmc` (E-Mail- und Passwortfeld mit „Anzeigen“, dann Schaltfläche, **darunter umrandete Social-Buttons**, Link „Anmelden“); Slack `618783545/onb_65vhv` (E-Mail, grüne Schaltfläche, Social darunter, Hilfelinks); Notion (Auth-Schaltflächen mit Symbolen)
- **Löst:** Die Hauptaktion bleibt klar, Social-Login ist gleichwertig sichtbar.
- **Übertrag auf:** SC-01, SC-02
- **Anpassung für uns:** E-Mail-Formular zuerst, darunter die Trennzeile „oder“ und **„Mit Apple anmelden“** und **„Mit Google anmelden“ gleich groß** (Apple verlangt gleichwertige Darstellung, 05 §6.2). Pflichtlinks (Nutzungsbedingungen, Datenschutz) klein darunter. In M0 sind die Social-Buttons bewusst **nicht** eingebaut (ohne Anbieter-Zugangsdaten wären sie tot); sie folgen mit M1.
- **Bewertung:** **übernehmen**.

## Antworten auf die Fragen aus 04 §5.4

| # | Frage | Antwort aus der Recherche |
|---|---|---|
| 1 | Wie viele Pflichtfelder vor dem ersten Nutzen? | Slack: 2 (Firmenname, Profilname). Wave: 6 Angaben (Name, Firma, Land, Währung, Rechtsform, Kategorie) – bewusst lang, weil Buchhaltung. **Wir: eine Seite mit 3 Pflichtfeldern + AVV** (US-01.2); alles Weitere ist überspringbar oder später nachholbar. |
| 2 | Wizard oder Checkliste? | Beides kombinieren: kurzer Wizard (3 Schritte) bis zum ersten Nutzen, danach eine **Checkliste auf der Startseite** (SC-12). Für die Checkliste fand die Suche kein Vorbild → eigene Lösung. |
| 3 | Einladungsseite: Firma, Rolle, Absender, Fehlerfälle? | Die Vorbilder zeigen nur das **Senden** von Einladungen, nicht die **Beitrittsseite**. → Lücke G-A-1. |
| 4 | Push-Erklärung: wann, welcher Text? | Nach dem Beitritt bzw. als letzter Schritt, **mit Überspringen**; Sheet (MoonPay) oder Vollseite (Slack). Text konkret statt allgemein (M-A-05). |
| 5 | Testphase auf iOS ohne Kauf-Link? | Kein brauchbares Vorbild: Die Treffer sind Verbraucher-Paywalls mit Kauf. → Lücke G-A-3. |
| 6 | Logo und Farbe mit Vorschau? | UNSCRIPTED (Erklärsatz, Hex plus Farbkreis, Zurücksetzen) + FLYP (Upload-Kachel); die **Live-Vorschau** entwerfen wir selbst (M-A-06). |
| 7 | Anordnung Apple/Google/E-Mail, Pflichtlinks? | E-Mail zuerst, „oder“, Social-Buttons gleich groß darunter, Links klein am Ende (M-A-07). |

## Lücken: eigene Lösungen

**G-A-1 · Beitrittsseite zur Einladung (SC-06).** Entwurf: Karte mit Firmenlogo bzw. Initial, Überschrift „{Firma} lädt dich als {Rolle} ein“, darunter Qualifikationen und „gültig bis“. Ohne Sitzung zwei Wege: „Registrieren“ (E-Mail vorbefüllt, falls der Admin eine eingetragen hat) und „Anmelden“. Fehlerfälle als eigene Zustände mit je einer Handlung: **ungültig**, **abgelaufen** („Bitte den Betrieb um einen neuen Link“), **widerrufen**, **bereits Mitglied bei {Firma A}**. Nach dem Beitritt folgt die Push-Erklärung (M-A-05).

**G-A-2 · Setup-Checkliste (SC-12).** Entwurf: Karte „Einrichtung 2 von 5“ mit Fortschrittsbalken (Familie `progress`), je Aufgabe eine Zeile mit Haken: Firma angelegt ✓, Logo und Farbe, erstes Gericht, Team einladen, Probe-Angebot an dich selbst. Karte verschwindet, wenn alles erledigt ist; jede Zeile führt direkt in den Ziel-Screen.

**G-A-3 · Testphase ohne Kauf auf iOS (SC-11, SC-12, Abo).** Entwurf: ein **neutraler Statustext** „Testphase bis 31.10.2026“ ohne Preis, Schaltfläche oder Link; im Web-Admin daneben „Abo abschließen“. Läuft die Testphase ab, steht nativ nur „Die Testphase ist beendet. Der Betrieb kann das Abo im Web-Admin verwalten.“ (01 US-56.7). Das ist eine Datenschutz- und Store-Richtlinienfrage, kein Gestaltungsmuster aus dem Katalog.

## Mail-Bestätigung: Link und Code (entschieden R3-2)

Notion bestätigt die Adresse mit einem **6-stelligen Code**, den man in der App eingibt (M-A-03). Wir nutzen einen **Link** (`token_hash`, 05 §6.3). Der Link funktioniert im Web gut. Auf dem Handy hängt er davon ab, dass die App ihn öffnen kann: Das geht zuverlässig erst mit **Universal Links** (eigene Domain, kommt mit M10); ein Link mit eigenem Schema (`cateringapp://…`) wird in vielen Mail-Apps nicht als Link angezeigt oder blockiert. Ein Code umgeht das und funktioniert auf jedem Gerät.

**Entschieden (R3-2): Link und Code.** Supabase kann beides in derselben Mail (`{{ .Token }}` neben `{{ .TokenHash }}`). Der Code ist als Eingabefeld in SC-03 und SC-05 umgesetzt.

## Entscheidungsvorlage (Muster je Ziel-Screen)

Die Muster dieser Tabelle hat der Gründer am 17.10.2026 **übernommen** (R3-3). Quelle der Empfehlung: Claude; Verfahren nach 04 §0.6.

| Screen | Gewähltes Muster | Quelle (`screen_ref`) | Begründung | Offene Frage |
|---|---|---|---|---|
| SC-01 Login | M-A-07 | `881629660/onb_pmqmc`, `618783545/onb_65vhv` | E-Mail zuerst, Social gleichwertig darunter | – |
| SC-02 Registrierung | M-A-07 + Passwort-Hinweis „mind. 10 Zeichen“ | `881629660/onb_pmqmc` | gleiche Anordnung wie SC-01 | – |
| SC-03 E-Mail bestätigen | M-A-03 | `618783545/onb_r5m1h`, `1232780281/onb_73s5s` | Adresse im Text, Countdown, „E-Mail-App öffnen“ | – (entschieden: Link und Code) |
| SC-04 Passwort vergessen | M-A-03 (Hinweisseite) | `618783545/onb_r5m1h` | neutrale Bestätigung, verrät nichts | – |
| SC-05 Neues Passwort | wie SC-02, zwei Felder | `881629660/onb_pmqmc` | „Anzeigen“-Schalter; Fehlerzustand „Link abgelaufen“ mit Handlung | – |
| SC-06 Einladung annehmen | **eigene Lösung** G-A-1 | – | kein Vorbild im Katalog | Wortlaut der Fehlerfälle |
| SC-07 Willkommen | zwei große Karten „Neue Firma anlegen“ / „Ich habe eine Einladung“ | `618783545/onb_mqvsy` (Block aus gleich großen Schaltflächen) | zwei klare Wege | – |
| SC-08 Firma | M-A-02 | `881629660/onb_92wdg`, `881629660/onb_sq0td` | eine Seite, Radio-Liste für Land, feste Aktionsleiste | Anschrift hier optional oder Pflicht? (Vorschlag: optional, Prüfung vor Versand) |
| SC-09 Branding | M-A-06 | `1438843099/oth_1xn60`, `1605986264/oth_y3okh` | Erklärsatz, Hex plus Farbkreis, Zurücksetzen, **Live-Vorschau** | – |
| SC-10 Arbeitsweise | M-A-02 (Karten mit Voreinstellungen) | `881629660/onb_sq0td` | Radio-Zeilen mit Hilfetext je Option | – |
| SC-11 Fertig | Checkliste „3 Startaufgaben“ + Push-Sheet | `618783545/onb_ksugb`, `1635031432/onb_6z9vs` | schneller erster Nutzen | Wortlaut „Testphase bis …“ (G-A-3) |
| SC-12 Setup-Checkliste | **eigene Lösung** G-A-2 | – | kein Vorbild im Katalog | – |
| SC-54/55 Team einladen | M-A-04 | `618783545/onb_mqvsy`, `1232780281/onb_algty` | „Link teilen“ zuerst (WhatsApp) | – |
| SC-59 Branding (Einstellungen) | M-A-06 | `1438843099/oth_1xn60` | gleiche Komponenten wie SC-09 | – |
