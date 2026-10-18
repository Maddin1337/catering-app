# Designsystem (Überarbeitung Oktober 2026)

Gilt für Team-App und Kundenportal. Die Werte stehen in `src/theme/tokens.ts`, die Bausteine in `src/components/ui/`. Grundlage ist eine Recherche im Appllama-Katalog (Tiimo, Todoist, Fantastical, Invoice Maker, Splitwise u. a.); abgeleitet wurden Muster, kein Bildmaterial.

## Leitlinien

- **Warme Fläche, weiße Karten:** Seitenhintergrund `canvas` (#F6F4F0), Inhalte auf weißen Karten (`Surface`, `surfaceStyle()`), abgehoben durch weiche, warm getönte Schatten statt harter Rahmen.
- **Große, kräftige Titel:** Überschriften in Plus Jakarta Sans (Bold/ExtraBold), Fließtext und Bedienung in Inter. Das Gewicht steckt weiter in der Schriftfamilie (kein `fontWeight`).
- **Runde Formen:** Schaltflächen, Chips, Reiter und die Tab-Leiste sind Pillen (`radius.full`); Karten 22, Felder 16, Blätter 28.
- **Eine Hauptaktion pro Ansicht:** `Button variant="primary"` (Petrol-Verlauf mit farbigem Schatten). `dark` (Tinte) für starke Zweitaktionen, `secondary` (weiß), `tonal`, `ghost`, `danger` (rosa Fläche, roter Text).
- **Spürbares Tippen:** `PressableScale` federt beim Drücken leicht ein (Reanimated; folgt „Bewegung reduzieren“), `Button` löst auf dem Gerät ein leichtes Haptik-Signal aus (Web: keins).
- **Schlanke, schwebende Tab-Leiste:** `FloatingTabBar` – 58 px hoch, Symbol über kleiner Beschriftung (11 px), der aktive Tab liegt in einer weichen Petrol-Kapsel. Die Leiste belegt Platz im Layout, es wird nichts verdeckt; am unteren Rand rückt sie nah an die Home-Anzeige.
- **Reiter auf Detailseiten:** `SegmentedTabs` (graue Spur, aktive weiße Pille) ersetzt die Unterstreich-Reiter (Auftrag, Team, Katalog).
- **Leere Zustände:** `EmptyState` mit runder Symbol-Plakette; Einstiegskarten (`ActionCard`) mit pastellfarbener Plakette (`tints`).
- **Hinweise:** `Banner` mit Symbol und getönter Fläche, ohne Rahmen. Auswahlblätter (`PickerSheet`) fahren von unten ein, mit Griff und abgedunkeltem Hintergrund (`color.scrim`).

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

## Startseite (Admin)

Aufbau von oben nach unten, nach Mustern aus Appllama (Decory, Joule, Fantastical, MileIQ, Gridwise, Xmind): Begrüßung mit Vorname und Datum, Wochenleiste (7 Tage, Punkt bei Aufträgen, heute dunkel), Hero-Karte „Als Nächstes“ (nächster optionierter oder bestätigter Auftrag mit Termin, Ort, Gästen, Status und „in n Tagen“), Fortschrittskarte „Erste Schritte“ (nur solange offen), zwei Schnellaktionen (Anfrage im Chat, Schnelles Formular), „Auf einen Blick“ (Aufträge und Gäste der nächsten 7 Tage, offene Anfragen, Angebote ohne Antwort), „Zu erledigen“ mit farbigen Symbol-Plaketten, „Heute und morgen“ als Tagesliste mit Uhrzeit. Admins sehen außerdem die Karte „Auftragswert“ (siehe unten).

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

## Auftragsdetail und Formulare

- **Auftragsdetail:** Zusammenfassungskarte (Status, „in n Tagen“, Termin, Kunde, Gäste, Adresse als Kartenlink, Optionsfrist), Angaben als gruppierte Karten mit Trennlinien (`FieldGroup`), Angebotskarte mit Nummer, Summe, Portal-Status und den Aktionen, Bearbeiten und Kopieren nebeneinander.
- **Formulare:** `FormSection` bündelt Felder unter einer Überschrift in einer weißen Karte (Auftragsformular: Kunde, Termin, Anlass und Gäste, Ort, Ansprechpartner, Hinweise, Portal; Angebotseditor: Kopfdaten, Kalkulation, Anzahlung).
