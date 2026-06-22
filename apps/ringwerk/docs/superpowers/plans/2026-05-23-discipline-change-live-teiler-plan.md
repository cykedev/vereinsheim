# Disziplin-Änderung & Live-Teiler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Ermöglicht das nachträgliche Ändern der Disziplin eines eingeschriebenen Teilnehmers, solange noch keine Serien erfasst wurden; (2) zeigt den korrigierten Teiler (Teiler × Faktor) live während der Ergebniserfassung in allen drei Dialogen an.

**Architecture:** Feature 1 erweitert den CP-Query um `seriesCount`, fügt eine neue Server Action `updateParticipantDiscipline` hinzu und ergänzt `CompetitionParticipantActions` um einen Disziplin-Edit-Button mit Dialog. Feature 2 ergänzt die drei Erfassungsdialoge (EventSeriesDialog, SeasonSeriesDialog, ResultEntryDialog) um eine live berechnete Anzeige des korrigierten Teilers — rein clientseitig, kein Schema-Change.

**Tech Stack:** Next.js App Router, Server Actions, Prisma, React `useTransition`, shadcn/ui (Dialog, Select), Vitest

---

## Required Docs

- `.claude/docs/code-conventions.md` — immer
- `.claude/docs/reference-files.md` — immer
- `.claude/docs/data-model.md` — immer
- `.claude/docs/architecture.md` — immer
- `.claude/docs/features.md` — immer
- `.claude/docs/ui-patterns.md` — alle tsx-Änderungen

---

## File Map

| Datei                                                                          | Änderung                                                         |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `src/lib/competitionParticipants/types.ts`                                     | `seriesCount: number` zu `CompetitionParticipantListItem`        |
| `src/lib/competitionParticipants/queries.ts`                                   | `_count: { select: { series: true } }` hinzufügen, mappen        |
| `src/lib/competitionParticipants/actions.ts`                                   | Neue Action `updateParticipantDiscipline`                        |
| `src/lib/competitionParticipants/actions.test.ts`                              | `disciplineFindUniqueMock`, neue `describe`-Gruppe               |
| `src/components/app/competitionParticipants/CompetitionParticipantActions.tsx` | `disciplines` prop, Disziplin-Edit-Button + Dialog               |
| `src/app/(app)/competitions/[id]/participants/page.tsx`                        | `disciplines` an `CompetitionParticipantActions` übergeben       |
| `src/lib/matchups/types.ts`                                                    | `teilerFaktor: number \| null` zu `MatchupParticipant`           |
| `src/lib/matchups/queries.ts`                                                  | `teilerFaktor` aus `discipline` selektieren und mappen           |
| `src/components/app/results/ResultEntryDialog.tsx`                             | `homeTeilerFaktor`, `awayTeilerFaktor` props + Hints             |
| `src/components/app/matchups/ScheduleView.tsx`                                 | `competitionTeilerFaktor` prop, Faktoren an Dialog weiterreichen |
| `src/app/(app)/competitions/[id]/schedule/page.tsx`                            | `competitionTeilerFaktor` übergeben                              |
| `src/components/app/series/EventSeriesDialog.tsx`                              | `teilerFaktor` prop + Live-Hint                                  |
| `src/app/(app)/competitions/[id]/series/page.tsx`                              | `teilerFaktor` an `EventSeriesDialog` übergeben                  |
| `src/components/app/series/SeasonSeriesDialog.tsx`                             | `teilerFaktor` in `disciplines`-Typ + Live-Hint                  |
| `src/components/app/series/SeasonParticipantItem.tsx`                          | `teilerFaktor` in `disciplines`-Typ                              |

---

## Task 1: seriesCount — Types und Query erweitern

**Files:**

- Modify: `src/lib/competitionParticipants/types.ts`
- Modify: `src/lib/competitionParticipants/queries.ts`

- [ ] **Schritt 1: Typ erweitern**

In `src/lib/competitionParticipants/types.ts` das Feld `seriesCount: number` ergänzen:

```typescript
import type { ParticipantStatus, ScoringType } from "@/generated/prisma/client"

export type CompetitionParticipantListItem = {
  id: string
  competitionId: string
  status: ParticipantStatus
  startNumber: number | null
  withdrawnAt: Date | null
  isGuest: boolean
  disciplineId: string | null
  discipline: {
    id: string
    name: string
    scoringType: ScoringType
    teilerFaktor: number
  } | null
  participant: {
    id: string
    firstName: string
    lastName: string
    contact: string | null
  }
  teamNumber: number | null
  seriesCount: number
}
```

- [ ] **Schritt 2: Query erweitern**

In `src/lib/competitionParticipants/queries.ts` den `select`-Block um `_count` erweitern und im Map `seriesCount` setzen. Die Datei komplett ersetzen:

```typescript
import { db } from "@/lib/db"
import type { CompetitionParticipantListItem } from "@/lib/competitionParticipants/types"

/** Alle Einschreibungen eines Wettbewerbs — ACTIVE zuerst, dann WITHDRAWN. */
export async function getCompetitionParticipants(
  competitionId: string
): Promise<CompetitionParticipantListItem[]> {
  const rows = await db.competitionParticipant.findMany({
    where: { competitionId },
    select: {
      id: true,
      competitionId: true,
      status: true,
      startNumber: true,
      withdrawnAt: true,
      isGuest: true,
      disciplineId: true,
      discipline: {
        select: { id: true, name: true, scoringType: true, teilerFaktor: true },
      },
      participant: {
        select: { id: true, firstName: true, lastName: true, contact: true },
      },
      eventTeam: { select: { teamNumber: true } },
      _count: { select: { series: true } },
    },
    orderBy: [
      { status: "asc" },
      { eventTeam: { teamNumber: "asc" } },
      { participant: { lastName: "asc" } },
    ],
  })
  return rows.map((r) => ({
    ...r,
    discipline: r.discipline
      ? { ...r.discipline, teilerFaktor: r.discipline.teilerFaktor.toNumber() }
      : null,
    teamNumber: r.eventTeam?.teamNumber ?? null,
    seriesCount: r._count.series,
  })) as unknown as CompetitionParticipantListItem[]
}
```

- [ ] **Schritt 3: TypeScript prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: keine Fehler (oder nur bereits bestehende, unbeteiligte Fehler).

- [ ] **Schritt 4: Commit**

```
feat: add seriesCount to CompetitionParticipantListItem
```

---

## Task 2: Action `updateParticipantDiscipline` + Tests

**Files:**

- Modify: `src/lib/competitionParticipants/actions.ts`
- Modify: `src/lib/competitionParticipants/actions.test.ts`

- [ ] **Schritt 1: Failing Tests schreiben**

Am **Anfang** der `actions.test.ts`-Datei in den `vi.hoisted`-Block `disciplineFindUniqueMock` ergänzen:

```typescript
const {
  getAuthSessionMock,
  revalidatePathMock,
  competitionFindUniqueMock,
  competitionParticipantFindUniqueMock,
  competitionParticipantCreateMock,
  competitionParticipantDeleteMock,
  competitionParticipantUpdateMock,
  matchupCountMock,
  playoffMatchCountMock,
  participantCreateMock,
  participantDeleteMock,
  seriesDeleteManyMock,
  transactionMock,
  auditLogCreateMock,
  disciplineFindUniqueMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  competitionFindUniqueMock: vi.fn(),
  competitionParticipantFindUniqueMock: vi.fn(),
  competitionParticipantCreateMock: vi.fn(),
  competitionParticipantDeleteMock: vi.fn(),
  competitionParticipantUpdateMock: vi.fn(),
  matchupCountMock: vi.fn(),
  playoffMatchCountMock: vi.fn(),
  participantCreateMock: vi.fn(),
  participantDeleteMock: vi.fn(),
  seriesDeleteManyMock: vi.fn(),
  transactionMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  disciplineFindUniqueMock: vi.fn(),
}))
```

Im `vi.mock("@/lib/db", ...)` Block `discipline` ergänzen:

```typescript
vi.mock("@/lib/db", () => ({
  db: {
    competition: { findUnique: competitionFindUniqueMock },
    competitionParticipant: {
      findUnique: competitionParticipantFindUniqueMock,
      findFirst: competitionParticipantFindUniqueMock,
      create: competitionParticipantCreateMock,
      delete: competitionParticipantDeleteMock,
      update: competitionParticipantUpdateMock,
    },
    discipline: { findUnique: disciplineFindUniqueMock },
    matchup: { count: matchupCountMock },
    playoffMatch: { count: playoffMatchCountMock },
    participant: {
      create: participantCreateMock,
      delete: participantDeleteMock,
    },
    series: { deleteMany: seriesDeleteManyMock },
    auditLog: { create: auditLogCreateMock },
    $transaction: transactionMock,
  },
}))
```

Den Import-Block um `updateParticipantDiscipline` erweitern:

```typescript
import {
  enrollParticipant,
  unenrollParticipant,
  withdrawParticipant,
  revokeWithdrawal,
  updateStartNumber,
  updateParticipantDiscipline,
} from "@/lib/competitionParticipants/actions"
```

Neue `describe`-Gruppe am Ende der Datei einfügen:

```typescript
// ─── updateParticipantDiscipline ─────────────────────────────────────────────

describe("updateParticipantDiscipline", () => {
  const activeCp = {
    id: "cp1",
    competitionId: "c1",
    status: "ACTIVE",
    _count: { series: 0 },
  }
  const activeDiscipline = { id: "d2", isArchived: false }

  beforeEach(() => {
    vi.resetAllMocks()
    competitionParticipantFindUniqueMock.mockResolvedValue(activeCp)
    disciplineFindUniqueMock.mockResolvedValue(activeDiscipline)
    competitionParticipantUpdateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin/Manager", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn CP nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue(null)
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({ error: "Einschreibung nicht gefunden." })
  })

  it("liefert Fehler wenn Status WITHDRAWN", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue({
      ...activeCp,
      status: "WITHDRAWN",
    })
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({
      error: "Disziplin kann nur bei aktiven Teilnehmern geändert werden.",
    })
  })

  it("liefert Fehler wenn Serien vorhanden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue({
      ...activeCp,
      _count: { series: 1 },
    })
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({
      error: "Disziplin kann nicht mehr geändert werden — es gibt bereits erfasste Serien.",
    })
  })

  it("liefert Fehler wenn Disziplin nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    disciplineFindUniqueMock.mockResolvedValue(null)
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({ error: "Disziplin nicht gefunden oder nicht verfügbar." })
  })

  it("liefert Fehler wenn Disziplin archiviert", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    disciplineFindUniqueMock.mockResolvedValue({ id: "d2", isArchived: true })
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({ error: "Disziplin nicht gefunden oder nicht verfügbar." })
  })

  it("aktualisiert Disziplin erfolgreich", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({ success: true })
    expect(competitionParticipantUpdateMock).toHaveBeenCalledWith({
      where: { id: "cp1" },
      data: { disciplineId: "d2" },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith("/competitions/c1/participants")
    expect(revalidatePathMock).toHaveBeenCalledWith("/competitions")
  })

  it("erlaubt MANAGER die Änderung", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    const result = await updateParticipantDiscipline("cp1", "d2")
    expect(result).toEqual({ success: true })
  })
})
```

- [ ] **Schritt 2: Tests fehlschlagen lassen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm run test -- --reporter=verbose 2>&1 | grep -A 3 "updateParticipantDiscipline"
```

Erwartet: Tests schlagen fehl wegen "not a function" / Import-Fehler.

- [ ] **Schritt 3: Action implementieren**

Am Ende von `src/lib/competitionParticipants/actions.ts` einfügen:

```typescript
// ─────────────────────────────────────────────────────────────
// UPDATE PARTICIPANT DISCIPLINE
// ─────────────────────────────────────────────────────────────

export async function updateParticipantDiscipline(
  competitionParticipantId: string,
  disciplineId: string
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const cp = await db.competitionParticipant.findUnique({
    where: { id: competitionParticipantId },
    select: {
      id: true,
      competitionId: true,
      status: true,
      _count: { select: { series: true } },
    },
  })
  if (!cp) return { error: "Einschreibung nicht gefunden." }
  if (cp.status !== "ACTIVE") {
    return { error: "Disziplin kann nur bei aktiven Teilnehmern geändert werden." }
  }
  if (cp._count.series > 0) {
    return {
      error: "Disziplin kann nicht mehr geändert werden — es gibt bereits erfasste Serien.",
    }
  }

  const discipline = await db.discipline.findUnique({
    where: { id: disciplineId },
    select: { id: true, isArchived: true },
  })
  if (!discipline || discipline.isArchived) {
    return { error: "Disziplin nicht gefunden oder nicht verfügbar." }
  }

  await db.competitionParticipant.update({
    where: { id: competitionParticipantId },
    data: { disciplineId },
  })

  revalidatePath(`/competitions/${cp.competitionId}/participants`)
  revalidatePath("/competitions")
  return { success: true }
}
```

- [ ] **Schritt 4: Tests grün laufen lassen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm run test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|updateParticipantDiscipline)"
```

Erwartet: alle `updateParticipantDiscipline`-Tests grün.

- [ ] **Schritt 5: Commit**

```
feat: add updateParticipantDiscipline action with tests
```

---

## Task 3: UI — Disziplin-Edit in CompetitionParticipantActions und participants page

**Files:**

- Modify: `src/components/app/competitionParticipants/CompetitionParticipantActions.tsx`
- Modify: `src/app/(app)/competitions/[id]/participants/page.tsx`

- [ ] **Schritt 1: CompetitionParticipantActions erweitern**

Die Datei `src/components/app/competitionParticipants/CompetitionParticipantActions.tsx` komplett ersetzen:

```typescript
"use client"

import { useState, useTransition } from "react"
import { UserMinus, UserCheck, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  withdrawParticipant,
  revokeWithdrawal,
  unenrollParticipant,
  updateParticipantDiscipline,
} from "@/lib/competitionParticipants/actions"
import type { CompetitionParticipantListItem } from "@/lib/competitionParticipants/types"
import type { SerializableDiscipline } from "@/lib/disciplines/types"

interface Props {
  entry: CompetitionParticipantListItem
  playoffsStarted: boolean
  /** Übergeben bei gemischten Wettbewerben — ermöglicht Disziplin-Edit */
  disciplines?: SerializableDiscipline[]
}

export function CompetitionParticipantActions({ entry, playoffsStarted, disciplines }: Props) {
  const [isPending, startTransition] = useTransition()
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [disciplineOpen, setDisciplineOpen] = useState(false)
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>(
    entry.disciplineId ?? ""
  )

  const fullName = entry.isGuest
    ? entry.participant.firstName
    : `${entry.participant.lastName}, ${entry.participant.firstName}`

  // Disziplin-Edit möglich wenn: gemischter WB, aktiv, keine Serien, kein Gast
  const canEditDiscipline =
    disciplines &&
    disciplines.length > 0 &&
    !entry.isGuest &&
    entry.status === "ACTIVE" &&
    entry.seriesCount === 0

  if (playoffsStarted) return null

  function handleWithdraw() {
    startTransition(async () => {
      const fd = new FormData()
      fd.append("reason", reason)
      const result = await withdrawParticipant(entry.id, null, fd)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Rückzug.")
      } else {
        setWithdrawOpen(false)
        setReason("")
      }
    })
  }

  function handleRevokeWithdrawal() {
    startTransition(async () => {
      const result = await revokeWithdrawal(entry.id)
      if ("error" in result) {
        toast.error(
          typeof result.error === "string" ? result.error : "Fehler beim Rückgängigmachen."
        )
      }
    })
  }

  function handleUnenroll() {
    startTransition(async () => {
      const result = await unenrollParticipant(entry.id)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Entfernen.")
      }
    })
  }

  function handleDisciplineSave() {
    if (!selectedDisciplineId) return
    startTransition(async () => {
      const result = await updateParticipantDiscipline(entry.id, selectedDisciplineId)
      if ("error" in result) {
        toast.error(
          typeof result.error === "string" ? result.error : "Fehler beim Ändern der Disziplin."
        )
      } else {
        setDisciplineOpen(false)
      }
    })
  }

  return (
    <div className="flex items-center gap-1">
      {/* Disziplin ändern */}
      {canEditDiscipline && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            title="Disziplin ändern"
            onClick={() => {
              setSelectedDisciplineId(entry.disciplineId ?? "")
              setDisciplineOpen(true)
            }}
            disabled={isPending}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Dialog open={disciplineOpen} onOpenChange={setDisciplineOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Disziplin ändern</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{fullName}</p>
              <div className="space-y-1.5">
                <Label htmlFor="discipline-select">Disziplin</Label>
                <Select
                  value={selectedDisciplineId}
                  onValueChange={setSelectedDisciplineId}
                  disabled={isPending}
                >
                  <SelectTrigger id="discipline-select">
                    <SelectValue placeholder="Disziplin wählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {disciplines!.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDisciplineOpen(false)}
                  disabled={isPending}
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={handleDisciplineSave}
                  disabled={isPending || !selectedDisciplineId}
                >
                  {isPending ? "Speichern…" : "Speichern"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Zurückziehen */}
      {entry.status === "ACTIVE" && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            title="Zurückziehen"
            onClick={() => setWithdrawOpen(true)}
            disabled={isPending}
          >
            <UserMinus className="h-4 w-4" />
          </Button>
          <Dialog
            open={withdrawOpen}
            onOpenChange={(open) => {
              setWithdrawOpen(open)
              if (!open) setReason("")
            }}
          >
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Teilnehmer zurückziehen?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                {fullName} wird zurückgezogen. Alle Ergebnisse werden aus der Wertung genommen.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="withdraw-reason">
                  Begründung <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="withdraw-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="z.B. verletzt"
                  disabled={isPending}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setWithdrawOpen(false)}
                  disabled={isPending}
                >
                  Abbrechen
                </Button>
                <Button variant="destructive" onClick={handleWithdraw} disabled={isPending}>
                  {isPending ? "Zurückziehen…" : "Zurückziehen"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Rückzug rückgängig */}
      {entry.status === "WITHDRAWN" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              title="Rückzug rückgängig"
              disabled={isPending}
            >
              <UserCheck className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rückzug rückgängig machen?</AlertDialogTitle>
              <AlertDialogDescription>
                {fullName} wird wieder als aktiv eingeschrieben.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={handleRevokeWithdrawal}>
                Rückgängig machen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Aus Wettbewerb entfernen */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-destructive/70 hover:text-destructive"
            title="Aus Wettbewerb entfernen"
            disabled={isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aus Wettbewerb entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              {fullName} wird dauerhaft aus diesem Wettbewerb entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnenroll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Schritt 2: participants/page.tsx — `disciplines` an Actions übergeben**

In `src/app/(app)/competitions/[id]/participants/page.tsx` beide Stellen finden wo `<CompetitionParticipantActions` gerendert wird (für aktive und zurückgezogene Teilnehmer) und `disciplines={enrollDisciplines}` ergänzen:

```typescript
// Aktive Teilnehmer:
<CompetitionParticipantActions
  entry={cp}
  playoffsStarted={playoffsStarted}
  disciplines={enrollDisciplines}
/>

// Zurückgezogene Teilnehmer (keine Disziplin-Edit möglich wegen WITHDRAWN-Guard):
<CompetitionParticipantActions
  entry={cp}
  playoffsStarted={playoffsStarted}
  disciplines={enrollDisciplines}
/>
```

`enrollDisciplines` ist bereits auf der Seite definiert als `isMixed ? allDisciplines : undefined`.

- [ ] **Schritt 3: TypeScript + Lint prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit && docker compose -f docker-compose.dev.yml run --rm app npm run lint
```

Erwartet: keine Fehler.

- [ ] **Schritt 4: Commit**

```
feat: add discipline edit to CompetitionParticipantActions for mixed competitions
```

---

## Task 4: EventSeriesDialog — Live-Teiler

**Files:**

- Modify: `src/components/app/series/EventSeriesDialog.tsx`
- Modify: `src/app/(app)/competitions/[id]/series/page.tsx`

- [ ] **Schritt 1: EventSeriesDialog — `teilerFaktor` prop + Live-Hint**

In `src/components/app/series/EventSeriesDialog.tsx` die Props-Definition erweitern und den Hint nach dem Teiler-Input einfügen.

Props-Interface erweitern:

```typescript
interface Props {
  competitionId: string
  competitionParticipantId: string
  participantName: string
  scoringType: ScoringType
  shotsPerSeries: number
  /** Teiler-Korrekturfaktor der Disziplin — für Live-Anzeige des korrigierten Teilers */
  teilerFaktor?: number
  /** Vorhandene Serie — wenn gesetzt, Korrektur-Modus */
  existingSeries?: { rings: number; teiler: number }
}
```

Komponent-Signatur anpassen (nach `shotsPerSeries` den neuen Parameter ergänzen):

```typescript
export function EventSeriesDialog({
  competitionId,
  competitionParticipantId,
  participantName,
  scoringType,
  shotsPerSeries,
  teilerFaktor = 1,
  existingSeries,
}: Props) {
```

Direkt **vor** dem `return`-Statement die Berechnung ergänzen:

```typescript
const teilerNum = parseFloat(teiler.replace(",", "."))
const correctedTeiler = isNaN(teilerNum) || teilerFaktor === 1 ? null : teilerNum * teilerFaktor
```

Im JSX direkt **nach** dem `fieldErrors?.teiler`-Block (und vor dem `generalError`-Block) den Hint ergänzen:

```tsx
{
  fieldErrors?.teiler && <p className="text-sm text-destructive">{fieldErrors.teiler[0]}</p>
}
{
  correctedTeiler !== null && (
    <p className="text-xs text-muted-foreground">Korr. Teiler: {correctedTeiler.toFixed(2)}</p>
  )
}
```

- [ ] **Schritt 2: series/page.tsx — `teilerFaktor` übergeben**

In `src/app/(app)/competitions/[id]/series/page.tsx` (Event-Pfad) den `EventSeriesDialog`-Aufruf um `teilerFaktor` ergänzen:

```tsx
<EventSeriesDialog
  competitionId={id}
  competitionParticipantId={cp.id}
  participantName={
    cp.isGuest ? cp.participant.firstName : `${cp.participant.firstName} ${cp.participant.lastName}`
  }
  scoringType={getEffectiveScoringType(
    competition.scoringMode,
    cp.discipline ?? competition.discipline,
    competition.targetValueType
  )}
  shotsPerSeries={competition.shotsPerSeries}
  teilerFaktor={(cp.discipline ?? competition.discipline)?.teilerFaktor ?? 1}
  existingSeries={series}
/>
```

- [ ] **Schritt 3: TypeScript prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: keine neuen Fehler.

- [ ] **Schritt 4: Commit**

```
feat: show live corrected teiler in EventSeriesDialog
```

---

## Task 5: SeasonSeriesDialog — Live-Teiler

**Files:**

- Modify: `src/components/app/series/SeasonSeriesDialog.tsx`
- Modify: `src/components/app/series/SeasonParticipantItem.tsx`

- [ ] **Schritt 1: SeasonSeriesDialog — `teilerFaktor` in Disziplin-Typ + Live-Hint**

In `src/components/app/series/SeasonSeriesDialog.tsx` den `disciplines`-Typ erweitern und die Berechnung + den Hint ergänzen.

Props-Interface — `disciplines`-Typ anpassen:

```typescript
interface Props {
  competitionId: string
  participantId: string
  participantName: string
  scoringMode: ScoringMode
  shotsPerSeries: number
  /** Disziplinen für gemischte Saisons */
  disciplines?: { id: string; name: string; scoringType: ScoringType; teilerFaktor: number }[]
  defaultDisciplineId?: string | null
  /** Wenn gesetzt: Edit-Modus für diese bestehende Serie */
  existingSeries?: ExistingSeries
}
```

Direkt **nach** der bestehenden `effectiveScoringType`-Berechnung die teilerFaktor-Ableitung ergänzen:

```typescript
// teilerFaktor aus der gewählten Disziplin (für Live-Anzeige des korrigierten Teilers)
const teilerFaktor = selectedDiscipline?.teilerFaktor ?? 1
const teilerNum = parseFloat(teiler.replace(",", "."))
const correctedTeiler = isNaN(teilerNum) || teilerFaktor === 1 ? null : teilerNum * teilerFaktor
```

Im JSX direkt **nach** dem `fieldErrors?.teiler`-Block den Hint einfügen:

```tsx
{
  fieldErrors?.teiler && <p className="text-sm text-destructive">{fieldErrors.teiler[0]}</p>
}
{
  correctedTeiler !== null && (
    <p className="text-xs text-muted-foreground">Korr. Teiler: {correctedTeiler.toFixed(2)}</p>
  )
}
```

- [ ] **Schritt 2: SeasonParticipantItem — `disciplines`-Typ anpassen**

In `src/components/app/series/SeasonParticipantItem.tsx` die Prop-Definition für `disciplines` erweitern:

```typescript
  disciplines?: { id: string; name: string; scoringType: ScoringType; teilerFaktor: number }[]
```

- [ ] **Schritt 3: TypeScript prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: keine neuen Fehler. (Die `series/page.tsx` übergibt `allDisciplines` vom Typ `SerializableDiscipline[]`, der `teilerFaktor: number` bereits enthält — kein Page-Change nötig.)

- [ ] **Schritt 4: Commit**

```
feat: show live corrected teiler in SeasonSeriesDialog
```

---

## Task 6: Liga — Live-Teiler in ResultEntryDialog

**Files:**

- Modify: `src/lib/matchups/types.ts`
- Modify: `src/lib/matchups/queries.ts`
- Modify: `src/components/app/results/ResultEntryDialog.tsx`
- Modify: `src/components/app/matchups/ScheduleView.tsx`
- Modify: `src/app/(app)/competitions/[id]/schedule/page.tsx`

- [ ] **Schritt 1: MatchupParticipant — `teilerFaktor` ergänzen**

In `src/lib/matchups/types.ts`:

```typescript
import { MatchStatus, Round, ScoringType } from "@/generated/prisma/client"

export type { MatchStatus, Round, ScoringType }

export interface MatchupParticipant {
  id: string
  firstName: string
  lastName: string
  withdrawn: boolean
  /** Disziplin-ScoringType des Teilnehmers in diesem Wettbewerb (null = nicht konfiguriert) */
  scoringType: ScoringType | null
  /** Teiler-Korrekturfaktor der Teilnehmer-Disziplin (null = keine per-CP-Disziplin) */
  teilerFaktor: number | null
}

export interface MatchResultSummary {
  participantId: string
  rings: number
  teiler: number
  ringteiler: number
}

export interface MatchupListItem {
  id: string
  round: Round
  roundIndex: number
  status: MatchStatus
  dueDate: Date | null
  homeParticipant: MatchupParticipant
  awayParticipant: MatchupParticipant | null // null = BYE
  results: MatchResultSummary[]
}

export interface ScheduleStatus {
  hasSchedule: boolean
  hasCompletedMatchups: boolean
  totalMatchups: number
}
```

- [ ] **Schritt 2: Matchup-Query — `teilerFaktor` selektieren und mappen**

In `src/lib/matchups/queries.ts` den `participantSelect` und `mapParticipant` anpassen:

```typescript
import { db } from "@/lib/db"
import type { MatchupListItem, MatchupParticipant, ScheduleStatus } from "./types"

// Rohtyp aus Prisma-Select (inkl. verschachteltem LP-Status und Disziplin)
type RawParticipant = {
  id: string
  firstName: string
  lastName: string
  competitions: Array<{
    status: string
    discipline: {
      scoringType: string
      teilerFaktor: { toNumber: () => number }
    } | null
  }>
}

function mapParticipant(p: RawParticipant): MatchupParticipant {
  const cp = p.competitions[0]
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    withdrawn: cp?.status === "WITHDRAWN",
    scoringType: (cp?.discipline?.scoringType as MatchupParticipant["scoringType"]) ?? null,
    teilerFaktor: cp?.discipline?.teilerFaktor?.toNumber() ?? null,
  }
}

function participantSelect(competitionId: string) {
  return {
    id: true,
    firstName: true,
    lastName: true,
    competitions: {
      where: { competitionId },
      select: {
        status: true,
        discipline: { select: { scoringType: true, teilerFaktor: true } },
      },
    },
  } as const
}

export async function getMatchupsForCompetition(competitionId: string): Promise<MatchupListItem[]> {
  const rows = await db.matchup.findMany({
    where: { competitionId },
    select: {
      id: true,
      round: true,
      roundIndex: true,
      status: true,
      dueDate: true,
      homeParticipant: { select: participantSelect(competitionId) },
      awayParticipant: { select: participantSelect(competitionId) },
      series: {
        select: {
          participantId: true,
          rings: true,
          teiler: true,
          ringteiler: true,
        },
      },
    },
    orderBy: [{ round: "asc" }, { roundIndex: "asc" }, { homeParticipant: { lastName: "asc" } }],
  })

  return rows.map((row) => ({
    id: row.id,
    round: row.round,
    roundIndex: row.roundIndex,
    status: row.status,
    dueDate: row.dueDate,
    homeParticipant: mapParticipant(row.homeParticipant),
    awayParticipant: row.awayParticipant ? mapParticipant(row.awayParticipant) : null,
    // Decimal-Felder in number umwandeln (Prisma 7)
    results: row.series.map((r) => ({
      participantId: r.participantId,
      rings: r.rings.toNumber(),
      teiler: r.teiler.toNumber(),
      ringteiler: r.ringteiler.toNumber(),
    })),
  }))
}

export async function getScheduleStatus(competitionId: string): Promise<ScheduleStatus> {
  const [total, completed] = await Promise.all([
    db.matchup.count({ where: { competitionId } }),
    db.matchup.count({ where: { competitionId, status: "COMPLETED" } }),
  ])

  return {
    hasSchedule: total > 0,
    hasCompletedMatchups: completed > 0,
    totalMatchups: total,
  }
}
```

- [ ] **Schritt 3: ResultEntryDialog — `homeTeilerFaktor` + `awayTeilerFaktor` + Hints**

In `src/components/app/results/ResultEntryDialog.tsx` Props ergänzen und Hints hinzufügen.

Props-Interface erweitern:

```typescript
interface Props {
  matchupId: string
  homeName: string
  awayName: string
  homeParticipantId: string
  awayParticipantId: string
  /** Existierende Ergebnisse für Vorausfüllung bei Korrektur */
  existingResults: MatchResultSummary[]
  isCorrection: boolean
  /** ScoringType je Teilnehmer (kann bei gemischten Wettbewerben unterschiedlich sein) */
  homeScoringType: ScoringType
  awayScoringType: ScoringType
  shotsPerSeries: number
  /** Teiler-Korrekturfaktor je Teilnehmer — für Live-Anzeige des korrigierten Teilers */
  homeTeilerFaktor: number
  awayTeilerFaktor: number
}
```

Komponent-Signatur (Props destrukturieren):

```typescript
export function ResultEntryDialog({
  matchupId,
  homeName,
  awayName,
  homeParticipantId,
  awayParticipantId,
  existingResults,
  isCorrection,
  homeScoringType,
  awayScoringType,
  shotsPerSeries,
  homeTeilerFaktor,
  awayTeilerFaktor,
}: Props) {
```

Direkt **vor** dem `return`-Statement die Berechnungen ergänzen:

```typescript
const homeTeilerNum = parseFloat(home.teiler.replace(",", "."))
const homeCorrectedTeiler =
  isNaN(homeTeilerNum) || homeTeilerFaktor === 1 ? null : homeTeilerNum * homeTeilerFaktor

const awayTeilerNum = parseFloat(away.teiler.replace(",", "."))
const awayCorrectedTeiler =
  isNaN(awayTeilerNum) || awayTeilerFaktor === 1 ? null : awayTeilerNum * awayTeilerFaktor
```

Im Heim-Block direkt **nach** dem Teiler-Input den Hint einfügen:

```tsx
<div className="space-y-1">
  <Label htmlFor="home-teiler" className="text-xs text-muted-foreground">
    Bester Teiler
  </Label>
  <Input
    id="home-teiler"
    type="text"
    inputMode="decimal"
    value={home.teiler}
    onChange={(e) => setHome((p) => ({ ...p, teiler: e.target.value }))}
    placeholder="z.B. 3,7"
  />
  {homeCorrectedTeiler !== null && (
    <p className="text-xs text-muted-foreground">Korr. Teiler: {homeCorrectedTeiler.toFixed(2)}</p>
  )}
</div>
```

Im Gast-Block direkt **nach** dem Teiler-Input den Hint einfügen:

```tsx
<div className="space-y-1">
  <Label htmlFor="away-teiler" className="text-xs text-muted-foreground">
    Bester Teiler
  </Label>
  <Input
    id="away-teiler"
    type="text"
    inputMode="decimal"
    value={away.teiler}
    onChange={(e) => setAway((p) => ({ ...p, teiler: e.target.value }))}
    placeholder="z.B. 5,0"
  />
  {awayCorrectedTeiler !== null && (
    <p className="text-xs text-muted-foreground">Korr. Teiler: {awayCorrectedTeiler.toFixed(2)}</p>
  )}
</div>
```

- [ ] **Schritt 4: ScheduleView — `competitionTeilerFaktor` prop + Faktoren weiterreichen**

In `src/components/app/matchups/ScheduleView.tsx` die Props der `LegTable`-Funktion und die `ScheduleView`-Props erweitern und die Faktoren berechnen.

`LegTable`-Props erweitern:

```typescript
function LegTable({
  title,
  matchups,
  deadline,
  canManage,
  scoringMode,
  shotsPerSeries,
  competitionTeilerFaktor = 1,
}: {
  title: string
  matchups: MatchupListItem[]
  deadline: Date | null
  canManage: boolean
  scoringMode: ScoringMode
  shotsPerSeries: number
  competitionTeilerFaktor?: number
}) {
```

Im Matchup-Map direkt nach der `awayScoringType`-Berechnung ergänzen:

```typescript
const homeTeilerFaktor = m.homeParticipant.teilerFaktor ?? competitionTeilerFaktor
const awayTeilerFaktor = m.awayParticipant?.teilerFaktor ?? competitionTeilerFaktor
```

Den `ResultEntryDialog`-Aufruf um die neuen Props erweitern:

```tsx
<ResultEntryDialog
  matchupId={m.id}
  homeName={participantName(m.homeParticipant)}
  awayName={participantName(m.awayParticipant)}
  homeParticipantId={m.homeParticipant.id}
  awayParticipantId={m.awayParticipant.id}
  existingResults={m.results}
  isCorrection={isCompleted}
  homeScoringType={homeScoringType}
  awayScoringType={awayScoringType}
  shotsPerSeries={shotsPerSeries}
  homeTeilerFaktor={homeTeilerFaktor}
  awayTeilerFaktor={awayTeilerFaktor}
/>
```

Die `Props`-Interface von `ScheduleView` erweitern:

```typescript
interface Props {
  matchups: MatchupListItem[]
  hinrundeDeadline: Date | null
  rueckrundeDeadline: Date | null
  competitionId: string
  canManage: boolean
  playoffsStarted?: boolean
  scoringMode?: ScoringMode
  /** @deprecated Per-Teilnehmer-Typen werden aus MatchupParticipant.scoringType berechnet */
  scoringType?: ScoringType
  shotsPerSeries: number
  /** Teiler-Faktor der Wettbewerbs-Disziplin (Fallback für Teilnehmer ohne per-CP-Disziplin) */
  competitionTeilerFaktor?: number
}
```

Den `competitionTeilerFaktor` prop in der `ScheduleView`-Funktion destrukturieren und an `LegTable` weitergeben:

```typescript
export function ScheduleView({
  matchups,
  hinrundeDeadline,
  rueckrundeDeadline,
  competitionId: _competitionId,
  canManage,
  playoffsStarted,
  scoringMode = "RINGTEILER",
  shotsPerSeries,
  competitionTeilerFaktor = 1,
}: Props) {
```

Die beiden `LegTable`-Aufrufe im JSX um `competitionTeilerFaktor` ergänzen:

```tsx
<LegTable
  title="Hinrunde"
  matchups={hinrunde}
  deadline={hinrundeDeadline}
  canManage={canManage}
  scoringMode={scoringMode}
  shotsPerSeries={shotsPerSeries}
  competitionTeilerFaktor={competitionTeilerFaktor}
/>
<LegTable
  title="Rückrunde"
  matchups={rueckrunde}
  deadline={rueckrundeDeadline}
  canManage={canManage}
  scoringMode={scoringMode}
  shotsPerSeries={shotsPerSeries}
  competitionTeilerFaktor={competitionTeilerFaktor}
/>
```

- [ ] **Schritt 5: schedule/page.tsx — `competitionTeilerFaktor` übergeben**

In `src/app/(app)/competitions/[id]/schedule/page.tsx` dem `ScheduleView`-Aufruf das neue Prop hinzufügen:

```tsx
<ScheduleView
  matchups={matchups}
  hinrundeDeadline={competition.hinrundeDeadline}
  rueckrundeDeadline={competition.rueckrundeDeadline}
  competitionId={id}
  canManage={canManage}
  playoffsStarted={playoffsStarted}
  scoringMode={competition.scoringMode}
  scoringType={scoringType}
  shotsPerSeries={competition.shotsPerSeries}
  competitionTeilerFaktor={competition.discipline?.teilerFaktor ?? 1}
/>
```

- [ ] **Schritt 6: TypeScript + alle Tests prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: keine Fehler.

```bash
docker compose -f docker-compose.dev.yml run --rm app npm run test
```

Erwartet: alle Tests grün.

- [ ] **Schritt 7: Commit**

```
feat: show live corrected teiler in ResultEntryDialog (Liga)
```

---

## Task 7: Abschluss-Check

- [ ] **Schritt 1: Vollständigen Quality-Check ausführen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm run lint && \
docker compose -f docker-compose.dev.yml run --rm app npm run format:check && \
docker compose -f docker-compose.dev.yml run --rm app npm run test && \
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: alle Gates grün.

- [ ] **Schritt 2: Bei Format-Fehlern bereinigen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx prettier --write "src/**/*.{ts,tsx}"
```

Dann erneut committen falls Änderungen.
