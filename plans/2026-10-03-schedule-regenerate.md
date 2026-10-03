# Spielplan neu generieren — für Ligen ohne jedes Ergebnis

**Datum:** 2026-10-03 · **Branch:** `feat/schedule-regenerate` · **App:** ringwerk

## 1. Context (warum)

Seit `feat/schedule-home-away-balance` werden Spielpläne mit ausgeglichener A/B-Verteilung
generiert. Bestehende Ligen profitieren davon nur, wenn man sie neu generiert. Die UI zeigt
„Spielplan generieren“ aber nur an, solange eine Liga **gar keine** Paarungen hat
(`schedule/page.tsx`, `!scheduleStatus.hasSchedule`). Ein bestehender Plan lässt sich also nicht
neu erzeugen. In der Prod-Kopie vom 2026-10-03 haben alle fünf aktiven 1-gegen-1-Ligen
**0 Ergebnisse**. Der User will sie nach dem Deploy über die UI neu generieren.

Befunde aus der Analyse:

- **Datenverlust-Falle:** `generateCompetitionSchedule` prüft nur `COMPLETED`. Eine Best-of-Paarung
  bleibt `PENDING`, bis alle Duelle entschieden sind (`saveBestOfDuel.ts:101`). Steht Duell 1
  schon drin, löscht das Neu-Generieren die Paarung. Der Fremdschlüssel `Series.matchupId` steht
  auf `ON DELETE SET NULL` (`confdeltype = n`). Die Serie bliebe deshalb still verwaist stehen.
  Ebenso ungeprüft: `WALKOVER` (Kampflos-Sieg) und gestartete Playoffs.
- **Falscher Hinweis:** Die Seite schreibt „… da bereits {totalMatchups} Paarung(en) abgeschlossen
  sind“. Das ist die Gesamtzahl, nicht die Zahl der abgeschlossenen.
- **Falscher Dialogtext:** „Es wird ein Doppelrunden-Spielplan (Hin- und Rückrunde) …“ steht auch
  bei Best-of-Ligen. Der (bisher nie sichtbare) Neu-Generieren-Text behauptet, abgeschlossene
  Paarungen blieben erhalten.
- **Öffentliches PDF veraltet:** `generateCompetitionSchedule` ruft kein `revalidatePublicPdf` auf.
  Nach dem Generieren zeigt `/api/public/c/<slug>/pdf` bis zu 24 h den alten Plan. Die
  Ergebnis-Actions machen es richtig (`results/actions.ts:204`).
- **Kein Erfolgs-Toast** nach der mutierenden Action (Konvention §2).

## 2. Entscheidungen

**E1: Neu generieren nur ohne jedes Ergebnis.** Gesperrt ist es, sobald eines davon existiert:

- eine Paarung `COMPLETED`;
- eine Paarung `WALKOVER`;
- eine Serie an einer Paarung der Liga (auch an `PENDING`, das deckt halbe Best-of-Begegnungen ab);
- eine Playoff-Paarung.

Verworfen: nur Paarungen ohne Ergebnis neu würfeln. Dann ergäbe sich kein „jeder gegen jeden“
mehr.

**E2: Eine Quelle für die Sperre.** Neue Query `getScheduleResultCounts(competitionId)` in
`lib/matchups/queries.ts` liefert die vier Zahlen. Die reine Funktion
`scheduleRegenerationBlocker(counts)` in `lib/matchups/regeneration.ts` macht daraus die
Sperrbegründung oder `null`. Seite (Button sichtbar? Hinweis?) und Action (Abbruch) nutzen beide
dieselbe Funktion. Die Action prüft sie auch dann, wenn die UI den Button nicht zeigt.

**E3: Bestätigung über `ConfirmDialog`** (Konvention §2) statt eigenem `AlertDialog`. Beim
Neu-Generieren `destructive`. Die Texte erzeugt die reine Funktion `scheduleDialogText(...)`,
damit sie testbar sind:

- Neu, Best-of: „Es wird ein Spielplan „Jeder gegen jeden“ (eine Runde) für alle aktiven
  Teilnehmer generiert.“
- Neu, Doppelrunde: „Es wird ein Doppelrunden-Spielplan (Hin- und Rückrunde) für alle aktiven
  Teilnehmer generiert.“
- Neu generieren (beide Formate): „Der bestehende Spielplan wird gelöscht und neu erstellt.
  Spieltage und Gegner ändern sich dabei. Bereits verteilte oder ausgedruckte Spielpläne sind
  danach veraltet.“

**E4: Icon.** Neu: `CalendarPlus` (wie bisher). Neu generieren: `RefreshCw`. Die
Icon-Tabelle (§4) belegt `RefreshCw` nicht, es kollidiert also nicht.

## 3. Dateien

| Datei | Änderung |
| --- | --- |
| `apps/ringwerk/src/lib/matchups/regeneration.ts` (neu) | `ScheduleResultCounts`, `scheduleRegenerationBlocker`, `scheduleDialogText` |
| `apps/ringwerk/src/lib/matchups/regeneration.test.ts` (neu) | rein |
| `apps/ringwerk/src/lib/matchups/queries.ts` | `getScheduleResultCounts`; `getScheduleStatus` liefert `regenerationBlocker` |
| `apps/ringwerk/src/lib/matchups/types.ts` | `ScheduleStatus`: `hasCompletedMatchups` → `regenerationBlocker: string \| null` |
| `apps/ringwerk/src/lib/matchups/actions.ts` | Sperre über E2, `revalidatePublicPdf` |
| `apps/ringwerk/src/lib/matchups/actions.test.ts` | Mocks + neue Fälle |
| `apps/ringwerk/src/components/app/matchups/GenerateScheduleButton.tsx` | `ConfirmDialog`, Texte, Label/Icon, Erfolgs-Toast |
| `apps/ringwerk/src/app/(app)/competitions/[id]/schedule/page.tsx` | Sichtbarkeit + Hinweis |
| `vault/apps/ringwerk/league-mode.md` | Abschnitt Neu generieren |

## Required Docs

- `vault/conventions.md` §2 (ConfirmDialog, Toasts), §3 (Typografie, Ellipsis), §4 (Icons)
- `vault/apps/ringwerk/league-mode.md`, `vault/apps/ringwerk/pdf-public-urls.md` (Cache-Invalidierung)

## 4. Tasks

### Task 1: Sperrlogik rein (Test zuerst)

`regeneration.ts`:

```ts
export interface ScheduleResultCounts {
  completed: number
  walkover: number
  series: number
  playoffs: number
}

/** Begründung, warum der Spielplan nicht (neu) generiert werden darf — oder null. */
export function scheduleRegenerationBlocker(c: ScheduleResultCounts): string | null {
  if (c.playoffs > 0) return "Spielplan kann nicht neu generiert werden — die Playoffs laufen bereits."
  const decided = c.completed + c.walkover
  if (decided > 0) {
    return `Spielplan kann nicht neu generiert werden — ${decided} Paarung(en) bereits entschieden.`
  }
  if (c.series > 0) {
    return "Spielplan kann nicht neu generiert werden — es sind bereits Ergebnisse erfasst."
  }
  return null
}

export function scheduleDialogText(input: {
  hasSchedule: boolean
  leagueFormat: "DOUBLE_ROUND_ROBIN" | "BEST_OF_SINGLE"
}): { title: string; description: string; confirmLabel: string }
```

`scheduleDialogText` liefert:

- Neu: Titel „Spielplan generieren?“, Button „Generieren“, Beschreibung je Format (E3).
- Bestehend: Titel „Spielplan neu generieren?“, Button „Neu generieren“, Beschreibung (E3).

Der Typ `LeagueFormat` kommt aus `@/generated/prisma/client`, statt die String-Union zu
wiederholen.

Tests `regeneration.test.ts`:

- Alle Zahlen 0 → `null`.
- Je eine Zahl > 0 → Text. Bei `completed: 2, walkover: 1` enthält er „3 Paarung“. Bei nur
  `series: 1` enthält er „Ergebnisse erfasst“. Bei `playoffs` ist der Playoff-Text vorrangig.
- `scheduleDialogText`: Best-of neu enthält „Jeder gegen jeden“ und **nicht** „Doppelrunde“.
  Doppelrunde neu enthält „Hin- und Rückrunde“. Neu generieren enthält „Gegner ändern sich“ und
  **nicht** „bleiben erhalten“.

Commit: `feat(ringwerk): add the schedule regeneration guard`.

### Task 2: Query + Status

`queries.ts`:

```ts
export async function getScheduleResultCounts(competitionId: string): Promise<ScheduleResultCounts> {
  const [completed, walkover, series, playoffs] = await Promise.all([
    db.matchup.count({ where: { competitionId, status: "COMPLETED" } }),
    db.matchup.count({ where: { competitionId, status: "WALKOVER" } }),
    db.series.count({ where: { matchup: { competitionId } } }),
    db.playoffMatch.count({ where: { competitionId } }),
  ])
  return { completed, walkover, series, playoffs }
}
```

`getScheduleStatus` liefert `{ hasSchedule, totalMatchups, regenerationBlocker }`. Dabei wird
`regenerationBlocker` aus `scheduleRegenerationBlocker(await getScheduleResultCounts(id))`
berechnet. `hasCompletedMatchups` entfällt. Einziger Konsument ist `schedule/page.tsx`, siehe
Task 4.

Commit: `refactor(ringwerk): derive the schedule status from the regeneration guard`.

### Task 3: Action (Test zuerst)

`actions.test.ts`:

- Mocks ergänzen: `db.series.count` (`seriesCountMock`), `db.playoffMatch.count`
  (`playoffMatchCountMock`), `@/lib/competitions/publicPdfCache` → `revalidatePublicPdf`.
- In jedem `beforeEach` stehen beide neuen Counts auf `0`.
- Neue Fälle (Best-of, 5 Teilnehmer):
  - **„Duell 1 eingetragen, Paarung offen“**: `matchupCount` 0, `seriesCount` 2 → Fehler
    „Ergebnisse erfasst“, kein `$transaction`. Gegenprobe: vor der Änderung grün generiert (also
    rot).
  - `WALKOVER`: `matchupCountMock` liefert für `status: "WALKOVER"` 1 (`mockImplementation` nach
    `where.status`) → Fehler, kein `$transaction`.
  - Playoffs gestartet → Fehler, kein `$transaction`.
  - Erfolg → `revalidatePublicPdf` mit `"c1"`.
- Den bestehenden Fall „abgeschlossene Paarungen“ auf die neue Meldung anpassen
  (`stringContaining("Paarung(en) bereits entschieden")`).

`actions.ts`: Den `completedCount`-Block durch Folgendes ersetzen.

```ts
  // Neu generieren nur ohne jedes Ergebnis — eine Best-of-Paarung bleibt PENDING, bis alle Duelle
  // entschieden sind, und Series.matchupId steht auf ON DELETE SET NULL: ein Löschen ließe
  // erfasste Serien still verwaisen.
  const blocker = scheduleRegenerationBlocker(await getScheduleResultCounts(competitionId))
  if (blocker) return { error: blocker }
```

Nach dem `revalidatePath` kommt `revalidatePublicPdf(competitionId)` dazu. Der Kopfkommentar wird
angepasst.

Commit: `fix(ringwerk): block schedule regeneration once any result exists`.

### Task 4: UI

`GenerateScheduleButton.tsx`:

- Props `{ competitionId, hasSchedule, leagueFormat }`.
- `useState` für `open`, `ConfirmDialog` mit `scheduleDialogText(...)`, bei `hasSchedule`
  `destructive`.
- Trigger: `ghost`-Button wie heute. Label „Spielplan generieren“ / „Spielplan neu generieren“,
  Pending-Text „Generiere…“ (Unicode-Ellipsis). Icon `CalendarPlus` / `RefreshCw`. `aria-label`
  wie das Label.
- Nach Erfolg `toast.success("Spielplan generiert.")` bzw. `"Spielplan neu generiert."`. Der
  Fehlerfall bleibt (`getErrorMessage` aus `@vereinsheim/lib/forms/fieldErrors` statt
  Eigenbau-Fallback).

`schedule/page.tsx`:

- Der Button erscheint bei `canManage && competition.status === "ACTIVE" && (!hasSchedule ||
  regenerationBlocker === null)`. Übergeben werden `hasSchedule` und `competition.leagueFormat`.
- Der Hinweis erscheint bei `canManage && ACTIVE && hasSchedule && regenerationBlocker` und
  zeigt `regenerationBlocker` (`text-sm text-muted-foreground`). Damit ist die falsche Zahl weg.

Test: `regeneration.test.ts` deckt die Texte ab (Task 1). Für die Sichtbarkeit gibt es keinen
eigenen Markup-Test. Sie hängt an einer Bedingung in einer Server-Komponente mit DB-Zugriff und
wird in der Validierung im Browser belegt.

Commit: `feat(ringwerk): offer schedule regeneration for leagues without results`.

### Task 5: Doku

`vault/apps/ringwerk/league-mode.md`, Abschnitt „Spielplan-Konstruktion“, letzter Punkt: den
Absatz „Bestehende Spielpläne bleiben unverändert …“ ersetzen. Neu generieren geht über „Spielplan
neu generieren“, solange es kein Ergebnis gibt (E1, mit der `SET NULL`-Begründung). Das
öffentliche PDF wird dabei invalidiert. `keywords:` um `Spielplan neu generieren, Regenerierung`
ergänzen, danach `node .claude/vault-lint.mjs`.

Commit: `docs(vault): describe schedule regeneration`.

## 5. Verification

1. `pnpm check` grün. Vor dem Start des Dev-Servers `.next` räumen, falls ein Gate-Lauf
   vorausging (Incident `next-dist-dir-shared-with-dev-server`).
2. Dev-DB = Prod-Kopie (5 Ligen ohne Ergebnis). Im Browser auf einer Liga:
   - Der Button „Spielplan neu generieren“ ist sichtbar.
   - Der Dialog zeigt den Text zum Neu-Generieren.
   - Nach „Neu generieren“: SQL-Auszählung A/B je Teilnehmer ausgeglichen, Anzahl Paarungen und
     Freilose korrekt (keine doppelten Freilose), Toast.
3. Sperre: In einer Liga per SQL eine Serie an eine offene Paarung hängen. Der Button verschwindet,
   der Hinweis zeigt „Ergebnisse erfasst“. Ein direkter Action-Aufruf ist durch den Test belegt.
   Danach die Test-Serie wieder löschen.
4. Öffentliches PDF der neu generierten Liga (mit Zugangscode): `revalidatePublicPdf` nutzt das
   `"max"`-Profil (stale-while-revalidate). Der **erste** Abruf nach dem Neu-Generieren darf also
   noch den alten Plan liefern, der **zweite** muss den neuen zeigen. Belegt über den extrahierten
   Text: Die Paarungsreihenfolge weicht vom Abruf vor dem Neu-Generieren ab.
