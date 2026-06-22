# Delete Inactive Participants — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins and managers to delete inactive participants; admins can force-delete participants with historical data via a name-confirmation dialog.

**Architecture:** New `deleteParticipant(id, force)` server action in the existing participants module; adapted `ParticipantRowActions` component with three dialog variants (no data / has data+no admin / has data+admin); audit types extended with `PARTICIPANT_DELETED` and `PARTICIPANT_FORCE_DELETED`.

**Tech Stack:** Next.js 15 server actions, Prisma 7, React client components, shadcn AlertDialog + Input, Vitest.

---

## Required Docs

- `.claude/docs/code-conventions.md` — always
- `.claude/docs/reference-files.md` — always
- `.claude/docs/ui-patterns.md` — for UI task
- `.claude/docs/architecture.md` — layer order

---

## File Map

| File                                                        | Action | Responsibility                                                        |
| ----------------------------------------------------------- | ------ | --------------------------------------------------------------------- |
| `src/lib/auditLog/types.ts`                                 | Modify | Add two new event types, labels, categories, format/description cases |
| `src/lib/participants/actions.ts`                           | Modify | Add `deleteParticipant(id, force)` action                             |
| `src/lib/participants/actions.test.ts`                      | Create | Tests for `deleteParticipant`                                         |
| `src/components/app/participants/ParticipantRowActions.tsx` | Modify | Add Trash2 button + three dialog variants                             |
| `src/app/(app)/participants/page.tsx`                       | Modify | Pass `isAdmin` + `competitionsCount` props                            |

---

## Task 1: Extend audit event types

**Files:**

- Modify: `src/lib/auditLog/types.ts`

- [ ] **Step 1: Add event types to the union**

In `src/lib/auditLog/types.ts`, extend `AuditEventType` — add after `"PARTICIPANT_REACTIVATED"`:

```typescript
  | "PARTICIPANT_DELETED"
  | "PARTICIPANT_FORCE_DELETED"
```

- [ ] **Step 2: Add labels**

In `AUDIT_EVENT_LABELS`, add after `PARTICIPANT_REACTIVATED`:

```typescript
  PARTICIPANT_DELETED: "Teilnehmer gelöscht",
  PARTICIPANT_FORCE_DELETED: "Teilnehmer endgültig gelöscht",
```

- [ ] **Step 3: Add categories**

In `AUDIT_EVENT_CATEGORY`, add after `PARTICIPANT_REACTIVATED`:

```typescript
  PARTICIPANT_DELETED: "destructive",
  PARTICIPANT_FORCE_DELETED: "destructive",
```

- [ ] **Step 4: Add formatAuditDetails cases**

In the `switch (eventType)` block inside `formatAuditDetails`, add after the `PARTICIPANT_REACTIVATED` case group:

```typescript
    case "PARTICIPANT_DELETED":
      rows.push({ label: "Vorname", value: str(d.firstName) })
      rows.push({ label: "Nachname", value: str(d.lastName) })
      break

    case "PARTICIPANT_FORCE_DELETED":
      rows.push({ label: "Vorname", value: str(d.firstName) })
      rows.push({ label: "Nachname", value: str(d.lastName) })
      rows.push({ label: "Wettbewerbe", value: str(d.competitions) })
      break
```

- [ ] **Step 5: Add getAuditDescription cases**

In the `switch (eventType)` block inside `getAuditDescription`, add after the `PARTICIPANT_REACTIVATED` case group:

```typescript
    case "PARTICIPANT_DELETED":
    case "PARTICIPANT_FORCE_DELETED":
      return d.firstName && d.lastName ? `${s(d.firstName)} ${s(d.lastName)}` : null
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/auditLog/types.ts
git commit -m "feat: add PARTICIPANT_DELETED and PARTICIPANT_FORCE_DELETED audit event types"
```

---

## Task 2: Implement deleteParticipant action (TDD)

**Files:**

- Create: `src/lib/participants/actions.test.ts`
- Modify: `src/lib/participants/actions.ts`

### Key schema facts (checked against prisma/schema.prisma):

- `Matchup` FK fields: `homeParticipantId`, `awayParticipantId`
- `PlayoffMatch` FK fields: `participantAId`, `participantBId`
- `Series` FK fields: `participantId` (direct), `matchupId` (nullable)
- `CompetitionParticipant` FK field: `participantId`

- [ ] **Step 1: Create the test file**

Create `src/lib/participants/actions.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAuthSessionMock,
  revalidatePathMock,
  participantFindUniqueMock,
  participantDeleteMock,
  competitionParticipantCountMock,
  auditLogCreateMock,
  transactionMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  participantFindUniqueMock: vi.fn(),
  participantDeleteMock: vi.fn(),
  competitionParticipantCountMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  transactionMock: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: getAuthSessionMock,
  canManage: (role: string) => role === "ADMIN" || role === "MANAGER",
  isAdmin: (role: string) => role === "ADMIN",
}))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))
vi.mock("@/lib/db", () => ({
  db: {
    participant: {
      findUnique: participantFindUniqueMock,
      delete: participantDeleteMock,
    },
    competitionParticipant: {
      count: competitionParticipantCountMock,
    },
    auditLog: { create: auditLogCreateMock },
    $transaction: transactionMock,
  },
}))

import { deleteParticipant } from "@/lib/participants/actions"

const adminSession = { user: { id: "u1", role: "ADMIN" } }
const managerSession = { user: { id: "u3", role: "MANAGER" } }
const userSession = { user: { id: "u2", role: "USER" } }

const inactiveParticipant = {
  id: "p1",
  firstName: "Max",
  lastName: "Muster",
  isActive: false,
}

describe("deleteParticipant (force=false)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    participantFindUniqueMock.mockResolvedValue(inactiveParticipant)
    competitionParticipantCountMock.mockResolvedValue(0)
    participantDeleteMock.mockResolvedValue({})
    auditLogCreateMock.mockResolvedValue({})
  })

  it("returns error when not logged in", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await deleteParticipant("p1", false)
    expect(result).toEqual({ error: "Nicht angemeldet" })
    expect(participantDeleteMock).not.toHaveBeenCalled()
  })

  it("returns error for USER role", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await deleteParticipant("p1", false)
    expect(result).toEqual({ error: "Keine Berechtigung" })
    expect(participantDeleteMock).not.toHaveBeenCalled()
  })

  it("returns error when participant not found", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    participantFindUniqueMock.mockResolvedValue(null)
    const result = await deleteParticipant("p1", false)
    expect(result).toEqual({ error: "Teilnehmer nicht gefunden." })
    expect(participantDeleteMock).not.toHaveBeenCalled()
  })

  it("returns error when participant is active", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    participantFindUniqueMock.mockResolvedValue({ ...inactiveParticipant, isActive: true })
    const result = await deleteParticipant("p1", false)
    expect(result).toEqual({ error: "Nur inaktive Teilnehmer können gelöscht werden." })
    expect(participantDeleteMock).not.toHaveBeenCalled()
  })

  it("returns error when participant has competition data", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    competitionParticipantCountMock.mockResolvedValue(3)
    const result = await deleteParticipant("p1", false)
    expect(result).toEqual({
      error: "Dieser Teilnehmer hat historische Daten. Force-Delete ist nur für Admins möglich.",
    })
    expect(participantDeleteMock).not.toHaveBeenCalled()
  })

  it("deletes participant without data as admin", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await deleteParticipant("p1", false)
    expect(result).toEqual({ success: true })
    expect(participantDeleteMock).toHaveBeenCalledWith({ where: { id: "p1" } })
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "PARTICIPANT_DELETED" }),
      })
    )
    expect(revalidatePathMock).toHaveBeenCalled()
  })

  it("deletes participant without data as manager", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    const result = await deleteParticipant("p1", false)
    expect(result).toEqual({ success: true })
    expect(participantDeleteMock).toHaveBeenCalledWith({ where: { id: "p1" } })
  })
})

describe("deleteParticipant (force=true)", () => {
  const txMock = {
    playoffMatch: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    playoffDuel: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    playoffDuelResult: { deleteMany: vi.fn().mockResolvedValue({}) },
    matchup: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    series: { deleteMany: vi.fn().mockResolvedValue({}) },
    competitionParticipant: { deleteMany: vi.fn().mockResolvedValue({}) },
    participant: { delete: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    participantFindUniqueMock.mockResolvedValue(inactiveParticipant)
    competitionParticipantCountMock.mockResolvedValue(2)
    auditLogCreateMock.mockResolvedValue({})
    transactionMock.mockImplementation(async (fn: (tx: typeof txMock) => Promise<void>) =>
      fn(txMock)
    )
    // Reset tx mocks
    txMock.playoffMatch.findMany.mockResolvedValue([])
    txMock.playoffMatch.deleteMany.mockResolvedValue({})
    txMock.playoffDuel.findMany.mockResolvedValue([])
    txMock.playoffDuel.deleteMany.mockResolvedValue({})
    txMock.playoffDuelResult.deleteMany.mockResolvedValue({})
    txMock.matchup.findMany.mockResolvedValue([])
    txMock.matchup.deleteMany.mockResolvedValue({})
    txMock.series.deleteMany.mockResolvedValue({})
    txMock.competitionParticipant.deleteMany.mockResolvedValue({})
    txMock.participant.delete.mockResolvedValue({})
    txMock.auditLog.create.mockResolvedValue({})
  })

  it("returns error when not admin (manager)", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    const result = await deleteParticipant("p1", true)
    expect(result).toEqual({ error: "Keine Berechtigung" })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("returns error when participant not found", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    participantFindUniqueMock.mockResolvedValue(null)
    const result = await deleteParticipant("p1", true)
    expect(result).toEqual({ error: "Teilnehmer nicht gefunden." })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("returns error when participant is active", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    participantFindUniqueMock.mockResolvedValue({ ...inactiveParticipant, isActive: true })
    const result = await deleteParticipant("p1", true)
    expect(result).toEqual({ error: "Nur inaktive Teilnehmer können gelöscht werden." })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("executes transaction and deletes participant", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await deleteParticipant("p1", true)
    expect(result).toEqual({ success: true })
    expect(transactionMock).toHaveBeenCalledOnce()
    expect(txMock.participant.delete).toHaveBeenCalledWith({ where: { id: "p1" } })
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "PARTICIPANT_FORCE_DELETED" }),
      })
    )
    expect(revalidatePathMock).toHaveBeenCalled()
  })

  it("returns error when transaction throws", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    transactionMock.mockRejectedValue(new Error("DB error"))
    const result = await deleteParticipant("p1", true)
    expect(result).toEqual({ error: "Teilnehmer konnte nicht gelöscht werden." })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/participants/actions.test.ts
```

Expected: Multiple FAIL — `deleteParticipant` is not exported from actions.

- [ ] **Step 3: Implement deleteParticipant in actions.ts**

Add to `src/lib/participants/actions.ts` (after the existing imports, add `isAdmin` to the import from `@/lib/auth-helpers`):

```typescript
import { getAuthSession, canManage, isAdmin } from "@/lib/auth-helpers"
```

Then add the new action at the end of the file:

```typescript
// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────

export async function deleteParticipant(id: string, force: boolean): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }
  if (force && !isAdmin(session.user.role)) return { error: "Keine Berechtigung" }

  const participant = await db.participant.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true, isActive: true },
  })
  if (!participant) return { error: "Teilnehmer nicht gefunden." }
  if (participant.isActive) return { error: "Nur inaktive Teilnehmer können gelöscht werden." }

  const competitionCount = await db.competitionParticipant.count({
    where: { participantId: id },
  })

  if (!force) {
    if (competitionCount > 0) {
      return {
        error: "Dieser Teilnehmer hat historische Daten. Force-Delete ist nur für Admins möglich.",
      }
    }

    await db.participant.delete({ where: { id } })
    await db.auditLog.create({
      data: {
        eventType: "PARTICIPANT_DELETED" satisfies AuditEventType,
        entityType: "PARTICIPANT",
        entityId: id,
        userId: session.user.id,
        details: { firstName: participant.firstName, lastName: participant.lastName },
      },
    })
    revalidateParticipantPaths()
    return { success: true }
  }

  // Force delete — cascade in transaction
  try {
    await db.$transaction(async (tx) => {
      // 1. Playoff-Struktur für diesen Teilnehmer
      const playoffMatches = await tx.playoffMatch.findMany({
        where: { OR: [{ participantAId: id }, { participantBId: id }] },
        select: { id: true },
      })
      const playoffMatchIds = playoffMatches.map((m) => m.id)

      if (playoffMatchIds.length > 0) {
        const playoffDuels = await tx.playoffDuel.findMany({
          where: { playoffMatchId: { in: playoffMatchIds } },
          select: { id: true },
        })
        const playoffDuelIds = playoffDuels.map((d) => d.id)

        if (playoffDuelIds.length > 0) {
          await tx.playoffDuelResult.deleteMany({ where: { duelId: { in: playoffDuelIds } } })
          await tx.playoffDuel.deleteMany({ where: { id: { in: playoffDuelIds } } })
        }
        await tx.playoffMatch.deleteMany({ where: { id: { in: playoffMatchIds } } })
      }

      // 2. Matchups + Serien beider Teilnehmer in diesen Paarungen
      const matchups = await tx.matchup.findMany({
        where: { OR: [{ homeParticipantId: id }, { awayParticipantId: id }] },
        select: { id: true },
      })
      const matchupIds = matchups.map((m) => m.id)

      if (matchupIds.length > 0) {
        await tx.series.deleteMany({ where: { matchupId: { in: matchupIds } } })
        await tx.matchup.deleteMany({ where: { id: { in: matchupIds } } })
      }

      // 3. Restliche Serien (Event/Saison — ohne matchupId)
      await tx.series.deleteMany({ where: { participantId: id } })

      // 4. Wettbewerbs-Einschreibungen
      await tx.competitionParticipant.deleteMany({ where: { participantId: id } })

      // 5. Teilnehmer + Audit-Eintrag
      await tx.participant.delete({ where: { id } })
      await tx.auditLog.create({
        data: {
          eventType: "PARTICIPANT_FORCE_DELETED" satisfies AuditEventType,
          entityType: "PARTICIPANT",
          entityId: id,
          userId: session.user.id,
          details: {
            firstName: participant.firstName,
            lastName: participant.lastName,
            competitions: competitionCount,
          },
        },
      })
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim endgültigen Löschen des Teilnehmers:", msg)
    return { error: "Teilnehmer konnte nicht gelöscht werden." }
  }

  revalidateParticipantPaths()
  return { success: true }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/participants/actions.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/participants/actions.ts src/lib/participants/actions.test.ts
git commit -m "feat: add deleteParticipant server action with force-delete support"
```

---

## Task 3: Update ParticipantRowActions component

**Files:**

- Modify: `src/components/app/participants/ParticipantRowActions.tsx`

No unit tests for client components — behavior verified visually via dev server.

- [ ] **Step 1: Replace the entire component file**

```typescript
"use client"

import { useState, useTransition } from "react"
import { Pencil, Trash2, UserCheck, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  setParticipantActive,
  updateParticipant,
  deleteParticipant,
} from "@/lib/participants/actions"
import { ParticipantForm } from "./ParticipantForm"

interface Props {
  participantId: string
  firstName: string
  lastName: string
  contact: string | null
  isActive: boolean
  isAdmin: boolean
  competitionsCount: number
}

export function ParticipantRowActions({
  participantId,
  firstName,
  lastName,
  contact,
  isActive,
  isAdmin,
  competitionsCount,
}: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmName, setConfirmName] = useState("")
  const [isPending, startTransition] = useTransition()

  const action = updateParticipant.bind(null, participantId)
  const hasData = competitionsCount > 0
  const nameMatches = confirmName.trim() === lastName

  function handleToggleActive() {
    startTransition(async () => {
      const result = await setParticipantActive(participantId, !isActive)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Statuswechsel.")
      }
    })
  }

  function handleDelete(force: boolean) {
    startTransition(async () => {
      const result = await deleteParticipant(participantId, force)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Löschen.")
      } else {
        setDeleteOpen(false)
      }
    })
  }

  return (
    <div className="flex items-center gap-1">
      {/* Bearbeiten */}
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        title="Bearbeiten"
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Teilnehmer bearbeiten</DialogTitle>
          </DialogHeader>
          <ParticipantForm
            participant={{ firstName, lastName, contact }}
            action={action}
            onSuccess={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Deaktivieren / Aktivieren */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            title={isActive ? "Deaktivieren" : "Aktivieren"}
            disabled={isPending}
          >
            {isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isActive ? "Teilnehmer deaktivieren?" : "Teilnehmer aktivieren?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? `${lastName}, ${firstName} wird deaktiviert und kann keinen Ligen mehr hinzugefügt werden.`
                : `${lastName}, ${firstName} wird wieder aktiviert.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive}>
              {isActive ? "Deaktivieren" : "Aktivieren"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Löschen — nur für inaktive Teilnehmer */}
      {!isActive && (
        <AlertDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            setDeleteOpen(open)
            if (!open) setConfirmName("")
          }}
        >
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              title="Löschen"
              disabled={isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>

          {/* Variante 1: Keine Wettbewerbsdaten — einfache Bestätigung */}
          {!hasData && (
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Teilnehmer löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  {lastName}, {firstName} wird endgültig gelöscht. Diese Aktion kann nicht
                  rückgängig gemacht werden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Abbrechen</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(false)}
                  disabled={isPending}
                >
                  {isPending ? "Löschen…" : "Löschen"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}

          {/* Variante 2: Wettbewerbsdaten vorhanden, kein Admin */}
          {hasData && !isAdmin && (
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Löschen nicht möglich</AlertDialogTitle>
                <AlertDialogDescription>
                  Dieser Teilnehmer hat {competitionsCount}{" "}
                  {competitionsCount === 1 ? "Wettbewerb" : "Wettbewerbe"} und kann daher nicht
                  gelöscht werden. Force-Delete ist nur für Admins möglich.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Schließen</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}

          {/* Variante 3: Wettbewerbsdaten vorhanden, Admin — Force-Delete */}
          {hasData && isAdmin && (
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Teilnehmer endgültig löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten dieses Teilnehmers
                  werden dauerhaft gelöscht — inklusive {competitionsCount}{" "}
                  {competitionsCount === 1 ? "Wettbewerb" : "Wettbewerbe"}, alle Serien und
                  Liga-Paarungen (inkl. der Serien des jeweiligen Gegners).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="confirm-participant-name">
                  Zur Bestätigung den Nachnamen eingeben:{" "}
                  <span className="font-semibold">{lastName}</span>
                </Label>
                <Input
                  id="confirm-participant-name"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={lastName}
                  disabled={isPending}
                  autoComplete="off"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Abbrechen</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(true)}
                  disabled={!nameMatches || isPending}
                >
                  {isPending ? "Löschen…" : "Endgültig löschen"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}
        </AlertDialog>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/app/participants/ParticipantRowActions.tsx
git commit -m "feat: add delete button with adaptive dialog to ParticipantRowActions"
```

---

## Task 4: Wire props in the participants page

**Files:**

- Modify: `src/app/(app)/participants/page.tsx`

- [ ] **Step 1: Add isAdmin + competitionsCount props to both ParticipantRowActions usages**

The page renders `ParticipantRowActions` twice — once in the active section, once in the inactive section. Add the two new props to both:

```typescript
<ParticipantRowActions
  participantId={p.id}
  firstName={p.firstName}
  lastName={p.lastName}
  contact={p.contact}
  isActive={p.isActive}
  isAdmin={session.user.role === "ADMIN"}
  competitionsCount={p._count.competitions}
/>
```

Apply this to **both** occurrences (active list and inactive list). The component renders the delete button only when `!isActive`, so it's safe to pass these props everywhere.

- [ ] **Step 2: Run quality gates**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm run lint && npm run format:check && npm run test && npx tsc --noEmit
```

Expected: All gates PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/participants/page.tsx
git commit -m "feat: wire isAdmin and competitionsCount props to ParticipantRowActions"
```
