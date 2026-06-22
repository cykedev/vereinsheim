# Teiler-Faktor nur bei gemischter Disziplin — Design

**Datum:** 2026-06-17
**Typ:** Bugfix (systemweit)
**Status:** Approved

## Problem

Bei einem Wettbewerb mit **fester Disziplin** (`Competition.disciplineId !== null`) und Ringteiler-/Teiler-Wertung wird der Disziplin-Korrekturfaktor (`Discipline.teilerFaktor`) auf den Teiler angewendet. Laut Domänenregel darf die Faktor-Korrektur **ausschließlich bei gemischter Disziplin** (`disciplineId === null`) greifen.

**Beispiel (Liga «1 gegen 1 LP 2026/27», feste Disziplin Luftpistole, Faktor 0,333):**
Beyer Markus `90 R · 148,0 T` → angezeigt `RT 59,3` = `100 − 90 + 148 × 0,333`.
Korrekt wäre `100 − 90 + 148 = 158,0` (Faktor 1,0).

## Domänenregel (bestätigt)

Quellen: `.claude/docs/data-model.md:28`, `.claude/docs/features.md:80,88,91`.

- `Competition.disciplineId === null` → **gemischt** → Faktor-Korrektur **aktiv**
- `Competition.disciplineId !== null` → **feste Disziplin** → Faktor-Korrektur **inaktiv** (effektiv 1,0)

## Root Cause

Die Regel ist nirgends im Berechnungspfad implementiert. Die Berechnungsfunktion `calculateRingteiler` / `calculateCorrectedTeiler` (`src/lib/scoring/calculateScore.ts`) ist korrekt — sie multipliziert nur den übergebenen Faktor. Der Fehler liegt in **allen Aufrufern**: Sie ziehen den Faktor bedingungslos aus `discipline.teilerFaktor`, ohne den Wettbewerbskontext (fest/gemischt) zu prüfen.

## Lösung

### Kernregel zentralisieren

Neue reine Helper-Funktion in `src/lib/scoring/calculateScore.ts`:

```ts
/** Faktor-Korrektur greift nur bei gemischter Disziplin (Competition.disciplineId === null). */
export function effectiveTeilerFaktor(
  competitionDisciplineId: string | null,
  faktor: number
): number {
  return competitionDisciplineId === null ? faktor : 1
}
```

Alle Aufrufer ziehen den Faktor künftig durch diese Funktion. Der echte `teilerFaktor` bleibt unverändert in DB und Query — nur seine _Anwendung_ wird konditioniert.

**Verworfene Alternative:** den Faktor schon bei der Disziplin-Auflösung auf 1 überschreiben. Verschleiert den echten DB-Wert und verfälscht die on-the-fly-Queries, die `series.discipline.teilerFaktor` direkt lesen.

### Betroffene Stellen (vier Schichten)

**1. Persistierende Actions** (berechnen + speichern `ringteiler`):

| Datei                                      | Funktion                 | Kontextquelle                                   |
| ------------------------------------------ | ------------------------ | ----------------------------------------------- |
| `src/lib/results/actions.ts:77‑93`         | `saveMatchResult` (Liga) | `matchup.competition.disciplineId`              |
| `src/lib/series/actions.ts:127‑128`        | `saveEventSeries`        | `competition.disciplineId` (bereits selektiert) |
| `src/lib/series/actions.ts:342‑343`        | `saveSeasonSeries`       | `competition.disciplineId`                      |
| `src/lib/series/actions.ts:480‑481`        | `updateSeasonSeries`     | `competition.disciplineId`                      |
| `src/lib/playoffs/actions/duel.ts:159‑170` | `savePlayoffDuelResult`  | `duel.playoffMatch.competition.disciplineId`    |

Wo `disciplineId` nicht direkt selektiert ist (`results/actions.ts`, `playoffs/duel.ts`), wird die Query minimal um `disciplineId: true` erweitert. Der Aufruf wird zu `effectiveTeilerFaktor(competitionDisciplineId, discipline.teilerFaktor.toNumber())`. Wichtig: Es zählt die **Competition**-`disciplineId`, nicht die aufgelöste Teilnehmer-Disziplin — der Wert wird vor dem Überschreiben von `homeDiscipline`/`awayDiscipline` festgehalten.

**2. On-the-fly-Berechnung** (Ranking/Anzeige):

| Datei                                            | Stelle                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `src/lib/scoring/rankEventParticipants.ts:60‑70` | `correctedTeiler`, `measuredValue`, `score` — alle aus einem zentralen `faktor` |
| `src/lib/scoring/calculateSeasonStandings.ts:74` | `bestCorrectedTeiler`                                                           |

`rankEventParticipants` erhält `EventConfig`; dieses wird um `competitionDisciplineId: string | null` erweitert und am Query-Ursprung (`src/lib/competitions/queries.ts`) befüllt. Der Faktor wird dann einmal zentral berechnet: `const faktor = effectiveTeilerFaktor(config.competitionDisciplineId, s.discipline.teilerFaktor)`.

**Saison-Sonderfall:** Saison-Wettbewerbe sind laut `features.md:319` strukturell **immer gemischt** (`disciplineId === null`). `calculateSeasonStandings` und `save/updateSeasonSeries` sind damit funktional nicht betroffen (Faktor bleibt aktiv = korrekt). Diese Annahme wird beim Implementieren verifiziert (kann ein Admin eine Saison mit fester Disziplin anlegen?). Trifft sie zu, bleibt `calculateSeasonStandings` unverändert mit erklärendem Kommentar; trifft sie nicht zu, wird `isMixed` analog durchgereicht.

**3. Live-UI** («korr. Teiler»-Hint unter dem Eingabefeld):

| Datei                                                  | Änderung                                               |
| ------------------------------------------------------ | ------------------------------------------------------ |
| `src/app/(app)/competitions/[id]/schedule/page.tsx:99` | `competitionTeilerFaktor` über `effectiveTeilerFaktor` |
| `src/app/(app)/competitions/[id]/series/page.tsx:161`  | `teilerFaktor`-Prop über `effectiveTeilerFaktor`       |

Die Dialoge (`ResultEntryDialog`, `EventSeriesDialog`, `SeasonSeriesDialog`) und `ScheduleView` bleiben unverändert — sie prüfen bereits `faktor !== 1`. Erhalten sie bei fester Disziplin `1`, verschwindet der Hint automatisch. Bei fester Disziplin ist `participant.teilerFaktor` (per-CP) ohnehin `null`, sodass `ScheduleView` korrekt auf den effektiven `competitionTeilerFaktor` zurückfällt.

**4. Bestandsdaten:** Kein Recompute. Die sichtbaren Werte sind Seed-/Testdaten.

## Tests

- **Unit** `effectiveTeilerFaktor`: `disciplineId !== null` → 1; `disciplineId === null` → Faktor unverändert.
- **Action-Ebene** je `saveMatchResult` / `saveEventSeries` / `savePlayoffDuelResult`: feste LP-Disziplin (0,333) ⇒ gespeicherter `ringteiler` ohne Faktor; gemischter Wettbewerb ⇒ weiterhin mit Faktor.
- **Ranking** `rankEventParticipants`: festes Event ⇒ `correctedTeiler`/`score` ohne Faktor; gemischtes Event ⇒ mit Faktor.
- **Bestehende Tests** in `calculateScore.test.ts` bleiben gültig (die Funktion selbst ändert sich nicht).
- **Seed-Check:** sicherstellen, dass der Seed konsistente Werte erzeugt (läuft er über Actions/Calculate, ist er nach dem Fix automatisch korrekt).

## Nicht-Ziele

- Keine Änderung an der Berechnungsformel selbst (`calculateRingteiler`, `calculateCorrectedTeiler`).
- Keine Migration / kein Daten-Recompute.
- Kein Refactoring der Disziplin-Auflösungslogik über das Nötige hinaus.

## Entscheidungen

| Frage                   | Entscheidung                                                     |
| ----------------------- | ---------------------------------------------------------------- |
| Umfang                  | Alle Wettbewerbstypen konsistent (Liga, Event, Saison, Playoffs) |
| Bestandsdaten           | Nicht anfassen (Seed-/Testdaten)                                 |
| Recompute-Mechanismus   | Entfällt                                                         |
| Ort der Helper-Funktion | `src/lib/scoring/calculateScore.ts`                              |
