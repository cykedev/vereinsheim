# Ringwerk: Rückzug sperrt den Playoff-Start nicht mehr

Branch `feat/playoff-start-withdrawn`, Basis `main` (`adfd8fcb`, nach dem History-Rewrite).

## Kontext

Zieht ein Teilnehmer während der Saison zurück, bleiben seine noch nicht gespielten Paarungen `PENDING`
(`withdrawParticipant` ändert nur die Einschreibung). Diese Paarungen werden nirgends mehr gewertet und haben keine
Ergebniseingabe:

- Tabelle: `calculateStandings` und `calculateBestOfStandings` überspringen Paarungen mit Zurückgezogenen.
- Spielplan: `ClassicLegTable` und `BestOfMatchupTable` zeigen sie als `isVoid` durchgestrichen, ohne Erfassungsknopf
  ([[void-match-rendering]]).

`startPlayoffs` (`apps/ringwerk/src/lib/playoffs/actions/start.ts:42`) zählt aber **alle** `PENDING`-Paarungen. Die
Playoff-Seite (`apps/ringwerk/src/app/(app)/competitions/[id]/playoffs/page.tsx:37`) zählt genauso und graut den
Start-Knopf aus („Noch N ausstehende Paarungen in der Gruppenphase“). Eine Liga mit einem Rückzug während der Saison
kann deshalb nie Playoffs starten.

**Beleg (rot, `/debug`):** Zwei neue Tests in `seeding.test.ts` (Liga A–E, C zurückgezogen, A–C und C–E offen)
schlagen in beiden Formaten fehl: `startPlayoffs` liefert „Es gibt noch ausstehende Paarungen in der Gruppenphase.“
statt zu starten. Bisher sah das kein Test, weil das Mock `matchupCount` immer 0 lieferte und die Fixture keine offenen
Paarungen kannte.

## Ansatz

Eine Abfrage für beide Stellen: `countOpenGroupMatchups(competitionId)` in `apps/ringwerk/src/lib/playoffs/queries.ts`
(neben `getSeedingStandings`, das ebenfalls Start und Seite bedient). Sie lädt die `PENDING`-Paarungen (nur die beiden
Teilnehmer-IDs) und die Teilnehmer-IDs mit Status `WITHDRAWN` und zählt die Paarungen ohne Zurückgezogenen, mit einem
`Set` wie in `calculateStandings`.

Verworfen: ein Prisma-Relationsfilter im `count`. Die Relation `Participant → CompetitionParticipant` ist nicht auf den
Wettbewerb beschränkt; der Filter bräuchte auf beiden Seiten `none: { competitionId, status: "WITHDRAWN" }` und wäre mit
den Mocks der Tests nicht prüfbar. Eine Liga hat höchstens einige hundert Paarungen, zwei kleine Abfragen sind egal.

Nicht im Umfang (eigene offene Punkte in `vault/apps/ringwerk/ringwerk.md`): die Prüfung „Spielplan erzeugt“ und die
Sperre der Gruppenergebnisse nach dem Playoff-Start.

## Required Docs

- `vault/apps/ringwerk/ringwerk-code-conventions.md`
- `vault/apps/ringwerk/void-match-rendering.md`, `vault/apps/ringwerk/playoffs-knockout-system.md`
- `vault/conventions.md` §9 (Charakterisierungstests, Mutation gegenprüfen, Datenlage vor der Sichtprüfung)

## Aufgaben

### T1 Test und Fix (ein Commit)

1. Fixture in `apps/ringwerk/src/lib/playoffs/actions/seeding.test.ts`:
   - `LeagueOptions.pending?: string[]` (Schlüssel „Stärker-Schwächer“): diese Begegnungen sind `PENDING` ohne Serien,
     in der Doppelrunde beide Runden.
   - Typ `MatchupRow` statt `unknown[]`.
   - Helfer `byStatus(rows, args)`, der wie Prisma nach `where.status` filtert. `league()` setzt damit
     `competitionParticipantFindMany`, `matchupFindMany` und `matchupCount` (die Fixture bleibt so unabhängig davon, ob
     der Code zählt oder lädt). Einträge bekommen `participantId`.
2. Zwei Tests im Block „startPlayoffs — %s, Normalfall“ (beide Formate):
   - „offene Begegnungen eines Zurückgezogenen sperren den Start nicht“: A–E, C zurückgezogen, `pending: ["A-C",
     "C-E"]` (C einmal auswärts, einmal zu Hause) → `{ success: true }`, Paare `A–E`, `B–D`.
   - „eine offene Begegnung zwischen Aktiven sperrt den Start weiter“: dazu `pending: ["A-C", "D-E"]` → Fehler „Es gibt
     noch ausstehende Paarungen in der Gruppenphase.“, kein `createMany`.
3. Rot bestätigen: `pnpm --filter ringwerk exec vitest run src/lib/playoffs/actions/seeding.test.ts` → der erste Test
   fällt in beiden Formaten.
4. `countOpenGroupMatchups` in `apps/ringwerk/src/lib/playoffs/queries.ts`:

   ```ts
   /**
    * Offene Paarungen der Gruppenphase, die den Playoff-Start sperren. Paarungen mit einem zurückgezogenen
    * Teilnehmer zählen nicht: Sie werden nicht gewertet und haben keine Ergebniseingabe.
    */
   export async function countOpenGroupMatchups(competitionId: string): Promise<number> {
     const [pending, withdrawn] = await Promise.all([
       db.matchup.findMany({
         where: { competitionId, status: "PENDING" },
         select: { homeParticipantId: true, awayParticipantId: true },
       }),
       db.competitionParticipant.findMany({
         where: { competitionId, status: "WITHDRAWN" },
         select: { participantId: true },
       }),
     ])
     const withdrawnIds = new Set(withdrawn.map((e) => e.participantId))
     return pending.filter(
       (m) =>
         !withdrawnIds.has(m.homeParticipantId) &&
         !(m.awayParticipantId !== null && withdrawnIds.has(m.awayParticipantId))
     ).length
   }
   ```

5. `start.ts`: `db.matchup.count(...)` durch `countOpenGroupMatchups(competitionId)` ersetzen; im Doc-Kommentar
   „Keine PENDING-Paarungen in der Gruppenphase“ → „Keine offenen Paarungen in der Gruppenphase (Paarungen mit
   Zurückgezogenen zählen nicht)“.
6. `playoffs/page.tsx`: `db.matchup.count(...)` durch `countOpenGroupMatchups(id)` ersetzen, Import von `db` entfernen
   (einzige Nutzung).
7. Grün bestätigen (gleicher Befehl wie 3.).
8. Mutation gegenprüfen (Datei vorher nach dem Scratchpad kopieren, danach von dort zurück, nicht `git checkout`):
   - nur die Heimseite prüfen → Test 1 rot
   - nur die Auswärtsseite prüfen → Test 1 rot
   - Filter weg (alle `PENDING` zählen) → Test 1 rot
   - bei irgendeinem Rückzug 0 liefern → Test 2 rot

### T2 Doku (ein Commit)

1. `vault/apps/ringwerk/ringwerk.md`: Punkt „Rückzug sperrt den Playoff-Start“ unter „Offene Einzelpunkte“ entfernen.
2. `vault/apps/ringwerk/ringwerk-features.md`, „Start-Voraussetzungen“: „Keine PENDING-Paarungen in der Gruppenphase“
   → „Keine offenen Paarungen in der Gruppenphase; Paarungen mit Zurückgezogenen zählen nicht
   (`countOpenGroupMatchups`, auch für den Knopf auf der Playoff-Seite)“.
3. `apps/ringwerk/.claude/tasks/lessons.md`: ein Eintrag (ein Mock, der `where` ignoriert, verdeckte, welche Paarungen
   als offen zählen), danach `/consolidate-lessons`.
4. `node .claude/vault-lint.mjs` bzw. `/sync-graph` grün.

## Verifikation

- `pnpm check` von der Wurzel, alle fünf Gates grün (einmal mit `--force` für Ringwerk, `.env` ist verlinkt).
- Sichtprüfung der Playoff-Seite: vorher in der Dev-DB nachsehen, ob es eine aktive Liga mit Rückzug und offener
  Paarung des Zurückgezogenen gibt. Gibt es keine, steht im Bericht „nicht belegt“, abgedeckt durch die Tests oben
  (Seite und Action nutzen dieselbe Funktion).
- `/validate` → `reports/2026-10-15-playoff-start-withdrawn.md`, danach `/review`.
