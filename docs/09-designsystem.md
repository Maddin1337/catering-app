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

## Bencho-Bausteine (Oktober 2026, dritte Runde)

Nachbauten für React Native nach frei lizenzierten Blöcken aus Bencho (bencho.dev, MIT, © 2026 Lorenzo Cabra; Lizenztext in `THIRD_PARTY_NOTICES.md`). Übernommen wurde die Idee und die Bewegung, nicht der Web-Code: Gesten mit `PanResponder`, Federn und Übergänge mit Reanimated, Haken mit `react-native-svg`. Jede Datei nennt im Kopf ihr Vorbild.

| Baustein | Wo in der App | Was er tut |
|---|---|---|
| `SlideToConfirm` (`slide-to-confirm`) | Statuswechsel im Auftrag (rot bei Absagen/Stornieren), „Alle als durchgeführt markieren“ | Griff folgt dem Finger, löst erst am Ende der Bahn aus, entfaltet sich dann über die Bahn, Pfeil wird zum Haken, Kreisel während des Speicherns. Schlägt die Aktion fehl, rollt er zurück. Bildschirmleser bestätigen über die Standardaktion. |
| `SwitchRow` (`liq-toggle`) | Ja/Nein-Einstellungen in Formularen (Abholung, Optionen einrechnen, Sonderessen mitkopieren, Pflichtfrage, pro Gast, Standard-Steuersatz …) | Daumen dehnt sich auf halbem Weg wie ein Tropfen; die ganze Zeile schaltet. Auswahl aus mehreren Dingen und Einwilligungen bleiben Kästchen. |
| `Checkbox` (`checklist`) | überall, wo Kästchen bleiben; Einkaufsliste mit `strike` | Haken wird gezeichnet, Fläche federt, erledigte Einträge werden durchgestrichen. |
| `TextField` (`label-input`) | alle Formulare | Beschriftung sitzt im Feld und hebt sich beim Tippen nach oben; Fehler schütteln das Feld kurz. |
| `CodeInput` (`one-time-code`) | E-Mail bestätigen, Passwort zurücksetzen (nur mit Code-Modus) | sechs Kästchen, blinkender Cursor, Ziffern springen hinein; Einfügen und iOS-Codevorschlag funktionieren (`oneTimeCode`). Beim Bestätigen wird nach der 6. Ziffer automatisch gesendet. |
| `SearchToggle` (`seek`) | Aufträge, Kunden, Gerichte, Zutaten | Die Lupe wird selbst zum Suchfeld, die Filter-Chips daneben treten zur Seite. |
| `CreateMorph` (`liq-create`) | „+“ in der Tab-Leiste (Admin) | Das Menü wächst aus dem Knopf, Petrol geht in Weiß über, Einträge kommen gestaffelt. |
| `ToastHost` (`toast-stack`) | alle Rückmeldungen | Mehrere Meldungen stapeln sich (höchstens drei), Tippen fächert den Stapel auf. |
| `AvatarStack` (`picker`) | Auftragsdetail, Zusammenfassung | Gesichter der eingeplanten Personen überlappend in einer Pille, ab vier „+n“. |
| `LiveIsland` (`dynamic-island`) | Start (Admin), Heute (Küche), Meine Schichten (Personal) | Schwarze Pille, solange ein Auftrag/eine Schicht läuft oder in den nächsten 3 Stunden beginnt: pulsierender Punkt, Restzeit; Tippen klappt Zeit, Ort, Fortschritt und „Öffnen“ auf. Logik in `src/features/start/live.ts` (getestet). |
| Scrubbing in `RevenueCard` (`stacked-bars`) | Start (Admin), Auftragswert | Finger über die Balken wählt einen Monat; Zahl, Titel und Zeilen zählen auf diesen Monat um, ein Lichtkasten gleitet mit, die anderen Balken treten zurück. |

**Bewusst nicht übernommen:** alle Pro-Blöcke (andere Lizenz) und Blöcke, die auf dem Handy von Maus-Hover leben oder in dieser App keinen passenden Einsatzort haben (z. B. Partikel, Augen, Dock, Münze, Fluchtknopf, Klangflächen, Bildvergleich, Unterschrift, Sprachnotiz).

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
| Schieben zum Bestätigen, Schalter, Kästchen | `slide-to-confirm.tsx`, `switch.tsx`, `checkbox.tsx` |
| Feld mit schwebender Beschriftung, Code-Kästchen, ausklappende Suche | `text-field.tsx`, `code-input.tsx`, `search-toggle.tsx` |
| Anlegen-Menü aus dem „+“, Gesichter-Stapel | `create-morph.tsx`, `avatar-stack.tsx` |
| Live-Insel, Auftragswert | `src/features/start/components/live-island.tsx`, `revenue-card.tsx` |

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

- **Auftragsliste:** ausklappende Suche (`SearchToggle`) neben den Art-Chips, Segmente Anstehend/Vergangen/Archiv, Aufträge nach Monat gruppiert (`groupByMonth`), Karten `EventListItem` mit Datumskachel, Zeit, Gästen, Kunde und Status.
- **Kalender:** Segmente Monat/Woche/Liste, Monatskarte mit runden Tagen (gewählter Tag dunkel, heute mit Ring, Punkte in Statusfarbe), runde Pfeilknöpfe (`IconButton`), dieselben Auftragskarten für Tag, Woche und Liste.
- **Kunden und Team:** `Avatar` mit Initialen auf Pastellgrund (Ton aus dem Namen) in `ListRow`; Suche auf Kunden, Gerichten und Zutaten als `SearchToggle`, in Auswahlblättern weiter als `SearchField`.
- **Datumsauswahl:** Monatspfeile als `IconButton`.

## Auftragsreiter (Personal, Zeitplan, Küche)

- **Personal:** oben „Besetzung“ (Fortschrittsbalken, drei Zähler-Kreise wie bei Partiful: Besetzt, Bewerbungen, Frei), darunter Schichtkarten. Plätze sind Kreise: besetzt mit Initialen (antippen → Ausplanen / späte Absage), frei gestrichelt mit „+“ (antippen → Person einplanen). Offene Bewerbungen mit runden ✕ (rosa) und ✓ (Petrol). Seltenes hinter „⋯“ je Karte. Neue Schichten über die gestrichelte Zeile „Schicht anlegen“ (Supershift-Muster).
- **Zeitplan:** Zeitleiste – Uhrzeit links, farbige Symbolpunkte auf einer Linie, Art und Notiz rechts.
- **Küche:** gelbe Hinweis-Notiz, Zählerkarte Sonderessen, Einträge mit Anzahl-Kachel.
- Alle Formulare der Reiter sind Blätter von unten; Zahlen werden mit `Stepper` (− / +) gesetzt.

## Mitteilungen

Glocke (`NotificationBell`) rechts in der Kopfleiste der Startseiten; das rote Abzeichen springt beim Eintreffen neuer Mitteilungen mit einer Feder herein. Die Seite gruppiert nach „Heute“ und „Früher“, ungelesene Zeilen haben einen hellen Petrol-Grund und einen Punkt, jede Art hat ein eigenes Symbol und einen eigenen Ton.

## Auftragsdetail und Formulare

- **Auftragsdetail:** Zusammenfassungskarte (Status, „in n Tagen“, Termin, Kunde, Gäste, Adresse als Kartenlink, Optionsfrist), Angaben als gruppierte Karten mit Trennlinien (`FieldGroup`), Angebotskarte mit Nummer, Summe, Portal-Status und den Aktionen. Bearbeiten oben rechts, Kopieren und Seltenes im „⋯“-Menü, der nächste Status fest unten (siehe Tabelle oben).
- **Formulare:** Speichern steht in der festen Leiste unten, Erfolg meldet ein Toast. `FormSection` bündelt Felder unter einer Überschrift in einer weißen Karte (Auftragsformular: Kunde, Termin, Anlass und Gäste, Ort, Ansprechpartner, Hinweise, Portal; Angebotseditor siehe unten).

## Angebotseditor (Oktober 2026, neu aufgebaut)

Vorbilder aus Appllama: Wave (Kartenaufbau, Einstellungen als Zeilen mit Wert), Joist („Ordnen“ statt Pfeilen an jeder Zeile, Rabatt und Anzahlung als Zeilen in der Summe), Invoice Fly und Invoice Maker (Positionszeile „Menge × Preis“, Betrag rechts, feste Hauptaktion unten), Eato und Instacart (Auswahlblatt mit Suche und „+“ an der Zeile). Übernommen wurden Muster, kein Bildmaterial.

Grundsatz: Die Seite zeigt nur Positionen und Summe. Alles andere öffnet ein Blatt, und jede Zeile nennt ihren aktuellen Wert.

| Bereich | Inhalt |
|---|---|
| Kopfleiste | Zurück (speichert), Speicherstand als Pille: „Gespeichert“, „Speichert …“, „Nicht gespeichert“ |
| Gültigkeit | Zeile „Gültig bis …“ mit Referenz darunter → Blatt „Gültigkeit und Referenz“ |
| Positionen | Karten mit Symbol der Art, Bezeichnung, „80 Gäste × 24,50 €“ und Betrag (vor Gesamtrabatt). Zwischenüberschriften als Abschnittstitel. „Ordnen“ blendet Pfeile ein. Tippen → Blatt „Position bearbeiten“ |
| Position hinzufügen | gestrichelte Zeile → Blatt in Schritten (siehe unten) |
| Kalkulation und Summe | Zeilen Kalkulation (Preise netto/brutto, Pauschal oder Aufschlag, Wareneinsatz und Rohertrag im Blatt), Rabatt, Anzahlung; darunter die Summenaufstellung |
| Texte | eine Zeile → Blatt mit Einleitung, Bedingungen, Schluss |
| Leiste unten | Summe (netto oder brutto je Anzeige, zählt mit) und „Weiter zum Versand“ |

**Position hinzufügen (`AddItemSheet`):**
1. Katalog: Reiter Pakete | Gerichte | Vorlagen mit Suche. Das runde „+“ fügt sofort hinzu (Pakete und Gerichte pro Gast, Katalogpreis), ein Toast bestätigt, das Blatt bleibt für weitere offen („Fertig · 2 hinzugefügt“). Tippen auf die Zeile führt zu Schritt 3.
2. Ohne Katalog: „Freie Position“ fragt nur nach der Art (Personal, Getränke, Equipment, Anfahrt, Frei); „Zwischenüberschrift“ fragt nur nach dem Text.
3. Menge und Preis: dieselben Felder wie beim Bearbeiten.

**Felder einer Position (`ItemFields`):** Bezeichnung; Menge als Umschalter „Pro Gast (80) | Feste Anzahl“; bei Personal die Stunden; Preis mit Vorschlag aus dem Wareneinsatz als Chip; darunter „Ergibt 80 × 24,50 € = 1.960,00 €“. Zugeklappt unter „Weitere Optionen“ (die Zeile nennt, was eingestellt ist): Steuersatz als Chips, Beschreibung, Einheit, Rabatt, Wahlgruppe mit „gewählt“, „Kunde darf die Menge ändern“. Fehlt der Steuersatz, ist der Bereich offen. Im Bearbeiten-Blatt zusätzlich Duplizieren und Entfernen.

Logik getestet in `src/features/quotes/item-draft.ts` (Eingaben, Prüfung, Zeilenrechnung) und `editor-doc.ts` (Rabatt, Anzahlung, Zeilenwerte).

## Anfrage-Chat (Oktober 2026, neu aufgebaut)

Vorbilder aus Appllama: Yazio, ZOE, Wispr Flow, Cooklist, Sidekick (eine Frage pro Bildschirm, große Frage, feste Aktion unten), Cooklist (Zähler mit − und +), Numify und Down Dog (Zusammenfassung als Zeilen), Rabby Wallet (Erfolgsmoment). Übernommen wurden Muster, kein Bildmaterial. Die Fragen selbst kommen weiter aus dem eigenen Fragenkatalog (Mehr → Einstellungen → Angebote & Anfragen → Fragenkatalog); Logik und Datenmodell sind unverändert.

| Teil | Umsetzung |
|---|---|
| Kopf | runder Zurück-Knopf (bei der ersten Frage nur Platz), gleitender Fortschrittsbalken, ✕ zum Verwerfen (mit Rückfrage) |
| Frage | kleine Bereichszeile in Versalen (Kunde, Art der Anfrage, Termin, Gäste, Ort, Küche, Weitere Angaben – hängt an der Zuordnung, springt also nicht mit der Fragenzahl), Frage groß (28 pt), Hilfetext darunter |
| Übergang | der Schritt gleitet von rechts herein, beim Zurückgehen von links; „Zurück“ zeigt die frühere Antwort wieder |
| Unten fest | „Weiter“ (erst aktiv bei gültiger Antwort), bei freiwilligen Fragen „Überspringen“ darunter |

**Antworteingaben (`StepInput`):** Auswahl und Ja/Nein als große Karten mit Haken, die Karte bleibt kurz markiert, dann geht es von selbst weiter (`OptionCard`); Mehrfachauswahl mit Kästchen und „Weiter“; Zahl groß in der Mitte mit − und + (bei Gästezahl Schnellwahl 20 bis 100; die Zahl lässt sich auch eintippen); Datum und Uhrzeit als große Karten mit Symbol (`PickCard`, `variant="card"` an `DateField`/`TimeField`), beim Beginn Schnellwahl 12, 17, 18, 19 Uhr; Text mit schwebender Beschriftung; Kunde mit Suche, Trefferzeilen mit Initialen und „als neuen Kunden anlegen“.

**Zusammenfassung „Alles korrekt?“:** dunkle Karte mit Kunde, Termin, Gästen und Ort; darunter Zeilen in Gruppen (Anfrage, Termin und Ort, Küche und mehr). Ein Tipp auf eine Zeile springt zur Frage und danach direkt zurück; Hinweise und Notizen erscheinen als Frage und Antwort. Fehlende Pflichtangaben sind rosa markiert („Fehlt“). Titel zum Anpassen, feste Aktion „Anfrage anlegen“.

**Abschluss:** Petrol-Kreis springt herein, der Haken zeichnet sich, Erfolgs-Haptik, dann öffnet sich der Auftrag mit seinem Angebot (`CreatedOverlay`).

Ablauflogik getestet in `src/features/intake/flow.ts` (nächste Frage, Zurück, Fortschritt, Zeilen der Zusammenfassung).
