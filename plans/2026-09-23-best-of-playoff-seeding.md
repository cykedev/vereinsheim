# Playoff-Setzung für Best-of-Ligen aus der Best-of-Tabelle

**Datum:** 2026-09-23 · **Branch:** `feat/best-of-playoff-seeding` · **App:** ringwerk

## 1. Context (warum)

Bei **Best-of-Ligen** (`leagueFormat = BEST_OF_SINGLE`) setzen „Playoffs starten" und „nächste
Runde anlegen" nicht nach der Tabelle, die die App anzeigt. Beide rechnen intern immer die
**Rundenturnier-Tabelle** (`getStandingsForCompetition` → `calculateStandings`). Diese Rechnung
kennt keine Duelle:
- `results.find(...)` nimmt pro Paarung die erste gefundene Serie je Schütze, meist Duell 1.
- Diese eine Serie wertet sie wie ein Einzelduell.
- Stechschuss-Serien unterscheidet sie nicht.
- Freilose zählen mit 2 Punkten.

Die Best-of-Spezifikation (`apps/ringwerk/docs/superpowers/specs/2026-06-17-liga-best-of-modus-design.md`
§9) legt fest: **„Seeding aus `calculateBestOfStandings`"**. Umgesetzt wurde das nie.

### Befund (`/debug`, 2026-09-23)

- **Nachgestellt (4 Schützen, Best-of-3):** Der Stärkere gewinnt jede Begegnung 2:1, verliert aber
  Duell 1. Sichtbare Tabelle: A, B, C, D. Interne Setzung: D, C, B, A, also vollständig umgekehrt.
- **Echte Daten** (archivierte Liga „Test 1-gegen-1", Dev-DB): Die Setzung vertauscht Platz 2 und 3
  (Eiden ↔ Eder). Im Halbfinale (1–4, 2–3) ergibt das dieselben Paarungen. Deshalb hat sich ein
  Test des Users korrekt angefühlt. Im Viertelfinale oder an der Qualifikationsgrenze setzt es
  falsch bzw. lässt den Falschen weiterkommen.
- **Betroffen:** Alle 6 Ligen der Live-Kopie sind Best-of, 5 davon aktiv. Keine hat bisher
  Playoffs gestartet, eine Bestandskorrektur ist also nicht nötig.
- **Aufrufer ohne Format-Weiche:** genau `lib/playoffs/actions/start.ts`,
  `lib/playoffs/actions/match.ts` (Neu-Setzung) und `app/(app)/competitions/[id]/playoffs/page.tsx`.
  Auf der Seite ist es harmlos, dort wird nur gezählt, wie viele Teilnehmer aktiv sind. Alle
  anderen (Spielplan, beide PDFs, Vorschau) unterscheiden das Format schon.

## 2. Entscheidungen

**E1 (User, 2026-09-23): Best-of-Ligen behalten Playoffs.** Gesetzt wird aus der Best-of-Tabelle,
wie spezifiziert. Verworfen: Playoffs für Best-of sperren.

**E2: Eine Quelle für die Setzliste.** Neue Funktion `getSeedingStandings(competitionId)` in
`lib/playoffs/queries.ts` wählt je nach Format die richtige Tabelle. Start, nächste Runde und
Playoff-Seite rufen nur noch sie auf. Sie liegt bewusst im Playoff-Modul: Die Setzung ist Sache der
Playoffs, `lib/standings` soll davon nichts wissen. Verworfen: die Weiche in jedem Aufrufer
duplizieren.

**E3: Setzplatz = Position in der Liste, nie `rank`.** Seit 2026-09-23 kann `rank` bei Gleichstand
geteilt sein („1, 1, 3"). `createFirstRoundMatchups` nutzt schon die Reihenfolge, `match.ts` baut
seine Map schon aus `i + 1`. Das bleibt so. `createFirstRoundMatchups` nimmt künftig nur noch den
Ausschnitt, den es braucht:
`SeedingRow = Pick<StandingRow, "participantId" | "withdrawn">`. Beide Tabellenzeilen-Typen
erfüllen ihn.

**E4: Test auf Action-Ebene mit echter Tabellenrechnung.** Gemockt werden nur die DB und das
Framework (Auth, `next/cache`, PDF-Cache). `lib/standings` und `lib/playoffs/queries` laufen echt.
So fällt der Test heute aus genau dem Grund des Bugs durch, und er deckt die Weiche gleich mit ab.
Beide Actions stehen in einer Testdatei mit einem gemeinsamen Daten-Generator. Das Repo hat keine
Fixture-Konvention, Helfer stehen inline.

## 3. Approach

### 3.1 Typ + Setzfunktion

`apps/ringwerk/src/lib/playoffs/bracketSeeding.ts`:

```ts
import type { StandingRow } from "@/lib/standings/calculateStandings"

/**
 * Was die Setzung von einer Tabellenzeile braucht. Rundenturnier- und Best-of-Zeilen erfüllen es;
 * der Setzplatz ist die Position in der Liste (nicht `rank` — der kann geteilt sein).
 */
export type SeedingRow = Pick<StandingRow, "participantId" | "withdrawn">

export function createFirstRoundMatchups(
  standings: SeedingRow[],
  ruleset?: Pick<PlayoffRuleset, "playoffHasViertelfinale" | "playoffHasAchtelfinale"> | null
)
```

Der Rumpf bleibt unverändert. Der Import von `StandingRow` bleibt für den `Pick` stehen.
`calculatePlayoffs.ts` re-exportiert `createFirstRoundMatchups`: prüfen, ob dort ein Typ-Re-Export
nötig ist. Nur falls `tsc` es verlangt, `SeedingRow` dort mit exportieren.

`apps/ringwerk/src/lib/playoffs/queries.ts` (neue Imports + Funktion am Ende):

```ts
import {
  getBestOfStandingsForCompetition,
  getStandingsForCompetition,
} from "@/lib/standings/queries"
import type { SeedingRow } from "./bracketSeeding"

/**
 * Die Gruppentabelle in Setzreihenfolge — je nach Liga-Format die Rundenturnier- oder die
 * Best-of-Tabelle, also genau die Tabelle, die Spielplan-Seite und PDF zeigen. Setzplatz ist die
 * Position in der Liste, nicht `rank` (der ist bei Gleichstand geteilt).
 */
export async function getSeedingStandings(competitionId: string): Promise<SeedingRow[]> {
  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: { leagueFormat: true },
  })
  return competition?.leagueFormat === "BEST_OF_SINGLE"
    ? getBestOfStandingsForCompetition(competitionId)
    : getStandingsForCompetition(competitionId)
}
```

### 3.2 Aufrufer

- `lib/playoffs/actions/start.ts`: Import `getStandingsForCompetition` → `getSeedingStandings` aus
  `@/lib/playoffs/queries`. `const standings = await getSeedingStandings(competitionId)`. Rest
  unverändert (`activeStandings`, `createFirstRoundMatchups(standings, …)`).
- `lib/playoffs/actions/match.ts`: ebenso. Die Map bleibt
  `new Map(standings.map((s, i) => [s.participantId, i + 1]))`, der Kommentar nennt zusätzlich
  „Gruppentabelle des Liga-Formats".
- `app/(app)/competitions/[id]/playoffs/page.tsx`: `getStandingsForCompetition(id)` →
  `getSeedingStandings(id)` im `Promise.all`, Import entsprechend. `activeCount` bleibt gleich.
  Die Seite rechnet danach aber dieselbe Tabelle wie der Start, die Quelle ist konsistent.

## 4. Dateien

| Datei | Änderung |
| --- | --- |
| `apps/ringwerk/src/lib/playoffs/bracketSeeding.ts` | `SeedingRow`, Parametertyp |
| `apps/ringwerk/src/lib/playoffs/queries.ts` | `getSeedingStandings` |
| `apps/ringwerk/src/lib/playoffs/actions/start.ts` | Setzliste aus `getSeedingStandings` |
| `apps/ringwerk/src/lib/playoffs/actions/match.ts` | Neu-Setzung aus `getSeedingStandings` |
| `apps/ringwerk/src/app/(app)/competitions/[id]/playoffs/page.tsx` | `activeCount` aus `getSeedingStandings` |
| `apps/ringwerk/src/lib/playoffs/actions/seeding.test.ts` | **neu** |
| `vault/apps/ringwerk/ringwerk-features.md` | Playoff-Qualifikation + Best-of-Abschnitt |
| `vault/incidents/best-of-playoff-seeding-round-robin-table.md` | **neu** (Provenance) |
| `vault/incidents/incidents.md` | MOC-Eintrag |

Kein Schema, keine Migration, kein Deploy-Vertrag, nichts unter `.claude/`, `scripts/` oder
`vault/decisions/`.

## Required Docs

- `vault/conventions.md` (§6 ActionResult, §8 Gates, §9 „eine Autorität für dieselbe Sache")
- `apps/ringwerk/CLAUDE.md`
- Vault: `ringwerk-features` (Abschnitte „Playoff-Phase", „Liga-Modus BEST_OF_SINGLE", „Geteilte
  Plätze"), `ringwerk-code-conventions` (Wertung & Ranking), `best-of-single`
- Spec: `apps/ringwerk/docs/superpowers/specs/2026-06-17-liga-best-of-modus-design.md` §9
- Muster für Action-Tests mit DB-Mock: `apps/ringwerk/src/lib/matchups/actions.test.ts`

## 5. Test-Fixture (für T1 und T2)

In `apps/ringwerk/src/lib/playoffs/actions/seeding.test.ts`, oben:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  competitionFindUnique: vi.fn(),
  competitionParticipantFindMany: vi.fn(),
  matchupFindMany: vi.fn(),
  matchupCount: vi.fn(),
  playoffMatchCount: vi.fn(),
  playoffMatchFindMany: vi.fn(),
  playoffMatchCreateMany: vi.fn(),
  auditLogCreate: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: m.getAuthSession,
  canManage: (role: string) => role === "ADMIN" || role === "MANAGER",
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock("@/lib/competitions/publicPdfCache", () => ({ revalidatePublicPdf: vi.fn() }))
vi.mock("@/lib/db", () => ({
  db: {
    competition: { findUnique: m.competitionFindUnique },
    competitionParticipant: { findMany: m.competitionParticipantFindMany },
    matchup: { findMany: m.matchupFindMany, count: m.matchupCount },
    playoffMatch: {
      count: m.playoffMatchCount,
      findMany: m.playoffMatchFindMany,
      createMany: m.playoffMatchCreateMany,
    },
    auditLog: { create: m.auditLogCreate },
  },
}))

import { startPlayoffs } from "./start"
import { advanceRound } from "./match"

/** Prisma liefert Decimal — die Tabellenrechner rufen `.toNumber()`. */
const dec = (n: number) => ({ toNumber: () => n })

function series(participantId: string, duelNumber: number | null, ringteiler: number) {
  return {
    participantId,
    duelNumber,
    isTiebreak: false,
    rings: dec(100 - ringteiler),
    teiler: dec(0),
    ringteiler: dec(ringteiler),
    discipline: { teilerFaktor: dec(1) },
  }
}

/**
 * Liga, in der `ids` die wahre Stärke-Reihenfolge ist (jeder gegen jeden, alle abgeschlossen).
 * Best-of: der Stärkere gewinnt 2:1, verliert aber Duell 1 — genau das, woran die
 * Rundenturnier-Rechnung scheitert (sie wertet nur die erste Serie je Schütze).
 * Klassisch: eine Serie je Schütze, der Stärkere gewinnt.
 */
function league(ids: string[], format: "BEST_OF_SINGLE" | "DOUBLE_ROUND_ROBIN") {
  const matchups = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const [strong, weak] = [ids[i], ids[j]]
      matchups.push({
        id: `m-${strong}-${weak}`,
        status: "COMPLETED",
        homeParticipantId: strong,
        awayParticipantId: weak,
        series:
          format === "BEST_OF_SINGLE"
            ? [
                series(weak, 1, 5), series(strong, 1, 9),
                series(strong, 2, 5), series(weak, 2, 9),
                series(strong, 3, 5), series(weak, 3, 9),
              ]
            : [series(strong, null, 5), series(weak, null, 9)],
      })
    }
  }
  m.competitionFindUnique.mockResolvedValue({
    id: "c1",
    status: "ACTIVE",
    playoffBestOf: 5,
    playoffHasViertelfinale: ids.length >= 8,
    playoffHasAchtelfinale: false,
    leagueFormat: format,
    scoringMode: "RINGTEILER",
    disciplineId: "d1",
    groupBestOf: 3,
    groupPlayAllDuels: true,
    groupTiebreaker1: null,
    groupTiebreaker2: null,
  })
  m.competitionParticipantFindMany.mockResolvedValue(
    ids.map((id) => ({ status: "ACTIVE", participant: { id, firstName: id, lastName: `Name${id}` } }))
  )
  m.matchupFindMany.mockResolvedValue(matchups)
}

/** Die angelegten Paarungen als "A–B" in Setzreihenfolge. */
function createdPairs(): string[] {
  const { data } = m.playoffMatchCreateMany.mock.calls[0][0] as {
    data: { participantAId: string; participantBId: string }[]
  }
  return data.map((d) => `${d.participantAId}–${d.participantBId}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  m.getAuthSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } })
  m.matchupCount.mockResolvedValue(0)
  m.playoffMatchCount.mockResolvedValue(0)
  m.playoffMatchCreateMany.mockResolvedValue({ count: 0 })
  m.auditLogCreate.mockResolvedValue({})
})
```

Prettier bricht die `series`-Arrays beim Formatieren um. Das ist erwartet.

## 6. Tasks (je ein Commit, `pnpm check` grün vor jedem Commit)

**T1 — Setzfunktion + Start aus der Best-of-Tabelle.**
1. Test zuerst: `seeding.test.ts` mit dem Fixture aus §5 und:

```ts
describe("startPlayoffs — Setzung", () => {
  it("setzt eine Best-of-Liga nach der Best-of-Tabelle (Halbfinale 1–4, 2–3)", async () => {
    league(["A", "B", "C", "D"], "BEST_OF_SINGLE")
    expect(await startPlayoffs("c1")).toEqual({ success: true })
    expect(createdPairs()).toEqual(["A–D", "B–C"])
  })

  it("setzt eine Doppelrunden-Liga weiter nach der Rundenturnier-Tabelle", async () => {
    league(["A", "B", "C", "D"], "DOUBLE_ROUND_ROBIN")
    expect(await startPlayoffs("c1")).toEqual({ success: true })
    expect(createdPairs()).toEqual(["A–D", "B–C"])
  })
})
```

   Laufen lassen. **Erwartet rot** nur beim Best-of-Test mit `["D–A", "C–B"]` (der Bug), die
   Doppelrunde ist grün. Andere rote Gründe (Mock fehlt, Crash) zuerst im Fixture beheben, nicht im
   Produktionscode.
2. `SeedingRow` + Parametertyp (§3.1), `getSeedingStandings` (§3.1), `start.ts` (§3.2).
3. Test grün, `pnpm check` grün.

Commit: `fix(ringwerk): seed best-of playoffs from the best-of table`

**T2 — Neu-Setzung nach der Runde aus derselben Quelle.**
1. Test zuerst, in `seeding.test.ts` ergänzen:

```ts
describe("advanceRound — Neu-Setzung", () => {
  it("setzt die Halbfinal-Paarungen einer Best-of-Liga nach der Best-of-Tabelle neu", async () => {
    const ids = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]
    league(ids, "BEST_OF_SINGLE")
    // Viertelfinale wie korrekt gesetzt (1–8, 2–7, 3–6, 4–5); jeweils gewinnt der Gesetzte.
    const quarterFinals = [0, 1, 2, 3].map((i) => ({
      id: `qf${i}`,
      round: "QUARTER_FINAL",
      status: "COMPLETED",
      winsA: 3,
      winsB: 1,
      participantAId: ids[i],
      participantBId: ids[7 - i],
    }))
    m.playoffMatchFindMany.mockResolvedValue(quarterFinals)

    expect(await advanceRound("c1")).toEqual({ success: true })
    expect(createdPairs()).toEqual(["P1–P4", "P2–P3"])
  })
})
```

   **Erwartet rot** mit `["P4–P1", "P3–P2"]`: Die Rundenturnier-Rechnung dreht die Reihenfolge um,
   die Sieger P1–P4 liegen dort auf den Positionen 8–5.
2. `match.ts` (§3.2).
3. Test grün, `pnpm check` grün.

Commit: `fix(ringwerk): re-seed best-of playoff rounds from the best-of table`

**T3 — Playoff-Seite aus derselben Quelle.** `playoffs/page.tsx` (§3.2). Kein neuer Test: Die Seite
zählt nur aktive Teilnehmer, der Wert bleibt gleich. Prüfung in `/validate` im Browser.
Commit: `refactor(ringwerk): read the playoff page count from the seeding table`

**T4 — Doku (Vault).**
- `ringwerk-features.md`:
  - Abschnitt „Playoff-Phase" → „Qualifikation": nach „Seeding: 1 vs. letzter, …" ergänzen:
    „Setzliste ist die **Gruppentabelle des Liga-Formats** (Doppelrunde: Punkte-Tabelle;
    BEST_OF_SINGLE: Best-of-Tabelle), gesetzt nach **Position** — nicht nach dem ggf. geteilten
    Platz. Eine Quelle für Start, Neu-Setzung und Playoff-Seite: `getSeedingStandings`
    (`lib/playoffs/queries.ts`)."
  - Abschnitt „Liga-Modus BEST_OF_SINGLE": neuer Unterabschnitt `### Playoffs` vor `### PDF`:
    „Optional wie bei der Doppelrunde (`playoffBestOf`, Viertel-/Achtelfinale). Setzung aus der
    Best-of-Tabelle (Spec 2026-06-17 §9; umgesetzt 2026-09-23 — vorher las die Setzung die
    Rundenturnier-Tabelle, siehe [[best-of-playoff-seeding-round-robin-table]])."
- Neue Note `vault/incidents/best-of-playoff-seeding-round-robin-table.md` (Template
  `vault/_templates/incident.md`):
  - Frontmatter: `id: best-of-playoff-seeding-round-robin-table`, `type: incident`,
    `title: "best-of-playoff-seeding-round-robin-table"`,
    `keywords: [Playoff-Setzung, Seeding, Best-of-Liga, BEST_OF_SINGLE, Setzliste, Qualifikation, Rundenturnier-Tabelle, calculateStandings, calculateBestOfStandings, getSeedingStandings, Neu-Setzung, Incident]`,
    `tags: [incident]`, `relates_to: ["[[ringwerk]]", "[[best-of-single]]"]`,
    `part_of: ["[[incidents]]"]`.
  - TL;DR:
    - 2026-09-23 (ringwerk): Playoff-Start und Neu-Setzung lasen bei Best-of-Ligen die
      Rundenturnier-Tabelle.
    - Diese wertet pro Paarung nur die erste Serie je Schütze, und Freilose zählen 2 Punkte.
      Spec §9 („Seeding aus `calculateBestOfStandings`") war nie umgesetzt.
    - Gefunden im Code-Review. Nachgestellt: vollständig umgekehrte Setzung. Echte Daten: Platz 2/3
      vertauscht; im Halbfinale unsichtbar, weil 2–3 dieselbe Paarung ist.
    - Keine Liga hatte Playoffs gestartet, keine Bestandskorrektur nötig.
    - Behoben über `getSeedingStandings`; gepinnt in `lib/playoffs/actions/seeding.test.ts`.
  - Lehre: Eine Format-Weiche gehört an **eine** Stelle. Neue Aufrufer der Tabelle gehen über sie.
- `vault/incidents/incidents.md`: Zeile
  `- [[best-of-playoff-seeding-round-robin-table]] — best-of-playoff-seeding-round-robin-table`
  in die Liste (alphabetisch nach `best-of-standings-direct-comparison-tiebreak`).
- `node .claude/vault-lint.mjs` grün.

Commit: `docs(vault): record the best-of playoff seeding fix`

## 7. Verification

1. `pnpm check`: alle fünf Gates grün, beide Apps.
2. `bash scripts/consistency-check.sh`: grün.
3. Die zwei neuen Best-of-Tests waren vor dem Fix rot, mit genau `["D–A", "C–B"]` bzw.
   `["P4–P1", "P3–P2"]`. Die Ausgabe steht im Ledger.
4. Browser (`preview_start` „ringwerk", der User meldet sich selbst an): `/competitions/<id>/playoffs`
   einer aktiven Best-of-Liga zeigt denselben Text wie vorher („Top 4 von N Teilnehmern …" bzw.
   den Hinweis auf zu wenige Teilnehmer). Playoffs werden dabei **nicht** gestartet: Das wäre eine
   Datenänderung in der Live-Kopie. Die Setzung beim Start ist durch T1/T2 belegt.
5. Nicht belegbar mit diesen Daten: ein echter Playoff-Start einer Best-of-Liga. Keine Liga hat
   alle Paarungen abgeschlossen. Im Bericht als „nicht belegt" führen (conventions §9).
