---
id: spiegel-account-transfer
type: operation
title: "Spiegel — Abgleich der Konten vor der Übernahme aus Treffsicher"
aliases: [kontenabgleich, account-match, zuordnung-der-konten]
keywords: [vorschau, diary-preview, treffsicher:preview-, entryfromsession, treffsicherdetails, übernahme, treffsicher, konten, e-mail, zuordnung, mapping, csv, transfer, verdacht, levenshtein, stufe 3, personendaten, reports]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-033]]", "[[adr-029]]", "[[adr-002]]"]
---

**TL;DR** `pnpm --filter spiegel transfer:accounts dev|prod` holt die Konten beider Apps als CSV (je Datenbank eine
Abfrage, keine Verbindung dazwischen) und schreibt nach `reports/tis-v1/` einen Bericht und einen Vorschlag der
Zuordnung `zuordnung-<Tag>.csv`. Diese Datei bearbeitet der User; sie ist der Vertrag mit dem CLI, das in Stufe 3 von
[[adr-033]] Konto für Konto übernimmt. Beide Dateien enthalten Namen und E-Mails und bleiben gitignored ([[adr-029]]).

## Gruppen

Die reine Funktion `matchAccounts` (`apps/spiegel/src/lib/transfer/accountMatch.ts`) ordnet jedes Treffsicher-Konto
genau einer Gruppe zu:

- **in beiden:** gleiche E-Mail ohne Groß- und Kleinschreibung; Abweichungen in Rolle und Aktiv-Status stehen im Bericht.
- **Verdacht:** keine gleiche E-Mail, aber ein freies Spiegel-Konto mit gleichem oder ähnlichem Namen (Abstand
  höchstens 2 ab sechs Zeichen, sortiert und in Reihenfolge der Wörter) oder gleichem Teil vor dem @.
- **nur Treffsicher:** das Konto entsteht bei der Übernahme mit seinem Passwort.

Ein über die E-Mail vergebenes Spiegel-Konto ist nie zusätzlich ein Verdacht. Zwei Konten einer App mit derselben
E-Mail brechen den Abgleich ab (die Meldung nennt nur die Zahl).

## Zuordnung als Datei

`from,to,status,reason`, eine Zeile je Treffsicher-Konto, bei einem Verdacht eine je Kandidat. `ok` geht an die gleiche
E-Mail, `check` an den Kandidaten (Merkmale in `reason`), `new` an die eigene E-Mail. `formatMappingCsv` und
`parseMappingCsv` schreiben und lesen sie (Fehler mit Zeilennummer). Was der Leser **nicht** prüft und das CLI aus
Stufe 3 deshalb selbst ablehnen muss: übrig gebliebene `check`-Zeilen und widersprüchliche Zeilen zu einem `from`.

## Zuordnungen für Stufe 3

Erprobt mit dem Vorschau-Werkzeug des Tagebuchs ([[spiegel-diary]], `pnpm --filter spiegel diary-preview`, nur Dev-DB):

- **Scheibe** (`apps/spiegel/src/lib/transfer/treffsicher-card.ts`, rein): `familyForName` (Name der Treffsicher-Disziplin
  gleich dem der Familie, ohne Groß- und Kleinschreibung, genau eine), `disciplineForShots` (Disziplin der ersten Anlage
  mit derselben Schusszahl, bei mehreren die meistgenutzte des Kontos, sonst keine), `treffsicherDetails`
  (Wertungsserien mit Wert neu nummeriert; Einzelschüsse nur, wenn jede Serie sie hat und ihre Summe zum Wert passt,
  sonst Serien-Summen; Probeserien als Probe; Trefferlage mit Richtung).
- **Eintrag** (`apps/spiegel/src/diary/transfer/treffsicher-entry.ts`, rein): `entryFromSession` (Abend, Art, Vorhaben aus
  Trainingsziel oder Leistungsziel, „Hat es geklappt?“ nur mit Vorhaben, Erkenntnis, Lernfrage, Notiz mit Überschriften
  je übrigem Feld, Werte genau wie gespeichert) und `executionsOnCard` (Ausführung je Wertungsserie auf die Serien der
  Scheibe, nur bei gleicher Zahl). Geschrieben über `src/diary/transfer/write.ts` (anlegen oder über den Schlüssel
  ersetzen).
- **Schlüssel der Vorschau:** Scheiben `treffsicher:preview-<Einheit>` (`IMPORT_KEY` nimmt nur `treffsicher:…`),
  Tagebuch `preview:<Einheit>`. Stufe 3 löscht die Vorschau vorher (`--delete`) oder lässt `treffsicher:preview-` beim
  Zählen aus. Zwei Einheiten an einem Abend bekommen keine Scheibe von selbst; dafür braucht Stufe 3 eine Regel.

## Fallstricke

- Ein zweiter Lauf am selben Tag bricht ab, solange `zuordnung-<Tag>.csv` existiert: Sonst überschriebe er die
  Bearbeitung des Users. Umbenennen oder löschen, dann neu laufen lassen.
- `prod` läuft über `ssh` mit `VPS_HOST` und `VPS_REPO_PATH` aus `.vereinsheim.local` und nur durch den User.
- Spalten der SQL und des Parsers sind über feste Listen gekoppelt: Eine umbenannte Spalte ist ein Fehler, keine
  stille 0.
