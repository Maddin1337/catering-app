# Designsystem (Überarbeitung Oktober 2026)

Gilt für Team-App und Kundenportal. Die Werte stehen in `src/theme/tokens.ts`, die Bausteine in `src/components/ui/`. Grundlage ist eine Recherche im Appllama-Katalog (Tiimo, Todoist, Fantastical, Invoice Maker, Splitwise u. a.); abgeleitet wurden Muster, kein Bildmaterial.

## Leitlinien

- **Warme Fläche, weiße Karten:** Seitenhintergrund `canvas` (#F6F4F0), Inhalte auf weißen Karten (`Surface`, `surfaceStyle()`), abgehoben durch weiche, warm getönte Schatten statt harter Rahmen.
- **Große, kräftige Titel:** Überschriften in Plus Jakarta Sans (Bold/ExtraBold), Fließtext und Bedienung in Inter. Das Gewicht steckt weiter in der Schriftfamilie (kein `fontWeight`).
- **Runde Formen:** Schaltflächen, Chips, Reiter und die Tab-Leiste sind Pillen (`radius.full`); Karten 22, Felder 16, Blätter 28.
- **Eine Hauptaktion pro Ansicht:** `Button variant="primary"` (Petrol-Verlauf mit farbigem Schatten). `dark` (Tinte) für starke Zweitaktionen, `secondary` (weiß), `tonal`, `ghost`, `danger` (rosa Fläche, roter Text).
- **Spürbares Tippen:** `PressableScale` federt beim Drücken leicht ein (Reanimated; folgt „Bewegung reduzieren“), `Button` löst auf dem Gerät ein leichtes Haptik-Signal aus (Web: keins).
- **Schlanke, schwebende Tab-Leiste:** `FloatingTabBar` – Symbol über kleiner Beschriftung (11 px). Eine Petrol-Kapsel gleitet mit leichtem Überschwingen zum aktiven Tab, dessen Symbol kurz größer wird (Auswahl-Haptik). Admins haben in der Mitte ein rundes „+“ für die **Schnellanlage** (Anfrage, Auftrag, Kunde, Gericht, Paket, Einladung). Die Leiste belegt Platz im Layout, es wird nichts verdeckt.
- **Reiter auf Detailseiten:** `SegmentedTabs` (graue Spur, die weiße Pille gleitet zum aktiven Eintrag) ersetzt die Unterstreich-Reiter (Auftrag, Team, Katalog).
- **Leere Zustände:** `EmptyState` mit runder Symbol-Plakette; Einstiegskarten (`ActionCard`) mit pastellfarbener Plakette (`tints`).
- **Hinweise:** `Banner` mit Symbol und getönter Fläche, ohne Rahmen. Auswahlblätter (`PickerSheet`) fahren von unten ein, mit Griff und abgedunkeltem Hintergrund (`color.scrim`).

## UX-Überarbeitung (Oktober 2026, zweite Runde)

Vorbilder aus Appllama: Wave (Schnellanlage-Blatt), TimeTree und SignNow (kompakte Kopfleiste mit „⋯“, feste Aktionsleiste unten), Joist (Überlaufmenü am Dokument), HabitKit, Widgetsmith und Tiimo (gruppierte Einstellungen, einklappender Titel). Übernommen wurden Muster, kein Bildmaterial.

### Seitenrahmen `Screen`

- **Kompakte Kopfleiste:** links ein runder Zurück-Knopf (`backIcon="close"` zeigt ✕ auf Anlegen-Seiten), rechts bis zu zwei runde Aktionen (`actions`, z. B. „+“ oder Bearbeiten) und optional „⋯“ (`menu`).
- **Einklappender Titel:** Der große Titel blendet beim Scrollen aus, ein kleiner Titel gleitet in die Leiste, die Leiste bekommt einen milchigen Hintergrund mit Haarlinie. Beim Überziehen nach unten wächst der große Titel leicht.
- **Feste Aktionsleiste unten (`footer`):** Speichern und der nächste Schritt liegen in Daumenreichweite statt am Seitenende. Sie gleitet beim Öffnen von unten herein.
- **Ziehen zum Aktualisieren** (`onRefresh`) auf Start, Aufträgen, Listen und Auftragsdetail.

### Wo Aktionen liegen

| Seite | Oben rechts | „⋯“-Menü | Unten fest |
|---|---|---|---|
| Aufträge | „+“ (Anfrage im Chat / direkt) | – | – |
| Auftragsdetail | Bearbeiten | Kopieren, weitere Status, Absagen/Stornieren, Fehleingabe löschen | nächster Status (+ zweiter friedlicher) |
| Kunden | „+“ | Excel-Import | – |
| Kunde | Bearbeiten | Löschen | Neuer Auftrag |
| Gerichte, Pakete, Zutaten | „+“ | Archivieren (im Formular) | Speichern (im Formular) |
| Team | Einladen | – | – |
| Einstellungen-Formulare | – | – | Speichern |

Zerstörerische Aktionen stehen nie als großer Knopf auf der Seite, sondern rot im Menü und werden weiter bestätigt.

### Blätter, Rückmeldung, Laden

- **`Sheet`**: unteres Blatt mit Federbewegung, abdunkelndem Hintergrund und Griff; schließt per Tippen daneben, Zurück-Taste oder Herunterziehen. Darauf bauen `ActionSheet` (Menüzeilen mit Symbol, Hinweis, rot für Zerstörerisches), `PickerSheet` (Datum, Uhrzeit), der Statuswechsel und die Sammelaktion „Durchgeführt“.
- **`showToast()`**: kurze dunkle Pille oben („Gespeichert.“) mit Erfolgs-Haptik statt grüner Banner auf der Seite.
- **`Skeleton` / `SkeletonList`**: pulsierende Platzhalter statt „Lädt …“.
- **Filter:** `ChipRow` (waagerecht wischbar, bis an den Rand); seltene Filter liegen in einem Blatt, der Filter-Chip zeigt die Anzahl aktiver Filter (Gerichte).
- **Gruppierte Listen:** `ListGroup` + `GroupRow` (iOS-Stil, farbige Symbolkachel, Haarlinien) für Einstellungen, „Mehr“ (mit Profilkarte oben) und Kundendetail.

### Bewegung

| Wirkung | Baustein | Technik |
|---|---|---|
| Einträge erscheinen gestaffelt von unten | `Appear` (`index` staffelt, ab dem 8. ohne Verzögerung) | Reanimated `FadeInDown`; Nachrücken mit Feder nur auf dem Gerät |
| Kennzahlen zählen hoch | `AnimatedNumber` (Start, Küche, Schichten, Auftragswert) | `requestAnimationFrame`, kubisch auslaufend |
| Umsatzbalken wachsen nacheinander | `RevenueCard` | Reanimated-CSS-Animation (`scaleY`) |
| Tab-Kapsel, Segment-Pille, Fortschritt im Anfrage-Chat | `tab-bar`, `segmented-tabs`, `transition()` | Reanimated-CSS-Übergänge |
| Chips, Checkbox, Radio | Farbe gleitet, Haken/Punkt springt mit Feder herein | CSS-Übergang + `ZoomIn` |
| Seitenwechsel | iOS: native Schiebebewegung mit Wischen vom ganzen Rand; Android: von rechts; Anlegen-Seiten von unten | Stack-Optionen in `src/app/(app)/_layout.tsx` |
| Haptik | Tippen (Button), Auswahl (Tabs, Segmente, Chips, Checkbox), Erfolg/Fehler (Toast), „+“ mittel | `expo-haptics`, im Web aus |

Alle Reanimated-Wirkungen folgen „Bewegung reduzieren“; `AnimatedNumber` springt dann direkt auf den Wert. Dauern und Kurven stehen in `tokens.motion` (`fast` 140, `base` 220, `slow` 360 ms, `stagger` 45 ms, `ease`, `spring`).

**Hinweis Web:** Eigene Startwerte (`withInitialValues`) und Layout-Übergänge in Scrollbereichen vermeiden – Reanimated positioniert solche Elemente im Web danach absolut bzw. hält Scrollen für Bewegung.

## Unverändert (Barrierefreiheit und Mobil)

Tippflächen ≥ 44 dp (Tabs, Chips, Segmente und kleine Schaltflächen 44–48), Eingaben 16 px (kein Zoom in iOS Safari), Rahmen von Eingabefeldern bleiben als `borderInput` kontrastreich (≥ 3:1), Textkontraste ≥ 4,5:1 (Statusfarben ≥ 6:1). `scripts/smoke/mobile-audit.mjs` prüft das weiter automatisch.

## Wo was liegt

| Baustein | Datei |
|---|---|
| Farben, Radien, Schatten, Schriften, Pastelltöne | `src/theme/tokens.ts` |
| Tippfläche mit Federeffekt | `src/components/ui/pressable-scale.tsx` |
| Karte / Kartenstil | `src/components/ui/surface.tsx` |
| Schaltfläche | `src/components/ui/button.tsx` |
| Tab-Leiste, Segmente | `tab-bar.tsx`, `segmented-tabs.tsx` |
| Leerer Zustand, Marken-Plakette | `empty-state.tsx`, `brand-mark.tsx` |
| Seitenrahmen mit Kopfleiste und Aktionsleiste | `screen.tsx` |
| Blatt, Menü-Blatt, Auswahlblatt | `sheet.tsx`, `action-sheet.tsx`, `picker-sheet.tsx` |
| Rückmeldung, Platzhalter | `toast.tsx`, `skeleton.tsx` |
| Bewegung | `appear.tsx`, `animated-number.tsx`, `transition.ts` |
| Gruppierte Liste, Chip-Reihe | `list-group.tsx`, `chip-row.tsx` |

## Startseite (Admin)

Aufbau von oben nach unten, nach Mustern aus Appllama (Decory, Joule, Fantastical, MileIQ, Gridwise, Xmind): Begrüßung mit Vorname und Datum, Wochenleiste (7 Tage, Punkt bei Aufträgen, heute dunkel), Hero-Karte „Als Nächstes“ (nächster optionierter oder bestätigter Auftrag mit Termin, Ort, Gästen, Status und „in n Tagen“), Fortschrittskarte „Erste Schritte“ (nur solange offen), „Auf einen Blick“ (Aufträge und Gäste der nächsten 7 Tage, offene Anfragen, Angebote ohne Antwort), „Zu erledigen“ mit farbigen Symbol-Plaketten, „Heute und morgen“ als Tagesliste mit Uhrzeit. Admins sehen außerdem die Karte „Auftragswert“ (siehe unten).

Die Berechnungen stehen in `src/features/start/overview.ts` (getestet), die Bausteine in `src/features/start/components/`. Umsatzzahlen fehlen bewusst: Angebotssummen liegen nur je Entwurf bzw. Version vor, eine Monatssumme bräuchte eine eigene, saubere Abfrage.

### Auftragswert (Admin)

Karte mit gebuchtem Wert des aktuellen Monats (netto, ganze Euro), Vergleich zum Vormonat, offenem Wert in versendeten und optionierten Angeboten und Balken für sechs Monate (zwei zurück, drei voraus). Datenquelle ist die Funktion `revenue_overview()` (Migration `20261106090000`, nur Admin, 8 pgTAP-Tests). Gerechnet wird nach Monat der Veranstaltung mit der Nettosumme der gültigen Angebotsfassung (verbindliche Fassung, sonst die zuletzt gesendete); später im Portal geänderte Auswahl-Optionen und Aufträge ohne versendetes Angebot sind nicht enthalten (steht so auch unter der Karte). Fehlt das SQL-Update, bleibt die Karte einfach weg.

## Startseiten für Küche und Personal

Gleiche Bausteine wie beim Admin (Begrüßung, Wochenleiste, Hero-Karte `HeroCard`, Kennzahlen `StatGrid`):

- **Küche, Tab „Heute“:** Wochenleiste, nächster Auftrag, Umschalter Heute/Morgen, Kennzahlen (Aufträge, Gäste, Änderungen offen, Vorläufig) und Auftragskarten mit Uhrzeit, Markierungen (`Pill`: vorläufig, Änderung offen, Sonderessen), Gästen, Abfahrt, Ausgabe und Hinweisen. Keine Preise.
- **Personal, Tab „Meine Schichten“** (und für die Küche unter Mehr): Wochenleiste mit zugesagten Schichten, Hero-Karte „Nächste Schicht“, Kennzahlen (zugesagt, beworben, freie Schichten auf der Börse), Schichtkarten mit Datumskachel (`DateTile`) und Statusmarkierung. Die Schichtbörse nutzt dieselben Karten.

Berechnungen: `src/features/shifts/overview.ts` und `src/features/start/overview.ts` (getestet).

## Listen, Kalender und Suche

- **Auftragsliste:** Suchpille (`SearchField`), Segmente Anstehend/Vergangen/Archiv, Art als Chips, Aufträge nach Monat gruppiert (`groupByMonth`), Karten `EventListItem` mit Datumskachel, Zeit, Gästen, Kunde und Status.
- **Kalender:** Segmente Monat/Woche/Liste, Monatskarte mit runden Tagen (gewählter Tag dunkel, heute mit Ring, Punkte in Statusfarbe), runde Pfeilknöpfe (`IconButton`), dieselben Auftragskarten für Tag, Woche und Liste.
- **Kunden und Team:** `Avatar` mit Initialen auf Pastellgrund (Ton aus dem Namen) in `ListRow`; Suche überall als `SearchField`.
- **Datumsauswahl:** Monatspfeile als `IconButton`.

## Auftragsreiter (Personal, Zeitplan, Küche)

- **Personal:** oben „Besetzung“ (Fortschrittsbalken, drei Zähler-Kreise wie bei Partiful: Besetzt, Bewerbungen, Frei), darunter Schichtkarten. Plätze sind Kreise: besetzt mit Initialen (antippen → Ausplanen / späte Absage), frei gestrichelt mit „+“ (antippen → Person einplanen). Offene Bewerbungen mit runden ✕ (rosa) und ✓ (Petrol). Seltenes hinter „⋯“ je Karte. Neue Schichten über die gestrichelte Zeile „Schicht anlegen“ (Supershift-Muster).
- **Zeitplan:** Zeitleiste – Uhrzeit links, farbige Symbolpunkte auf einer Linie, Art und Notiz rechts.
- **Küche:** gelbe Hinweis-Notiz, Zählerkarte Sonderessen, Einträge mit Anzahl-Kachel.
- Alle Formulare der Reiter sind Blätter von unten; Zahlen werden mit `Stepper` (− / +) gesetzt.

## Auftragsdetail und Formulare

- **Auftragsdetail:** Zusammenfassungskarte (Status, „in n Tagen“, Termin, Kunde, Gäste, Adresse als Kartenlink, Optionsfrist), Angaben als gruppierte Karten mit Trennlinien (`FieldGroup`), Angebotskarte mit Nummer, Summe, Portal-Status und den Aktionen. Bearbeiten oben rechts, Kopieren und Seltenes im „⋯“-Menü, der nächste Status fest unten (siehe Tabelle oben).
- **Formulare:** Speichern steht in der festen Leiste unten, Erfolg meldet ein Toast. `FormSection` bündelt Felder unter einer Überschrift in einer weißen Karte (Auftragsformular: Kunde, Termin, Anlass und Gäste, Ort, Ansprechpartner, Hinweise, Portal; Angebotseditor: Kopfdaten, Kalkulation, Anzahlung).
