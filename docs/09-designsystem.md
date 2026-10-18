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
