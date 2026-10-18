# Testanleitung für den Gründer

Stand: Meilensteine M1 bis M8 (Kern). Alles läuft auf `https://catering-app-livid.vercel.app` und auf dem Handy (Browser oder Expo Go).

## 1. Zuerst: die SQL-Updates einspielen

Im Supabase-Dashboard unter **SQL Editor** jede Datei **genau einmal** einfügen und ausführen, **in dieser Reihenfolge**. Eine bereits eingespielte Datei nicht noch einmal ausführen (Fehler „already exists“ ist dann normal und harmlos, es ändert sich nichts).

| Reihenfolge | Datei in `supabase/` | Wofür |
|---|---|---|
| 1 | `remote-update-20261021090000.sql` | Team, Einladungen |
| 2 | `remote-update-20261022090000.sql` | Gerichte, Zutaten, Pakete |
| 3 | `remote-update-20261023090000.sql` | Kunden, Aufträge, Kalender, Küche |
| 4 | `remote-update-20261024090000.sql` | Angebots-Chat, eigene Fragen |
| 5 | `remote-update-20261025090000.sql` | Angebote (Entwurf) |
| 6 | `remote-update-20261026090000.sql` | Angebot beim Kopieren mitnehmen |
| 7 | `remote-update-20261027090000.sql` | Angebot versenden, Fassungen, Links |
| 8 | `remote-update-20261028090000.sql` | Kundenportal |
| 9 | `remote-update-20261029090000.sql` | Küche aus dem verbindlichen Stand |
| 10 | `remote-update-20261030090000.sql` | Schichtbörse |
| 11 | `remote-update-20261031090000.sql` | Menüwahl im Portal |
| 12 | `remote-update-20261101090000.sql` | Firmenlogo (Speicher) |
| 13 | `remote-update-20261102090000.sql` | Sonderessen im Portal |
| 14 | `remote-update-20261103090000.sql` | Korrekturen aus der Sicherheitsprüfung |

Meldet die App „Die Datenbank ist noch nicht auf dem neuesten Stand“, fehlt eine dieser Dateien. **Einstellungen → Datenbank-Stand** zeigt, welche.

## 2. Rundgang

1. **Anfrage aufnehmen:** Start → „Neue Anfrage“ (Chat). Eine Hochzeit komplett durchgehen, die Folgefrage „Sektempfang?“ erscheint nur bei „Hochzeit“.
2. **Angebot bauen:** Auftrag öffnen → „Angebot“. Paket und Gericht aus dem Katalog hinzufügen, Personal (z. B. 3 × 6,5 h × 32 €), Rabatt 5 %. Die Summen müssen mit deiner eigenen Rechnung stimmen (USt je Satz). Unter Einstellungen → Angebotstexte Positionsvorlagen anlegen und im Angebot wiederfinden.
3. **Senden:** „Weiter zum Versand“ → Prüfliste lesen → „Nur Link erzeugen“. Das PDF über „PDF erstellen“ ansehen (im Browser: Druckdialog → „Als PDF speichern“).
4. **Portal:** Den Link auf dem Handy öffnen (am besten im mobilen Netz). Angebot lesen, „Verbindlich annehmen“. Danach im Auftrag: Status „Bestätigt“, Hinweis „Angenommen von …“.
5. **Änderung:** Im Portal „Änderung wünschen“ (neue Gästezahl, Nachricht). Unter „Sonderessen und Allergien“ im Portal einen Eintrag anlegen (er erscheint sofort im Tab „Küche“ des Auftrags). Im Auftrag erscheint der Wunsch, auf der Startseite die Karte „Änderungswunsch“. Angebot anpassen, „Neue Fassung senden“, Wunsch „erledigt“.
6. **Küche:** Mehr → Küchenplanung. Zeitraum wählen, Produktion, Sonderessen und Einkauf prüfen. Bei einem Sonderessen unter „Küche“ im Auftrag ein Ersatzgericht eintragen.
7. **Logo:** Einstellungen → Branding → Logo wählen. Es erscheint im PDF und im Portal.
8. **Personal:** Im Auftrag Tab „Personal“ → Schicht anlegen (Qualifikation wählen), veröffentlichen. Mit einer eingeladenen Aushilfe: Schichtbörse → „Bewerben“; du sagst zu; „Meine Schichten“ zeigt jetzt Adresse und Ansprechpartner.

## 3. Was bewusst noch fehlt

- E-Mails verschickt die App nicht selbst. „Per E-Mail senden“ öffnet deine E-Mail-App mit fertigem Text und Link; das PDF hängst du selbst an (E-Mail-Dienst folgt, E-3).
- Push-Nachrichten, Offline-Speicher, Abo und Bezahlung, Excel-Import, Kalender-Abo (iCal).

## 4. Fehler melden

Bitte mit Bildschirmfoto, Uhrzeit und der Fehlermeldung (steht meist in einem roten Kasten, oft mit einem Code in Klammern).
