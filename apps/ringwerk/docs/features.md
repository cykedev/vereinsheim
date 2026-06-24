# Funktionale Anforderungen – Ringwerk

---

## Rollen & Berechtigungen

| Rolle                 | Berechtigungen                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administrator (ADMIN) | Vollzugriff: Nutzerverwaltung, Wettbewerbe, Teilnehmer, Force-Delete                                                                              |
| Manager (MANAGER)     | Wettbewerbe erstellen/verwalten, Ergebnisse erfassen, Teilnehmer/Disziplinen verwalten — **kein** Zugriff auf Nutzerverwaltung, kein Force-Delete |
| Benutzer (USER)       | Ergebnisse und Tabellen einsehen (read-only)                                                                                                      |
| Gastteilnehmer        | Nimmt an einzelnen Events teil; kein Login erforderlich                                                                                           |

### Berechtigungsmatrix

| Aktion                              | ADMIN | MANAGER  | USER |
| ----------------------------------- | ----- | -------- | ---- |
| Wettbewerbe erstellen/bearbeiten    | Ja    | Ja       | Nein |
| Ergebnisse erfassen/korrigieren     | Ja    | Ja       | Nein |
| Teilnehmer verwalten                | Ja    | Ja       | Nein |
| Disziplinen verwalten               | Ja    | Ja       | Nein |
| Playoffs starten/verwalten          | Ja    | Ja       | Nein |
| Wettbewerb archivieren/abschliessen | Ja    | Ja       | Nein |
| Audit-Log einsehen                  | Ja    | Ja       | Nein |
| **Nutzerverwaltung** (/admin/\*)    | Ja    | **Nein** | Nein |
| **Force-Delete**                    | Ja    | **Nein** | Nein |
| **Rollen zuweisen**                 | Ja    | **Nein** | Nein |
| Ergebnisse/Tabellen ansehen         | Ja    | Ja       | Ja   |

---

## Disziplinen

- Mehrere Disziplinen parallel verfuegbar
- Parameter je Disziplin: Name, Kuerzel, Wertungsart (Ganz-/Zehntelringe), Max.Ringe/Schuss, teilerFaktor
- **teilerFaktor: Decimal(4,3)** mit Default 1.0 — Korrekturfaktor fuer gemischte Wertungen
  - Gueltige Range: 0.001 bis 9.999 (min. 0.001, max. 9.999)
  - Wird beim Erstellen/Bearbeiten in der UI als "Teiler-Faktor" angezeigt
  - In Disziplin-Listen: Badge mit "Faktor X.XXX" (z.B. "Faktor 0.333")
- Vorinstallierte Systemdisziplinen (automatisch angelegt beim ersten Start):

| Kuerzel | Name                | Wertungsart  | teilerFaktor    |
| ------- | ------------------- | ------------ | --------------- |
| LP      | Luftpistole         | Ganzringe    | 0.333 (/3)      |
| LG      | Luftgewehr          | Ganzringe    | 1.0             |
| LPA     | Luftpistole Auflage | Zehntelringe | 0.6 (/3 \* 1.8) |
| LGA     | Luftgewehr Auflage  | Zehntelringe | 1.8             |

- Admin: Disziplinen anlegen, bearbeiten, Faktor konfigurieren
- Loeschen nur ohne Wettbewerbsergebnisse; sonst **archivieren**
- Disziplin-Faktor jederzeit aenderbar (Aenderung wirkt auf zukuenftige Berechnungen)

---

## Wettbewerbe

### Überblick

Ringwerk kennt drei Wettbewerbstypen. Alle teilen dieselbe Scoring-Engine und den Teilnehmerpool.

| Typ                 | Ablauf                                        | Ergebnis                                     |
| ------------------- | --------------------------------------------- | -------------------------------------------- |
| **Liga** (LEAGUE)   | Spielplan → Gruppenphase → Tabelle → Playoffs | Meister + Platzierungen                      |
| **Event** (EVENT)   | Anmeldung → Schiessen → Rangliste             | Rangliste (ggf. mit Zielwert)                |
| **Saison** (SEASON) | Serien über Monate → Auswertung               | Mehrfach-Ranking (Ringe, Teiler, Ringteiler) |

**Dashboard-Integration:** Das Dashboard unterteilt aktive Wettbewerbe nach Typ:

- **Liga:** Interaktive Tabelle + K.O.-Bracket
- **Event & Saison:** Separate Ranglisten mit Links zu den Detailseiten
- **Saison:** Zeigt zusätzlich Saisonzeitraum und Serien-Fortschritt

### Gemeinsame Konfiguration

Jeder Wettbewerb hat:

- **Name** und **Status** (Entwurf → Aktiv → Abgeschlossen → Archiviert)
- **Wertungsmodus** (ScoringMode) — bestimmt wie Ergebnisse verglichen werden
- **Schusszahl pro Serie** (default 10, konfigurierbar, z.B. 5 für Kurz-Kranzl)
- **Disziplin** — fix (alle schießen dieselbe) oder **gemischt** (jeder wählt seine Disziplin, Faktor-Korrektur aktiv)

**SEASON-spezifisch:** Nur RINGS, RINGS_DECIMAL, TEILER und RINGTEILER als Wertungsmodi verfügbar (TARGET-Modi sind auf Event beschränkt).

### Wertungsmodi (Scoring-Engine)

| Modus           | Formel                                 | Gewinner    | Faktor              |
| --------------- | -------------------------------------- | ----------- | ------------------- |
| RINGTEILER      | MaxRinge - Ringe + (Teiler \* Faktor)  | Niedrigster | Ja                  |
| RINGS           | Gesamtringe (ganzzahlig)               | Höchster    | Nein                |
| RINGS_DECIMAL   | Gesamtringe (Zehntelwertung)           | Höchster    | Nein                |
| TEILER          | Teiler \* Faktor                       | Niedrigster | Ja                  |
| DECIMAL_REST    | Nachkommastelle der Ringe summiert     | Höchster    | Nein                |
| TARGET_ABSOLUTE | Abweichung vom Zielwert                | Geringste   | Wenn Teiler-basiert |
| TARGET_UNDER    | ≤ Zielwert bevorzugt, dann Abweichung  | Geringste   | Wenn Teiler-basiert |
| TARGET_OVER     | >= Zielwert bevorzugt, dann Abweichung | Geringste   | Wenn Teiler-basiert |

Formeln und Details: siehe `data-model.md` → Berechnungsregeln.

---

## Liga-Modus (LEAGUE)

### Konfiguration

Eine Liga ist an **eine Disziplin gebunden** (oder gemischt mit Faktor-Korrektur).
Konfigurierbare Regelsets pro Liga:

| Parameter               | Default    | Beschreibung                                                        |
| ----------------------- | ---------- | ------------------------------------------------------------------- |
| scoringMode             | RINGTEILER | Wertung Gruppenphase                                                |
| shotsPerSeries          | 10         | Schuss pro Seite                                                    |
| playoffBestOf           | 3          | Siege zum Weiterkommen (3 = Best-of-Five)                           |
| playoffHasViertelfinale | true       | VF aktiviert (8 Qualifikanten); false = direkt HF (4 Qualifikanten) |
| playoffHasAchtelfinale  | false      | AF aktiviert (16 Qualifikanten)                                     |
| finalePrimary           | RINGS      | Hauptkriterium Finale (Pflicht)                                     |
| finaleTiebreaker1       | —          | Erstes Tiebreaker-Kriterium bei Gleichstand (optional)              |
| finaleTiebreaker2       | —          | Zweites Tiebreaker-Kriterium bei weiterem Gleichstand (optional)    |
| finaleHasSuddenDeath    | true       | Sudden Death bei verbleibendem Gleichstand nach allen Kriterien     |

Das Regelset wird **phasenweise gesperrt**: Gruppenphase/Format (Format, Wertungsmodus, Best-of, Schuss/Serie) sind **nach Spielplan-Generierung gesperrt**; die **Playoff-/Finale-Einstellungen** (Best-of, Viertel-/Achtelfinale, Finale-Kriterien) bleiben editierbar, **bis die Playoffs gestartet sind** (`playoffMatch.count > 0`). So lässt sich z. B. eine falsch gewählte Bracket-Größe noch korrigieren, bevor die K.-o.-Phase läuft.

### Spielplan-Generierung

- **Doppelrunden-Spielplan (Round Robin):** Hin- und Rückrunde
- Rückrunde spiegelt Hinrunde (Heimrecht getauscht)
- Ungerade Teilnehmerzahl → jeder bekommt einmal Freilos (2 Punkte)
- Mindest-Teilnehmerzahl: 4
- Regenerierung möglich solange keine abgeschlossenen Paarungen
- **Non-LEAGUE-Navigierung:** Wenn auf `/competitions/[id]/schedule` mit Event/Saison zugegriffen wird → Automatisches Redirect zu `/competitions/[id]/ranking`

### Heimrecht

- Zuerst genannte Person ist verantwortlich für Terminabsprache
- Mehrere Duelle an einem Abend möglich
- **Kein Vorschiessen** — beide Schützen müssen nebeneinander am Stand antreten

### Ergebniserfassung (Liga)

- Pro Paarung: beide Teilnehmer schießen je eine Serie
- **Pflichtfelder:** Gesamtringe + bester Teiler pro Teilnehmer
- **Optional:** Einzelschusswerte (Schuss 1–N) für Statistiken
- Automatische Berechnung des Ringteilers
- Nachträgliche Korrektur: nur durch Admin oder Schiedsrichter (AuditLog)
- **Live-Anzeige korrigierter Teiler:** Wird der Teiler-Wert eingegeben und ist `teilerFaktor ≠ 1.0`, erscheint direkt unter dem Eingabefeld ein Hint mit dem korrigierten Teiler (`Teiler × Faktor`). Gilt unabhängig für Heim und Gast.

### Validierungsregeln

| Wertungsart  | Gültige Einzelwerte                                      |
| ------------ | -------------------------------------------------------- |
| Ganzringe    | 0–10, ganzzahlig                                         |
| Zehntelringe | 0.0 oder 1.0–10.9 (eine Dezimalstelle; 0.1–0.9 ungültig) |

- Seriensumme ≤ Schussanzahl × Max.Ringe/Schuss
- Teiler: 0.0–9999.9 (Dezimalwert)

### Tabelle & Rangliste

Sortierung absteigend:

1. Punkte
2. Direkter Vergleich (bei Punktgleichstand)
3. Bestes individuelles Ergebnis (niedrigster Ringteiler)

Anzeigespalten: Pl., Name, Spiele, Siege, Niederlagen, Punkte, bestes Ergebnis
Zurückgezogene Teilnehmer → Tabellenende mit Vermerk

### Playoff-Phase (K.O.-System)

#### Qualifikation

| Teilnehmer | Qualifikanten      | Einstieg      |
| ---------- | ------------------ | ------------- |
| 4–7        | Top N1 (default 4) | Halbfinale    |
| 8–15       | Top N2 (default 8) | Viertelfinale |
| 16+        | Top 16             | Achtelfinale  |

`playoffHasAchtelfinale` (default: false) aktiviert das Achtelfinale (16 TN, 8 Paarungen, Seeding 1 vs. 16, 2 vs. 15 usw.).

Seeding: 1 vs. letzter, 2 vs. vorletzter, usw.

#### Start-Voraussetzungen

- Wettbewerb muss ACTIVE sein
- Playoffs noch nicht gestartet
- Mindestens 4 aktive Teilnehmer
- Keine PENDING-Paarungen in der Gruppenphase

#### Best-of-N (VF & HF)

- Wer zuerst `playoffBestOf` Duelle gewinnt, zieht weiter (default 3 = Best-of-Five)
- Pro Duell: eine Serie je Teilnehmer, Wertung gemäß `scoringMode`
- Bei Unentschieden: nächstes Duell wird automatisch angelegt
- Admin legt jedes Duell manuell an

#### Rundenfortschritt

- Nach Abschluss aller Matches: Admin löst nächste Runde manuell aus
- Re-Seeding nach Original-Gruppenrang

#### Finale (Sondermodus)

| Regel            | Beschreibung                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| Wertung          | Kette: `finalePrimary` → `finaleTiebreaker1` → `finaleTiebreaker2` (default: nur Ringe, höchste gewinnt) |
| Gleichstand      | Wenn nach allen Kriterien noch Gleichstand und `finaleHasSuddenDeath`: weiteres Duell bis Entscheid      |
| Einrichtungszeit | 3 Minuten                                                                                                |
| Probeschuss      | Keiner                                                                                                   |
| Ansage           | Jeder Schuss einzeln                                                                                     |
| Zeit pro Schuss  | 75 Sekunden                                                                                              |

App-Umfang: **nur Ergebniserfassung** (keine Zeitnahme oder Ansage-Unterstützung)

#### Korrekturen & Löschungen

- **canCorrect-Flag:** Korrekturen erlaubt solange Folgerunde keine Duelle hat
- Korrektur: Siegstand wird neu berechnet; leere Folge-Matches kaskadierend gelöscht
- Löschen des letzten Duells: nur bei canCorrect

#### Guards

- **Rueckzug:** nach Playoff-Start gesperrt
- **Spielplan-Editierung:** nach Playoff-Start gesperrt

### Meyton-Import

- **Via URL:** System ruft Meyton-URL ab, parst Ergebnis
- **Via PDF-Upload:** Textbasiertes PDF, kein OCR
- Sicherheitsgrenzen: Timeout 15s, max. 10 MB; PDF max. 2 MB/Stream, 8 MB gesamt (nur bei Liga)

---

---

## Liga-Modus BEST_OF_SINGLE ✓ IMPLEMENTIERT

### Konzept

BEST_OF_SINGLE ist ein alternatives Gruppenphase-Format für LEAGUE-Wettbewerbe. Statt Hin- und Rückrunde (DOUBLE_ROUND_ROBIN) trägt jeder Teilnehmer gegen jeden genau eine Begegnung aus. Jede Begegnung besteht aus N Duellen (Best-of-N), wobei alle N Duelle immer gespielt werden (kein vorzeitiger Abbruch). Ein Duell = je eine Serie pro Schütze. Kein Heimrecht — gemeinsame Terminabstimmung.

### Konfiguration

| Parameter           | Default        | Beschreibung                                                                                  |
| ------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| leagueFormat        | BEST_OF_SINGLE | Aktiviert dieses Format                                                                       |
| scoringMode         | RINGTEILER     | Wertungsmodus pro Duell                                                                       |
| groupBestOf         | 3              | N in Best-of-N (ungerade); benötigte Siege = ceil(N/2)                                        |
| groupPlayAllDuels   | true           | Alle N Duelle werden immer gespielt (im Formular/Standard auf true gesetzt; DB-Default false) |
| groupTiebreaker1    | null           | Optionaler Override: Sekundärkriterium bei Duel-Wert-Gleichstand (sonst Stechschuss)          |
| groupTiebreaker2    | null           | Optionaler Override: Tertiärkriterium                                                         |
| groupHasSuddenDeath | true           | Stechschuss bei Paarungs-Gleichstand (Standard); false = Wiederholungsduell                   |

### Spielplan

- Single Round-Robin: Jeder gegen jeden einmal (Circle Method, wie DOUBLE_ROUND_ROBIN ohne Rückrunde)
- Ungerade Teilnehmerzahl → Freilos-Matchup (awayParticipantId = null)
- Spieltage (roundIndex) entsprechen dem Doppelrunden-Format: n-1 Spieltage für n Teilnehmer

### Ergebniserfassung

- Pro Begegnung: Duelle werden einzeln eingetragen (Duell 1, 2, 3 … N)
- Jedes Duell hat je eine Serie pro Schütze mit `duelNumber` = 1..N, `isTiebreak = false`
- UI-Komponente: `BestOfEntryDialog.tsx` — Dialog zur Duell-Erfassung: zeigt alle Duelle, aktuellen Spielstand, Stechschuss-Prompt
- Bei Gleichstand nach N Duellen: Stechschuss-Eingabe — einzelner Dezimalwert (in `rings`), `isTiebreak = true`, `duelNumber` = N+1 aufwärts
- Höherer Schusswert beim Stechschuss gewinnt, unabhängig vom scoringMode
- Korrekturen: Löschen des letzten Duells via `deleteLatestBestOfDuel`; Wiedererfassung überschreibt via Upsert

### Tabelle

Spalten (Reihenfolge = Bewertungsreihenfolge): Pl., Name, Begegn. (gespielt), Siege, Satzdiff. (duelDiff), Satzverhältnis (gewonnene:verlorene Duelle), **Direktvergleich** (head-to-head bei Punktgleichstand)

Sortierung (jedes Kriterium ist eine sichtbare Spalte, links→rechts):

1. Siege (absteigend)
2. Satzdifferenz (absteigend)
3. Mehr gewonnene Sätze (duelsWon, absteigend)
4. **Direkter Vergleich** (head-to-head): Mini-Liga-Bilanz innerhalb der punktgleichen Gruppe (Match-Sieger, inkl. Stechschuss). Ersetzt seit 2026-06-24 das frühere „bestes Einzelergebnis" (Sportleiter-Entscheid). Kann er nicht entscheiden (Begegnung noch offen ODER zyklischer N-Gleichstand A→B→C→A), wird alphabetisch gewertet — die Spalte macht das mit „offen"/„ausgeglichen" sichtbar.
5. Nachname alphabetisch (deterministischer Rest)

Die letzte Spalte „Direktvergleich" zeigt im 2er-Gleichstand das Match-Ergebnis + Gegner (z.B. „2:1 · Müller"), im 3er+-Gleichstand die Direktbilanz („2:0"), sonst „—". Logik zentral in `bestOfStandingsSort.ts` (`directComparison`-Annotation), Anzeige über `formatDirectComparison` (Tabelle + PDF byte-identisch). `bestRingteiler`/`bestRings` werden weiter berechnet, sind aber kein Kriterium mehr (revert-fähig).

Zurückgezogene Teilnehmer erscheinen am Ende (alle Ergebnisse mit ihnen werden ignoriert).

### PDF

`BestOfSchedulePdf.tsx` — zeigt Spielplan (alle Begegnungen mit Duell-Einzelergebnissen und Stechschuss-Runden) sowie die Tabelle. Route: `/api/competitions/[id]/pdf/schedule` (gleicher Endpunkt wie DOUBLE_ROUND_ROBIN, format-aware).

---

## Event-Modus (EVENT) ✓ IMPLEMENTIERT (Phase 4)

### Konzept

Ein Event bildet ein einmaliges Schiessen ab (z.B. Kranzlschiessen, Pokalschiessen, Spassschiessen).
Alle Teilnehmer schiessen, eine Rangliste wird erstellt.

### Konfiguration

| Parameter       | Beschreibung                                              |
| --------------- | --------------------------------------------------------- |
| scoringMode     | Wertungsmodus (alle 7 Modi möglich)                       |
| shotsPerSeries  | Schusszahl pro Serie (default 10, z.B. 5 für Kurz-Kranzl) |
| disciplineId    | null = gemischt (Faktor aktiv), oder fixe Disziplin       |
| eventDate       | Veranstaltungsdatum                                       |
| allowGuests     | Gastteilnehmer zugelassen                                 |
| teamSize        | null = Einzel; 2+ = Teamgröße                             |
| targetValue     | Zielwert für TARGET-Modi (z.B. 512 oder 76.0)             |
| targetValueType | TEILER, RINGS oder RINGS_DECIMAL                          |

### Teilnehmer & Gäste ✓

- Vereinsmitglieder werden aus dem Teilnehmerpool eingeschrieben
- Gäste: werden als Participant angelegt mit `isGuest: true` auf CompetitionParticipant
- Bei gemischten Disziplinen: jeder Teilnehmer wählt seine Disziplin bei der Anmeldung
- **Disziplin ändern (gemischte Wettbewerbe):** Solange noch keine Serie erfasst wurde, kann die Disziplin eines aktiven (ACTIVE) Nicht-Gast-Teilnehmers nachträglich geändert werden. Button erscheint in der Teilnehmerliste. Nicht verfügbar für zurückgezogene Teilnehmer, Gastschützen oder wenn bereits Serien vorhanden sind.
- **PDF-Export Starterliste:** Druckbare Starterliste pro Event (`GET /api/competitions/[id]/starter-list/pdf`). Spalten: Nr. (zufällig gemischte Startreihenfolge 1..n, Fisher–Yates), Name, Disziplin (pro Zeile befüllt — bei gemischtem Event individuelle Disziplin, bei festem Event Wettbewerbs-Disziplin), Einlage (leer), Teilnahme, Geschossen. Nur ACTIVE-Teilnehmer + 10 Leerzeilen für Spontanstarter. Button auf `/competitions/[id]/participants` für EVENT-Wettbewerbe. Nur ADMIN/MANAGER. Jeder Klick erzeugt eine neue Zufallsreihenfolge.

### Serien-Erfassung ✓

- Jeder Teilnehmer schießt **eine Serie** pro Event
- Admin erfasst: Gesamtringe + Teiler (+ optional Einzelschüsse)
- **Live-Anzeige korrigierter Teiler:** Wird der Teiler eingegeben und ist `teilerFaktor ≠ 1.0`, erscheint direkt unter dem Eingabefeld ein Hint mit dem korrigierten Teiler (`Teiler × Faktor`).
- Bei DECIMAL_REST-Modus: Einzelschüsse sind **Pflicht** (Nachkommastellen benötigt); **nur in LEAGUE** (EVENT/SEASON können DECIMAL_REST nicht verwenden)

### Rangliste ✓

- Berechnung gemaess scoringMode mit Faktor-Korrektur (bei gemischten Disziplinen)
- Anzeige: Platzierung, Name, Disziplin, Ringe, Teiler (korrigiert), Ergebniswert
- Bei gemischten Wettbewerben: Spalte "Teiler korr." zeigt die mit Faktor korrigierten Teiler-Werte
- Gastteilnehmer erhalten Badge "Gast" neben dem Namen
- **Zurückgezogene Teilnehmer:** Teilnehmer mit Status "WITHDRAWN" werden ausgeschlossen und erscheinen nicht in der Rangliste
- **PDF-Export:** Rangliste als druckoptimiertes PDF (Button im Header)

### Zielwert-Modus ✓

Nur bei Events. Drei Varianten:

**TARGET_ABSOLUTE:** Möglichst nah an den Zielwert — ob drüber oder drunter ist egal.

**TARGET_UNDER:** ≤ Zielwert wird bevorzugt.

- Erst alle die den Zielwert nicht überschritten haben (sortiert nach Nähe)
- Dann alle die drüber sind (sortiert nach Nähe)

**TARGET_OVER:** >= Zielwert wird bevorzugt.

- Erst alle die den Zielwert erreicht haben oder überschritten (sortiert nach Nähe)
- Dann alle die drunter sind (sortiert nach Nähe)

Bei Teiler-basiertem Zielwert: Faktor-Korrektur wird auf den gemessenen Teiler angewendet. Der Zielwert ist im korrigierten Raum definiert.

### Team-Events ✓

- teamSize auf Competition setzen (z.B. 2 für Zweierteams)
- Admin teilt Teams ein
- Jedes Teammitglied schießt eine Serie
- Team-Ergebnis = Summe der Einzelergebnisse (teamScoring: "SUM")
- Ranking nach Team-Ergebnis (`rankEventTeams`, `EventTeamRankingTable`)
- PDF-Export und Dashboard-Integration vorhanden

---

## Saison-Modus (SEASON) ✓ IMPLEMENTIERT (Phase 5)

### Konzept

Ein Saison-Wettbewerb läuft über mehrere Monate (z.B. Jahrespreisschiessen).
Teilnehmer schießen viele Serien über die Saison hinweg. Die besten Einzelserien zählen.
Serien werden "gekauft" — jede geschossene Serie zählt als gekauft.

### Konfiguration

| Parameter      | Beschreibung                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------- |
| scoringMode    | Primärer Wertungsmodus (für die Hauptsortierung). Nur RINGS, RINGS_DECIMAL, TEILER, RINGTEILER |
| shotsPerSeries | Schusszahl pro Serie                                                                           |
| disciplineId   | Immer null (gemischt) — Teilnehmer können Disziplin pro Serie wechseln                         |
| minSeries      | Mindestanzahl Serien für Wertung (default 20)                                                  |
| seasonStart    | Saisonbeginn                                                                                   |
| seasonEnd      | Saisonende                                                                                     |

### Serien-Erfassung ✓

- Über mehrere Schießabende hinweg
- Pro Eintrag: Gesamtringe, Teiler, Disziplin, Datum
- Teilnehmer kann Disziplin pro Serie frei wählen
- Keine Begrenzung der Serienanzahl nach oben
- Admin erfasst Serien via `SeasonSeriesDialog`:
  - **sessionDate** defaultet auf heute
  - **Disziplin-Vorauswahl** (defaultDisciplineId prop) wird unterstützt
  - Dialog kann jederzeit neu geöffnet werden (fix Reopening-Bug via useEffect Pattern)
- **Edit-Modus:** Bearbeiten (Bearbeiten) bestehender Serien — Pencil-Icon pro Serienzeile öffnet Dialog im Edit-Modus, nutzt `updateSeasonSeries` Action, recalculates Ringteiler, logs `SEASON_SERIES_CORRECTED` audit event
- **Live-Anzeige korrigierter Teiler:** Wird der Teiler eingegeben und ist der `teilerFaktor` der gewählten Disziplin `≠ 1.0`, erscheint direkt unter dem Eingabefeld ein Hint mit dem korrigierten Teiler. Reagiert dynamisch auf Disziplin-Wechsel.

### Mehrfach-Wertung ✓

Die Saison-Tabelle zeigt **drei Bestwerte** pro Teilnehmer (jeweils aus einer einzelnen Serie):

| Kategorie         | Berechnung                                         | Gewinner    |
| ----------------- | -------------------------------------------------- | ----------- |
| Beste Ringe       | Höchste Ringzahl einer einzelnen Serie             | Höchster    |
| Bester Teiler     | Niedrigster korrigierter Teiler (Teiler \* Faktor) | Niedrigster |
| Bester Ringteiler | Niedrigster Ringteiler einer einzelnen Serie       | Niedrigster |

**Wichtig:** Beste Ringe und bester Teiler können aus **verschiedenen Serien** stammen.
Ringteiler muss aus **derselben Serie** stammen (Ringe und Teiler gehören zusammen).

### Saison-Rangliste (Seiten-UI) ✓

- **Sortierbare Spalten:** Header-Click zum Sortieren nach Platzierung, Name, Ringe, Teiler, Ringteiler
- **Default-Sortierung:** abhängig vom `scoringMode` (z.B. Ringe für RINGS-Modus)
- **Gemischte Wettbewerbe:** Spalte "Best. Teiler korr." zeigt die mit Faktor korrigierten Teiler-Werte
- **Zurückgezogene Teilnehmer:** Teilnehmer mit Status "WITHDRAWN" werden ausgeschlossen und erscheinen nicht in der Standingtabelle
- **Serien-Anzeige:** Pro Teilnehmer können Serien expandiert/collapsiert werden (Chevron-Icon)

### Mindestserien-Prüfung ✓

- Nur Teilnehmer mit ≥ minSeries geschossenen Serien erscheinen in der Wertung
- Teilnehmer mit weniger Serien werden angezeigt, aber ausgegraut / nicht gewertet
- Fortschrittsanzeige: "12 / 20 Serien geschossen"

---

## Teilnehmerverwaltung

- Felder: Name, Vorname, Kontaktmoeglichkeit (E-Mail oder Telefon, optional)
- Teilnahme in mehreren Wettbewerben gleichzeitig moeglich
- Startnummer pro Wettbewerb (optional)
- **PDF-Export:** Aktive Vereinsmitglieder als druckbare Bürodienst-Liste (`GET /api/participants/pdf`): Spalten Name, Disziplin, Einlage (leer, manuell), Teilnahme und Geschossen (Kästchen zum Abhaken), 10 Leerzeilen für Spontanstarter. Nur für ADMIN/MANAGER.

### Gastschützen

- Können an EVENT-Wettbewerben teilnehmen (wenn `allowGuests` aktiviert); **nicht** bei LEAGUE oder SEASON
- Treten **ad hoc nur mit Namen** an — keine vorherige Anmeldung erforderlich
- Ein stilles Participant-Datensatz wird mit `isGuestRecord: true` erstellt — **nicht sichtbar** in der Teilnehmerverwaltung
- Gäste erscheinen **nicht** in der Teilnehmerliste (/participants-Seite)
- Gäste erhalten in der Event-Rangliste Badge "Gast" neben dem Namen
- **Keine Speicherung zwischen Events** — jeder Gast ist ephemär
- **Auto-Cleanup**: Wenn Gast abgemeldet wird, werden stiller Datensatz und Serien automatisch gelöscht
- Kein Login erforderlich — Ergebnisse werden vom Admin erfasst

### Löschen inaktiver Teilnehmer ✓ IMPLEMENTIERT

- Nur **inaktive** Teilnehmer (isActive = false) dürfen gelöscht werden
- **Normales Löschen** (keine Wettbewerbshistorie): ADMIN + MANAGER
- **Force-Delete** (Teilnehmer mit Wettbewerbsdaten): nur ADMIN
- Adaptiver Dialog (drei Varianten basierend auf Rolle und Datenlage):
  1. Keine Historie → einfache Bestätigung
  2. Historie vorhanden + kein Admin → Info "Löschen nicht möglich"
  3. Historie vorhanden + Admin → Namenseingabe zur Bestätigung
- Force-Delete löscht kaskadierend: PlayoffMatches, PlayoffDuels, Matchups inkl. Serien des Gegners, verbleibende Serien, CompetitionParticipant, Participant
- Protokollierung: `PARTICIPANT_DELETED` (normales Löschen) / `PARTICIPANT_FORCE_DELETED` (Admin-Force-Delete)

### Rückzug (nur Liga)

- Jederzeit möglich (auch nach gespielten Runden)
- Alle Ergebnisse des Teilnehmers rückwirkend aus der Wertung
- Tabelle wird neu berechnet
- Rückzug rückgängig machbar (solange Playoffs nicht begonnen)
- Protokollierung im Audit-Log

---

## Visualisierung & Auswertung

### Dashboard-Aufteilung (Phase 4 + Phase 5)

Das Haupt-Dashboard unterteilt aktive Wettbewerbe nach Typ:

- **Liga (LEAGUE):** Interaktive Tabelle, K.O.-Bracket, Punkteverlauf (Liniendiagramm); Spielplan-Navigation
- **Event (EVENT):** EventRankingTable mit Disziplin + korrigiertem Teiler (bei gemischt), Link zu Event-Rangliste
- **Saison (SEASON):** SeasonStandingsTable mit Bestwerten (Ringe, Teiler, Ringteiler), Saisonzeitraum und Serien-Fortschritt, Link zu /standings

### Wettbewerbs-Listenansicht

Die Seite `/competitions` zeigt Wettbewerbe in Karten mit:

- **Wettbewerbstyp-Badge:** "Liga", "Event", "Saison"
- **Saison-Typen:** zusätzlich Saisonzeitraum (seasonStart – seasonEnd)
- **Navigation:** Links zu /series (Serien-Erfassung) und /standings (Saison-Rangliste) für Saison-Wettbewerbe

### Auswertungen pro Typ

- **Liga:** Spielplan (Hin-/Rückrunde), Tabelle, Playoffs
- **Event:** Rangliste mit Disziplin, Ergebniswert und Faktor-Korrektur (bei gemischt: "Teiler korr." angezeigt)
- **Saison:** Mehrfach-Tabelle (Ringe, Teiler, Ringteiler) mit sortierbaren Spalten und Serien-Expansion, Serien-Erfassungsdialog mit Disziplin-Vorauswahl, Fortschrittsanzeige
- **Alle:** Paarungsplan/Serienliste, Profil-Seite je Teilnehmer
- **Export:** Spielplan + Tabelle als druckoptimiertes PDF (Liga); Rangliste als PDF (Event); Saison-Standings als PDF (Saison)

### Öffentliche PDF-URL (Website-Verlinkung)

Wettbewerbe können mit `isPublic = true` und einem `publicSlug` markiert werden, um ihr Haupt-PDF unter `/api/public/c/<slug>/pdf` ohne Login verfügbar zu machen.

- **Auswahl Haupt-PDF:** EVENT → Rangliste, SEASON → Standings, LEAGUE → Spielplan+Tabelle vor Playoff-Start, Playoff-Bracket nach Start
- **Slug-Verwaltung:** Ein Slug darf nur von **einem** ACTIVE+isPublic Wettbewerb gleichzeitig belegt sein (Partial Unique Index). Sobald der Wettbewerb auf COMPLETED/ARCHIVED gesetzt wird, ist der Slug für einen Nachfolger wieder frei.
- **Stabile URL über Jahre:** Beispiel Jahrespreisschiessen → jährlich neuer Wettbewerb übernimmt denselben Slug, die Website-URL bleibt gleich.
- **Lookup-Reihenfolge:** ACTIVE-Claimant zuerst, sonst jüngster (createdAt DESC) COMPLETED/ARCHIVED-Holder.
- **Optionaler Passwortschutz:** Pro Wettbewerb kann ein bcrypt-gehashtes Passwort gesetzt werden. Browser zeigt nativen HTTP-Basic-Auth-Dialog. Benutzername wird ignoriert (geteiltes Passwort pro Wettbewerb).
- **Cache:** PDF-Buffer 24h via `unstable_cache` (keyed by competitionId + phaseTag, tagged `public-pdf:<slug>`); Auth-Check läuft auf jeder Anfrage. Invalidierung via `revalidateTag` in update/status/startPlayoffs Actions.
- **Berechtigung:** Schalter im Edit-Formular für ADMIN/MANAGER. Öffentliche Route ist unauthentisiert (außer optional via Basic-Auth-Passwort).
- **UI-Indikator:** Wettbewerbe mit `isPublic = true` erhalten in der Competitions-Liste (ACTIVE, DRAFT) ein "Öffentlich"-Badge.

---

## Nutzerverwaltung & Zugriffskontrolle

- Konten ausschließlich durch Admins erstellt (kein Self-Signup)
- Rollen: Administrator (Vollzugriff) | Benutzer (eingeschränkt)
- Admin: Nutzer anlegen, bearbeiten, Passwörter zurücksetzen
- Eigenes Passwort ändern: nur eingeloggt + aktuelles Passwort
- Passwort vergessen: nur Admin-Reset, kein E-Mail-Flow
- Alle Wettbewerbs-, Teilnehmer- und Disziplindaten sind vereinsweit sichtbar; Zugangskontrolle via Rolle, nicht via userId

### Archivieren statt Löschen

- Disziplinen mit Ergebnissen → archivieren
- Wettbewerbe mit Ergebnissen → archivieren
- Archivierte Objekte: nicht in Auswahlfeldern; historische Daten abrufbar
- Explizite Löschung: nur ohne abhängige Daten
- Force Delete (Admin): Wettbewerb inkl. aller Daten löschen (Bestätigung durch Namenseingabe)

---

## Audit-Log (Protokoll)

- Alle sicherheits- und verwaltungsrelevanten Aktionen werden protokolliert
- `competitionId` als Referenz — gesetzt wenn die Aktion einen Wettbewerb betrifft, sonst null (nur globales Protokoll)
- Ereignisse sind nach Kategorie gruppiert: `participant`, `result`, `playoff`, `destructive`, `admin`

### Kategorie: Teilnehmer (participant)

| Ereignis              | Auslöser                           |
| --------------------- | ---------------------------------- |
| PARTICIPANT_WITHDRAWN | Rückzug eines Teilnehmers aus Liga |
| WITHDRAWAL_REVOKED    | Rückzug rückgängig gemacht         |

### Kategorie: Ergebnis (result)

| Ereignis                | Auslöser                     |
| ----------------------- | ---------------------------- |
| RESULT_ENTERED          | Liga-Ergebnis eingetragen    |
| RESULT_CORRECTED        | Liga-Ergebnis korrigiert     |
| EVENT_SERIES_ENTERED    | Serie bei Event eingetragen  |
| EVENT_SERIES_CORRECTED  | Serie bei Event korrigiert   |
| SEASON_SERIES_ENTERED   | Serie bei Saison eingetragen |
| SEASON_SERIES_CORRECTED | Serie bei Saison korrigiert  |

### Kategorie: Playoff (playoff)

| Ereignis                 | Auslöser                           |
| ------------------------ | ---------------------------------- |
| PLAYOFFS_STARTED         | Playoff-Phase gestartet            |
| PLAYOFF_RESULT_ENTERED   | Playoff-Duell-Ergebnis eingetragen |
| PLAYOFF_RESULT_CORRECTED | Playoff-Duell korrigiert           |

### Kategorie: Destruktiv (destructive)

| Ereignis                  | Auslöser                                          |
| ------------------------- | ------------------------------------------------- |
| PLAYOFF_DUEL_DELETED      | Playoff-Duell gelöscht                            |
| EVENT_SERIES_DELETED      | Serie bei Event gelöscht                          |
| SEASON_SERIES_DELETED     | Serie bei Saison gelöscht                         |
| PARTICIPANT_DELETED       | Inaktiver Teilnehmer ohne Historien gelöscht      |
| PARTICIPANT_FORCE_DELETED | Admin-Force-Delete inkl. aller historischen Daten |

### Kategorie: Admin (admin)

Stammdaten-Änderungen — erscheinen nur im globalen Protokoll (kein competitionId), außer Competition-Events.

| Ereignis                   | Auslöser                                  | competitionId |
| -------------------------- | ----------------------------------------- | ------------- |
| USER_CREATED               | Neuer Nutzer angelegt                     | null          |
| USER_UPDATED               | Nutzerdaten geändert                      | null          |
| USER_DEACTIVATED           | Nutzer deaktiviert                        | null          |
| USER_REACTIVATED           | Nutzer reaktiviert                        | null          |
| PARTICIPANT_CREATED        | Neuer Teilnehmer angelegt                 | null          |
| PARTICIPANT_UPDATED        | Teilnehmerdaten geändert                  | null          |
| PARTICIPANT_DEACTIVATED    | Teilnehmer deaktiviert                    | null          |
| PARTICIPANT_REACTIVATED    | Teilnehmer reaktiviert                    | null          |
| DISCIPLINE_CREATED         | Neue Disziplin angelegt                   | null          |
| DISCIPLINE_UPDATED         | Disziplin geändert                        | null          |
| DISCIPLINE_ARCHIVED        | Disziplin archiviert                      | null          |
| DISCIPLINE_DELETED         | Disziplin gelöscht                        | null          |
| COMPETITION_CREATED        | Neuer Wettbewerb angelegt                 | neue ID       |
| COMPETITION_UPDATED        | Wettbewerbsdaten geändert                 | bestehende ID |
| COMPETITION_STATUS_CHANGED | Wettbewerb-Status geändert (z.B. → Aktiv) | bestehende ID |

- Details-JSON als Snapshot (denormalisiert, kein Verweis)
- Wettbewerb-Protokoll: pro Wettbewerb (nur Events mit competitionId); Globales Protokoll: alle Wettbewerbe

---

## Datenschutz

- Personenbezogene Daten nur fuer Vereinsverwaltung
- Keine Weitergabe an Dritte
- On-Premise auf eigenem VPS, kein Cloud-Dienst
- HTTPS in Produktion zwingend
