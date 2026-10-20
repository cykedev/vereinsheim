# Plan: Ringwerk — Befunde aus dem Ablesen für die Hilfe (B1–B7)

Stand: 20. Oktober 2026 · Branch: `feat/ringwerk-befunde-wertung` (von `feat/design2-all-apps`) · Plan und E1–E6 freigegeben
am 20. Oktober 2026 · Umsetzung erst nach dem Release von Ringwerks Design 2 (E6)

## Kontext

Beim Schreiben der Hilfetexte (Teil W, WD0, [[ringwerk-design2]]) zeigte das Ablesen von `lib/scoring`,
`lib/standings` und `lib/playoffs` sieben Stellen, an denen Ringwerk anders anzeigt als rechnet oder Einstellungen
anbietet, die nicht wirken. Sie stehen in [[ringwerk]] („Fehler und Lücken im Code“) und im Textbuch
(`vault/_attachments/textbuch-ringwerk-treffsicher.md`, „Ringwerk: Befunde beim Ablesen für WD0“). Die Hilfetexte
meiden diese Fälle heute.

| # | Befund | Stelle |
| --- | --- | --- |
| B1 | Finale: Die Karte (und das PDF der Playoffs) markiert den Sieger eines Duells nur nach Ringen. Gewertet wird nach Hauptkriterium und Stichkriterien. | `mapDuelItem` in `lib/playoffs/queries.ts` ruft `determineFinaleRoundWinner(totalRingsA, totalRingsB)`; `PlayoffsPdf.tsx:417` liest dasselbe `winnerId` |
| B2 | Finale ohne Verlängerung: Ein Gleichstand ist eine Sackgasse, die Karte sagt trotzdem „bei Gleichstand Verlängerung“. | `settle` in `lib/playoffs/actions/duelMutations.ts`, Hinweis in `PlayoffMatchCard.tsx` |
| B3 | Gemischte Liga mit Hin- und Rückrunde, Playoffs und Finale vergleichen den Teiler vom Ausdruck, nicht den korrigierten. Best-of und Saison nehmen den korrigierten. | `determineOutcome` (aufgerufen in `calculateStandings.ts`, `standingsSort.ts`, `ClassicLegTable.tsx`), `computeDuelOutcome`/`storedDuelOutcome` in `lib/playoffs/actions/duelOutcome.ts`, `mapDuelItem` |
| B4 | Duelle rechnen den Ringteiler mit fest 100 oder 109 Ringen (`MAX_RINGS`), Serien mit 10 bzw. 10,9 je Schuss. | `lib/results/actions.ts`, `lib/results/bestOf/saveBestOfDuel.ts`, `lib/playoffs/actions/duelOutcome.ts` |
| B5 | Der Faktor einer Disziplin ist jederzeit änderbar. Gespeicherte Ringteiler behalten den alten Faktor, der korrigierte Teiler der Saison rechnet live mit dem neuen. `ensureSystemDisciplines` setzt den Faktor der vier Standarddisziplinen bei jedem Start zurück. | `updateDiscipline` in `lib/disciplines/actions.ts`, `lib/disciplines/systemDisciplines.ts` |
| B6 | Die Tabelle der Liga zeigt immer „Best. RT“. Bei Wertung nach Ringen trennt aber die meisten Ringe den Gleichstand. | `StandingsTable.tsx`, `SchedulePdf.tsx` |
| B7 | „Gleichstand per Stechschuss“ im Best-of wird gespeichert, aber nirgends ausgewertet. | `LeagueGroupPhaseFieldset.tsx`, `competitions/actions/{create,update,baseSchema}.ts` |

**Produktion (20. Oktober 2026, nur lesend, `reports/ringwerk-befunde.sql`):** 6 Ligen, davon eine gemischt ohne
Teiler als Wertung oder im Finale. Für jeden Befund 0 Fälle: keine Finale-Duelle mit gleichen Ringen, kein
Hauptkriterium außer Ringen, keine Liga ohne Verlängerung, keine Liga mit anderer Schusszahl als 10, kein geänderter
Faktor, keine Serie mit Ringteiler aus einem anderen Faktor, keine Liga mit Hin- und Rückrunde nach Ringen, kein
Best-of mit ausgeschaltetem Stechschuss. Keine Korrektur ändert also ein Ergebnis eines echten Wettbewerbs.

## Entscheidungen (vom User am 20. Oktober 2026 freigegeben)

- **E1** Die Verlängerung im Finale gibt es immer. Die Option `finaleHasSuddenDeath` verschwindet aus dem Formular,
  `settle` legt bei Gleichstand im Finale immer die Verlängerung an. Die Spalte im Schema bleibt (keine Migration),
  Ringwerk liest und schreibt sie nicht mehr.
- **E2** B3 gilt für alle Wettbewerbe, auch rückwirkend (Produktion: 0 betroffene).
- **E3** Der Faktor einer Disziplin ist gesperrt, sobald sie eine Serie, eine Einschreibung oder einen Wettbewerb hat
  (wie heute die Wertungsart). Bei Standarddisziplinen (`isSystem`) ist der Faktor nicht änderbar. Das Feld bleibt im
  Formular und wird mitgeschickt (`readOnly`, nicht `disabled`, conventions §9).
- **E4** Die Option „Gleichstand per Stechschuss“ im Best-of verschwindet aus dem Formular. Die Spalte
  `groupHasSuddenDeath` bleibt (keine Migration), Ringwerk liest und schreibt sie nicht mehr.
- **E5** Der Prüfbestand bekommt drei Szenarien für B1, B3 und B6. Der Ausgangsstand wird zweimal mit Freigabe neu
  aufgenommen: einmal mit den neuen Szenarien auf dem alten Code, einmal nach den Korrekturen.
- **E6** Umsetzung und Release erst nach dem Release von Ringwerks Design 2 (Teil W), als eigener Release nach
  „Ringwerk: Betrieb sichern“ ([[ringwerk-pruefbestand]]). Der Branch zweigt vom
  dann aktuellen `feat/design2-all-apps` (oder `main`, falls es dort schon liegt) ab und wird vorher darauf rebased.

## Ansatz

Erst Texte (Haltepunkt), dann der Prüfbestand mit Fällen, die heute falsch angezeigt oder gewertet würden, dann je
Befund ein Charakterisierungstest für den unveränderten Normalfall und ein Test für den korrigierten Fall, dann die
Korrektur. Jede Rechnung bleibt eine reine Funktion an einer Stelle; Bildschirm, PDF und Wertung nutzen dieselbe.

**Was sich nicht ändern darf:** Wettbewerbe mit fester Disziplin und zehn Schuss (alle echten Ligen bis auf eine),
Event und Saison, die Setzung der Playoffs, alles außerhalb der in T3 bis T9 genannten Dateien. `pruefen:vergleichen`
zeigt nach den Korrekturen Abweichungen nur in den drei neuen Szenarien (T1), sonst 0.

## Required Docs

- `apps/ringwerk/CLAUDE.md` („Vor jedem Release“), `vault/conventions.md` (§2, §6, §9, §10)
- Vault-Notes: `ringwerk-pruefbestand`, `factor-correction`, `best-of-single`, `playoffs-knockout-system`,
  `league-mode`, `league-points-and-tiebreak`, `phase-locking-and-editability`, `disciplines-and-factors`,
  `ringwerk-design2`, `ringwerk` („Fehler und Lücken im Code“)
- `vault/apps/ringwerk/ringwerk-code-conventions.md`, `ringwerk-testing-conventions.md`, `ringwerk-ui-patterns.md`
- Textbuch: „Ringwerk: Hilfe (WD0)“ und „Ringwerk: Befunde beim Ablesen für WD0“

## Geschützte Schritte und Haltepunkte

- **T0** Textbuch: **HALT**, der User gibt frei.
- **T1** Ausgangsstand neu aufnehmen (`pruefen:aufnehmen` schreibt `tools/pruefdaten/referenz/`): **HALT**, der User
  sieht die Bilder der neuen Szenarien und gibt frei.
- **T10** Ausgangsstand nach den Korrekturen: **HALT**, der User sieht die Abweichungen und gibt frei.
- Keine Schema-Änderung, keine Migration.

## Tasks

### T0 Textbuch (Haltepunkt)

Neuer Abschnitt „Ringwerk: Wertung richtig anzeigen (B1–B7)“ im Textbuch, „alt → neu“:

1. Fehlermeldung beim Speichern einer Disziplin mit geändertem Faktor, wenn sie schon genutzt wird (E3), Vorschlag:
   „Der Faktor lässt sich nicht mehr ändern. Die Disziplin hat schon Ergebnisse oder Einschreibungen. Lege für einen
   anderen Faktor eine neue Disziplin an.“
2. Hinweis unter dem Feld „Teiler-Faktor“ bei Standarddisziplinen und gesperrten Disziplinen, Vorschlag:
   „Standarddisziplin: Ringwerk legt den Faktor fest.“ bzw. „Gesperrt, weil die Disziplin schon Ergebnisse hat.“
3. Spaltenkopf der Tabelle der Liga bei Wertung nach Ringen: „Best. Ringe“ (Bildschirm und PDF).
4. Hilfe `finale`, „Vorsicht“ (E1): alt „Die Verlängerung gibt es, wenn der Wettbewerb sie vorsieht. Das ist der
   Standard.“ → neu „Die Verlängerung hat keine Grenze. Es folgen so viele Duelle, bis eines entscheidet.“
5. Hilfe `league-table`, „So liest du es“: „Dann zählt der beste Ringteiler aus allen Duellen („Best. RT“), bei Wertung
   nach Ringen die meisten Ringe („Best. Ringe“).“
6. Hinweis auf der Karte des Finales bleibt „… · bei Gleichstand Verlängerung“ (gilt nach E1 immer).

**HALT:** Der User gibt frei. Danach `lib/help/topics.ts` und sein Textbuch-Test im selben Commit wie T6/T9.

### T1 Prüfbestand: drei Szenarien (Haltepunkt)

In `apps/ringwerk/tools/pruefdaten/` (`scenarios.ts`, `league.ts`, `results.ts`, `verify.ts`): `LeagueScenario`
bekommt optionale Felder `scoringMode`, `mixed` und `finale` (`{ primary, tiebreaker1? }`). Die Ergebnisse der neuen
Szenarien werden gezielt gesetzt, nicht zufällig, damit der Fall sicher vorkommt; `verify.ts` prüft je Szenario einen
neuen `Fact`:

| Code | Name | Inhalt | Fact |
| --- | --- | --- | --- |
| `L-FIN-TB` | „L7 Finale per Stichkriterium (Hin/Rück)“ | 4 Teilnehmer, fertig mit Playoffs, `finalePrimary` RINGS, `finaleTiebreaker1` RINGTEILER; das Finale-Duell hat gleiche Ringe und verschiedene Ringteiler | `finale:stichkriterium-entscheidet` |
| `L-MIX-T` | „L3 gemischt nach Teiler (Hin/Rück)“ | 6 Teilnehmer, `disciplineId` null, Luftgewehr (1,0) und Luftpistole (0,333), Wertung TEILER; mindestens eine Paarung, in der der rohe Teiler anders entscheidet als der korrigierte | `liga:teiler-roh-anders` |
| `L-RINGE` | „L3 nach Ringen, Punktgleich (Hin/Rück)“ | 6 Teilnehmer, Wertung RINGS; zwei Punktgleiche mit gleichen Direktpunkten, die besten Ringe und der beste Ringteiler trennen verschieden | `liga:ringe-gegen-ringteiler` |

Dann auf dem **alten** Code: `pnpm --filter ringwerk pruefdaten`, `pruefen:aufnehmen`, Bilder der drei Szenarien dem
User zeigen. **HALT:** Freigabe des neuen Ausgangsstands. Commit: Szenarien und `referenz/`.

Test: `tools/pruefdaten/pruefdaten.test.ts` prüft, dass jedes neue Szenario seinen Fact erfüllt (wie die bestehenden).

### T2 Charakterisierung des Normalfalls

Vor jeder Korrektur, Tests, die nach T3–T9 unverändert grün bleiben:

- `lib/standings/calculateStandings.test.ts`: feste Disziplin, Wertung RINGTEILER, RINGS, TEILER, mit Gleichständen
  bei Ringteiler und Ringen. Ergebnis und Reihenfolge festhalten.
- `lib/playoffs/actions/duelOutcome.test.ts` (erweitern): Viertelfinale und Finale mit fester Disziplin,
  Finale mit Hauptkriterium RINGS ohne Stichkriterium: `computeDuelOutcome` und `storedDuelOutcome` liefern dasselbe.
- `lib/results/actions.test.ts` (erweitern), `lib/results/bestOf/saveBestOfDuel.test.ts` (neu): Ringteiler bei zehn
  Schuss wie heute (100/109).

Gegenprobe nach conventions §9: den geplanten Eingriff testweise einbauen, die Tests des Normalfalls bleiben grün,
ein Test des Sonderfalls wird rot.

### T3 B1: angezeigter Sieger im Finale

- `getPlayoffBracket` lädt `finalePrimary`, `finaleTiebreaker1`, `finaleTiebreaker2` und `disciplineId` des
  Wettbewerbs mit; `mapDuelItem` bestimmt den Sieger eines Finale-Duells mit `storedDuelOutcome` (dieselbe Kette wie
  beim Zählen der Siege), statt `determineFinaleRoundWinner(ringsA, ringsB)`.
- Test `lib/playoffs/queries.test.ts` (neu, Prisma als Mock wie in `actions/correction.test.ts`): Finale mit gleichen Ringen und Stichkriterium Ringteiler → `winnerId` ist der
  mit dem kleineren Ringteiler; Finale mit Hauptkriterium RINGTEILER → Sieger nach Ringteiler; ohne Stichkriterium und
  gleichen Ringen → `null` („Unentschieden“). Eigenschaft: Für jedes fertige Duell stimmt `winnerId` mit dem Duell
  überein, das in `winsA`/`winsB` gezählt ist.
- Wirkung: Karte (`DuelRows`) und PDF (`PlayoffsPdf`) zeigen im Szenario `L-FIN-TB` den Sieger statt
  „Unentschieden“.

### T4 B3: korrigierter Teiler überall

- `lib/results/calculateResult.ts`: `determineOutcome` bleibt; die Aufrufer übergeben als `teiler` den korrigierten
  Teiler (`calculateCorrectedTeiler(teiler, effectiveTeilerFaktor(disciplineId, faktor))`).
  - `lib/standings/queries.ts` lädt je Ergebnis den Faktor der Disziplin (wie schon für Best-of, Zeile 121) und setzt
    in `StandingsMatchupResult` ein neues Feld `correctedTeiler`; `calculateStandings.ts` und `standingsSort.ts`
    übergeben es.
  - `ClassicLegTable.tsx`: `MatchResultSummary` hat schon `teilerFaktor` (`lib/matchups/types.ts:13`); der Aufruf von
    `determineOutcome` übergibt den korrigierten Teiler. Die Anzeige („T“) bleibt der Teiler vom Ausdruck.
- `lib/playoffs/actions/duelOutcome.ts`: `computeDuelOutcome` und `storedDuelOutcome` vergleichen beim Teiler den
  korrigierten Teiler (Faktor je Seite aus der Disziplin, nur bei gemischtem Wettbewerb), im Duell und im Kriterium
  „Teiler“ des Finales. `mapDuelItem` (T3) nutzt dieselbe Funktion.
- Tests: `calculateStandings.test.ts` mit gemischter Liga nach Teiler (Luftpistole 90 gegen Luftgewehr 35: korrigiert
  30,0 gegen 35,0, die Luftpistole gewinnt); `duelOutcome.test.ts` ebenso für Viertelfinale (Gleichstand bis zum
  Teiler) und Finale mit Kriterium Teiler. Die Charakterisierung aus T2 bleibt grün.

### T5 B4: höchste Ringzahl je Schusszahl

- `lib/results/actions.ts`, `lib/results/bestOf/saveBestOfDuel.ts`, `lib/playoffs/actions/duelOutcome.ts`:
  `getMaxRings(scoringType, competition.shotsPerSeries)` (aus `lib/series/scoring-format.ts`) statt
  `MAX_RINGS[scoringType]`. `saveStechschuss.ts` bleibt bei `MAX_RINGS`, denn ein Stechschuss ist ein Schuss.
- Tests: Ringteiler bei 10 Schuss unverändert (T2), bei 20 Schuss 200 bzw. 218 als höchste Ringzahl.
- `MAX_RINGS` bleibt nur, wenn noch ein Aufrufer da ist; sonst entfällt es samt Kommentar.

### T6 B2/E1: Verlängerung im Finale immer

- `LeaguePlayoffsFieldset.tsx` und `useRulesetState.ts`: Checkbox „Finale: Gleichstand per Stechschuss“ und das
  versteckte Feld entfallen.
- `competitions/actions/{baseSchema,create,update}.ts`: `finaleHasSuddenDeath` wird weder gelesen noch geschrieben
  (das Fehlen im Formular darf nichts löschen: der Wert wird nicht mehr angefasst, conventions §9).
- `duelMutations.ts` (`settle`), `saveDuel.ts`, `deleteDuel.ts`: Im Finale ohne offenes Duell nach mindestens einem
  fertigen Duell immer die Verlängerung anlegen; `finaleHasSuddenDeath` fällt aus `MatchRules` und den Abfragen.
- Hilfe `finale` nach T0 Nr. 4 (`topics.ts`, Test hält den Wortlaut).
- Tests: `lib/playoffs/actions/correction.test.ts` (erweitern): Finale-Gleichstand legt die Verlängerung an, auch
  wenn die Spalte `false` ist; `lib/competitions/actions/ruleset.test.ts` (neu): `update` und `create` ohne das Feld
  lassen die Spalte unverändert bzw. setzen sie nicht; Markup-Test des Fieldsets ohne die Checkbox.

### T7 B7/E4: Häkchen im Best-of entfällt

- `LeagueGroupPhaseFieldset.tsx`, `useRulesetState.ts`: Checkbox „Gleichstand per Stechschuss“ und verstecktes Feld
  entfallen.
- `competitions/actions/{baseSchema,create,update}.ts`, `lib/competitions/listQueries.ts`, `lib/competitions/types.ts`:
  `groupHasSuddenDeath` wird nicht mehr gelesen oder geschrieben.
- Tests: in `lib/competitions/actions/ruleset.test.ts` (aus T6) `create`/`update` ohne das Feld, die Spalte bleibt
  unverändert; Best-of-Gleichstand geht weiter in den Stechschuss (bestehende Tests in `lib/scoring/bestOf.test.ts`).

### T8 B5/E3: Faktor sperren

- `lib/disciplines/actions.ts` (`updateDiscipline`): Weicht der Faktor vom gespeicherten ab und hat die Disziplin
  eine Serie, eine Einschreibung oder einen Wettbewerb (oder `isSystem`), Feldfehler `teilerFaktor` mit dem Text aus
  T0 Nr. 1. Prüfung und Update in einer Transaktion mit der Bedingung im Update (conventions §9, „Prüfen und Löschen
  in derselben Transaktion“ gilt sinngemäß).
- `DisciplineForm.tsx`: Feld `readOnly` (nicht `disabled`), wenn gesperrt oder Standarddisziplin, Hinweis aus T0 Nr. 2.
  Die Seite reicht dafür `factorLocked` herein (Abfrage in `lib/disciplines/queries.ts` zählt Serien, Einschreibungen,
  Wettbewerbe).
- `systemDisciplines.ts` bleibt: Der Start setzt den Faktor der Standarddisziplinen auf den festen Wert, der in der
  Oberfläche ohnehin nicht änderbar ist.
- Tests: `actions.test.ts` (geändert und genutzt → Fehler, unverändert → speichert, ungenutzt → speichert,
  Standarddisziplin → Fehler); Formular-Markup-Test mit `readOnly` und Hinweis.

### T9 B6: Spalte „Best. Ringe“ bei Wertung nach Ringen

- `lib/standings/standingsSort.ts` exportiert eine reine Funktion `leagueTieColumn(scoringMode)` →
  `{ label: "Best. RT" | "Best. Ringe", value: (row) => number | null, format }`; `tieValue` nutzt sie.
- `StandingsTable.tsx` und `SchedulePdf.tsx` nutzen sie für Kopf und Wert; das „?“ an der Spalte bleibt `ringteiler`
  bei „Best. RT“ und entfällt bei „Best. Ringe“ (kein eigenes Thema; die Hilfe `league-table` nennt beides, T0 Nr. 5).
- Tests: `lib/standings/standingsSort.test.ts` (neu) für beide Modi; `StandingsTable.test.tsx` und ein PDF-Test (`SchedulePdf`) zeigen
  „Best. Ringe“ mit Ringen bei RINGS, sonst unverändert.

### T10 Abgleich und neuer Ausgangsstand (Haltepunkt)

- `pnpm --filter ringwerk pruefdaten`, `pruefen:vergleichen`: Abweichungen nur in `L-FIN-TB` (Sieger des
  Finale-Duells auf Karte und im PDF), `L-MIX-T` (Tabelle, Reihenfolge, Spielplan-Hervorhebung) und `L-RINGE` (Spalte
  und Wert „Best. Ringe“ auf Seite und im PDF). Überall sonst 0 Fehler.
- **HALT:** Der User sieht `vorher-nachher.html` der drei Szenarien und gibt frei; dann `pruefen:aufnehmen` und Commit
  von `referenz/`.
- `pruefen:ablaeufe` grün (Formular ohne die zwei Checkboxen; Abläufe, die sie anklicken, anpassen).
- R7 an den echten Daten: `pruefen:aufnehmen --echt` auf dem alten Stand, `pruefen:vergleichen --echt` auf dem neuen:
  0 Fehler (Produktion hat keinen betroffenen Fall).

### T11 Doku

- `vault/apps/ringwerk/ringwerk.md`: die sieben Befunde aus „Fehler und Lücken im Code“ und „Fachlich“ (Wiederholungsduell,
  Finale ohne Verlängerung) entfernen.
- `factor-correction`, `disciplines-and-factors` (Sperre, Standarddisziplinen), `playoffs-knockout-system`
  (Verlängerung immer, Sieger-Anzeige), `best-of-single` (kein Wiederholungsduell), `league-points-and-tiebreak`
  (korrigierter Teiler, Spalte „Best. Ringe“), `ringwerk-pruefbestand` (drei Szenarien, neuer Ausgangsstand).
- Textbuch: Abschnitt „Befunde beim Ablesen für WD0“ mit Verweis auf diesen Plan als erledigt markieren.
- Plan nach der Umsetzung löschen (Root-`CLAUDE.md`: `plans/` hält nur offene Pläne).

## Tests (Überblick)

Erweitert: `calculateStandings.test.ts`, `duelOutcome.test.ts`, `correction.test.ts`, `lib/results/actions.test.ts`,
`lib/disciplines/actions.test.ts`, `StandingsTable.test.tsx`, `SchedulePdf.test.tsx`, `pruefdaten.test.ts`,
`lib/help/topics.test.ts`. Neu: `lib/standings/standingsSort.test.ts`, `lib/playoffs/queries.test.ts`,
`lib/results/bestOf/saveBestOfDuel.test.ts`, `lib/competitions/actions/ruleset.test.ts`, Markup-Tests für
`DisciplineForm` und die beiden Fieldsets. Die
Charakterisierung aus T2 bleibt unverändert grün.

## Verifikation

1. `pnpm check` grün nach jedem Commit.
2. `pnpm --filter ringwerk pruefen:vergleichen`: Abweichungen nur wie in T10 beschrieben, nach Freigabe neuer
   Ausgangsstand und dann 0 Fehler.
3. `pnpm --filter ringwerk pruefen:ablaeufe` grün, `pnpm --filter ringwerk pruefen` 0 FAIL.
4. R7 an den echten Daten 0 Fehler.
5. `git diff --stat` zeigt keine Änderung an `apps/ringwerk/prisma`.
6. Release allein, an einem Tag ohne Wettkampf, mit Backup und `restore-probe` vorher (`apps/ringwerk/CLAUDE.md`).
