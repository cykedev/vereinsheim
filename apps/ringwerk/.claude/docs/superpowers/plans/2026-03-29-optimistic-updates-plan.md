# Optimistic UI-Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dialog und Formular schließen/leeren sich sofort nach dem Submit; Server Action läuft im Hintergrund; Fehler werden per Toast gemeldet.

**Architecture:** Fire-and-forget mit `useTransition`. `setOpen(false)` / State-Reset vor `startTransition`. Fehler → `toast.error()` via Sonner. Konsistent mit bestehendem Muster in `CompetitionActions`, `DisciplineActions` etc. Kein `useOptimistic` nötig.

**Tech Stack:** React 19 `useTransition`, Sonner (`toast`), Next.js Server Actions

---

## Required Docs

- `.claude/docs/code-conventions.md` — immer
- `.claude/docs/reference-files.md` — immer
- `.claude/docs/architecture.md` — immer
- `.claude/docs/ui-patterns.md` — UI-Komponenten werden verändert

---

## Betroffene Dateien

| Datei                                                                  | Aktion |
| ---------------------------------------------------------------------- | ------ |
| `src/components/app/results/ResultEntryDialog.tsx`                     | Modify |
| `src/components/app/competitionParticipants/EnrollParticipantForm.tsx` | Modify |

Keine neuen Dateien. Keine Änderungen an Server Actions, Seiten oder Typen.

---

## Task 1: ResultEntryDialog — Dialog schließt sofort

**Files:**

- Modify: `src/components/app/results/ResultEntryDialog.tsx`

Aktuelles Verhalten: Dialog bleibt offen während Server Action läuft, Inputs sind disabled (`isPending`).
Neues Verhalten: Dialog schließt sofort nach Client-Validierung, Server Action läuft im Hintergrund, Fehler → `toast.error()`.

- [ ] **Schritt 1: Datei lesen und verstehen**

Lies `src/components/app/results/ResultEntryDialog.tsx` vollständig.

- [ ] **Schritt 2: Datei ersetzen**

Ersetze den gesamten Inhalt von `src/components/app/results/ResultEntryDialog.tsx` mit:

```tsx
"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveMatchResult } from "@/lib/results/actions"
import type { MatchResultSummary } from "@/lib/matchups/types"

interface ParticipantResult {
  rings: string
  teiler: string
}

interface Props {
  matchupId: string
  homeName: string
  awayName: string
  homeParticipantId: string
  awayParticipantId: string
  /** Existierende Ergebnisse für Vorausfüllung bei Korrektur */
  existingResults: MatchResultSummary[]
  isCorrection: boolean
}

function getExisting(
  results: MatchResultSummary[],
  participantId: string
): MatchResultSummary | undefined {
  return results.find((r) => r.participantId === participantId)
}

export function ResultEntryDialog({
  matchupId,
  homeName,
  awayName,
  homeParticipantId,
  awayParticipantId,
  existingResults,
  isCorrection,
}: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const existingHome = getExisting(existingResults, homeParticipantId)
  const existingAway = getExisting(existingResults, awayParticipantId)

  const [home, setHome] = useState<ParticipantResult>({
    rings: existingHome ? String(existingHome.rings) : "",
    teiler: existingHome ? String(existingHome.teiler) : "",
  })
  const [away, setAway] = useState<ParticipantResult>({
    rings: existingAway ? String(existingAway.rings) : "",
    teiler: existingAway ? String(existingAway.teiler) : "",
  })

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      // Beim Öffnen: existierende Werte neu laden
      setHome({
        rings: existingHome ? String(existingHome.rings) : "",
        teiler: existingHome ? String(existingHome.teiler) : "",
      })
      setAway({
        rings: existingAway ? String(existingAway.rings) : "",
        teiler: existingAway ? String(existingAway.teiler) : "",
      })
      setError(null)
    }
    setOpen(isOpen)
  }

  function handleSubmit() {
    const homeTotalRings = parseFloat(home.rings.replace(",", "."))
    const homeTeiler = parseFloat(home.teiler.replace(",", "."))
    const awayTotalRings = parseFloat(away.rings.replace(",", "."))
    const awayTeiler = parseFloat(away.teiler.replace(",", "."))

    if (isNaN(homeTotalRings) || isNaN(homeTeiler) || isNaN(awayTotalRings) || isNaN(awayTeiler)) {
      setError("Alle Felder müssen ausgefüllt sein.")
      return
    }

    if (homeTotalRings < 0 || awayTotalRings < 0) {
      setError("Gesamtringe müssen positiv sein.")
      return
    }

    if (homeTeiler < 0 || awayTeiler < 0) {
      setError("Teiler müssen positiv sein.")
      return
    }

    setOpen(false)

    startTransition(async () => {
      const result = await saveMatchResult(matchupId, {
        homeResult: { rings: homeTotalRings, teiler: homeTeiler },
        awayResult: { rings: awayTotalRings, teiler: awayTeiler },
      })

      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Speichern.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {isCorrection ? (
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Ergebnis korrigieren">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant="outline" size="icon" className="h-7 w-7" title="Ergebnis eintragen">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isCorrection ? "Ergebnis korrigieren" : "Ergebnis eintragen"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Heim */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{homeName}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="home-rings" className="text-xs text-muted-foreground">
                  Gesamtringe
                </Label>
                <Input
                  id="home-rings"
                  type="number"
                  step="0.1"
                  min="0"
                  value={home.rings}
                  onChange={(e) => setHome((p) => ({ ...p, rings: e.target.value }))}
                  placeholder="z.B. 96"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="home-teiler" className="text-xs text-muted-foreground">
                  Bester Teiler
                </Label>
                <Input
                  id="home-teiler"
                  type="number"
                  step="0.1"
                  min="0"
                  value={home.teiler}
                  onChange={(e) => setHome((p) => ({ ...p, teiler: e.target.value }))}
                  placeholder="z.B. 3.7"
                />
              </div>
            </div>
          </div>

          {/* Trennlinie */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">vs.</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Gast */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{awayName}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="away-rings" className="text-xs text-muted-foreground">
                  Gesamtringe
                </Label>
                <Input
                  id="away-rings"
                  type="number"
                  step="0.1"
                  min="0"
                  value={away.rings}
                  onChange={(e) => setAway((p) => ({ ...p, rings: e.target.value }))}
                  placeholder="z.B. 94"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="away-teiler" className="text-xs text-muted-foreground">
                  Bester Teiler
                </Label>
                <Input
                  id="away-teiler"
                  type="number"
                  step="0.1"
                  min="0"
                  value={away.teiler}
                  onChange={(e) => setAway((p) => ({ ...p, teiler: e.target.value }))}
                  placeholder="z.B. 5.0"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Änderungen gegenüber dem Original:

- `toast` importiert aus `sonner`
- In `handleSubmit`: `setOpen(false)` vor `startTransition` (statt danach)
- In `startTransition`: Fehler → `toast.error()` statt `setError()`
- `disabled={isPending}` von allen Inputs entfernt (Dialog ist bei Submit bereits zu)
- Button-Label bleibt "Speichern" (kein "Speichern…" mehr nötig)
- `Abbrechen`-Button: `disabled={isPending}` entfernt

- [ ] **Schritt 3: TypeScript prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartung: keine Fehler.

- [ ] **Schritt 4: Commit**

```
feat(results): close ResultEntryDialog immediately on submit

Dialog closes before the server action completes. Errors are
reported via toast instead of inline.
```

---

## Task 2: EnrollParticipantForm — Formular leert sich sofort

**Files:**

- Modify: `src/components/app/competitionParticipants/EnrollParticipantForm.tsx`

Aktuelles Verhalten: Formular bleibt disabled während Server Action läuft (`useActionState`).
Neues Verhalten: Formular leert sich sofort auf Submit, Server Action läuft im Hintergrund, Fehler → `toast.error()`.

Wichtige Implementierungsdetails:

- `new FormData(formRef.current)` wird **vor** dem State-Reset aufgerufen — die hidden inputs (`isGuest`, `newTeam`) haben noch ihre aktuellen DOM-Werte, da React-State-Updates asynchron sind
- `formKey` wird inkrementiert → React remountet das `<form>`-Element → uncontrolled Inputs (Select, Text) werden geleert
- `action`-Prop-Signatur bleibt identisch; wird jetzt direkt aufgerufen: `action(null, formData)`

- [ ] **Schritt 1: Datei lesen und verstehen**

Lies `src/components/app/competitionParticipants/EnrollParticipantForm.tsx` vollständig.

- [ ] **Schritt 2: Datei ersetzen**

Ersetze den gesamten Inhalt von `src/components/app/competitionParticipants/EnrollParticipantForm.tsx` mit:

```tsx
"use client"

import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ParticipantOption } from "@/lib/participants/types"
import type { SerializableDiscipline } from "@/lib/disciplines/types"
import type { EventTeamItem } from "@/lib/eventTeams/types"
import type { ActionResult } from "@/lib/types"

interface Props {
  competitionId: string
  availableParticipants: ParticipantOption[]
  /** Wenn gesetzt: gemischter Wettbewerb — Disziplinwahl pro Teilnehmer erforderlich */
  disciplines?: SerializableDiscipline[]
  /** Wenn true: Gast-Einschreibung erlaubt (allowGuests auf Event) */
  allowGuests?: boolean
  /** Team-Events: Teamgröße ≥ 2 */
  teamSize?: number | null
  /** Team-Events: bestehende Teams mit ihren Mitgliedern */
  eventTeams?: EventTeamItem[]
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>
}

export function EnrollParticipantForm({
  availableParticipants,
  disciplines,
  allowGuests,
  teamSize,
  eventTeams,
  action,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [isGuest, setIsGuest] = useState(false)
  const [newTeam, setNewTeam] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)

  const isMixed = disciplines && disciplines.length > 0
  const isTeamEvent = (teamSize ?? 0) >= 2

  const noRegularParticipants = availableParticipants.length === 0

  // Im Team-Modus können Teilnehmer mehrfach eingeschrieben werden — kein "alle bereits eingeschrieben"
  if (noRegularParticipants && !allowGuests && !isTeamEvent) {
    return (
      <p className="text-sm text-muted-foreground">
        Alle aktiven Teilnehmer sind bereits in diesem Wettbewerb eingeschrieben.
      </p>
    )
  }

  const incompleteTeams = (eventTeams ?? []).filter((t) => t.members.length < (teamSize ?? 0))

  function handleSubmit() {
    if (!formRef.current) return
    // FormData vor dem State-Reset erfassen — hidden inputs haben noch ihre aktuellen Werte
    const formData = new FormData(formRef.current)

    setIsGuest(false)
    setNewTeam(false)
    setFormKey((k) => k + 1)

    startTransition(async () => {
      const result = await action(null, formData)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Einschreiben.")
      }
    })
  }

  return (
    <form key={formKey} ref={formRef} className="space-y-3">
      {allowGuests && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="isGuest"
            checked={isGuest}
            onCheckedChange={(checked: boolean | "indeterminate") => setIsGuest(checked === true)}
            disabled={isPending}
          />
          <Label htmlFor="isGuest" className="cursor-pointer text-sm">
            Gast-Schütze
          </Label>
          <input type="hidden" name="isGuest" value={isGuest ? "true" : "false"} />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {isGuest ? (
          <div className="flex-1 flex flex-col gap-2">
            <Label htmlFor="guestName" className="sm:sr-only">
              Name des Gastes
            </Label>
            <Input
              id="guestName"
              name="guestName"
              placeholder="Name des Gastes…"
              disabled={isPending}
              autoComplete="off"
            />
          </div>
        ) : (
          <>
            {noRegularParticipants ? (
              <p className="flex-1 text-sm text-muted-foreground self-center">
                Alle aktiven Teilnehmer sind bereits eingeschrieben.
              </p>
            ) : (
              <div className="flex-1 flex flex-col gap-2">
                <Label htmlFor="participantId" className="sm:sr-only">
                  Teilnehmer
                </Label>
                <Select name="participantId" disabled={isPending}>
                  <SelectTrigger id="participantId" className="w-full">
                    <SelectValue placeholder="Teilnehmer wählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableParticipants.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.lastName}, {p.firstName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}

        {isMixed && (
          <div className="flex-1 flex flex-col gap-1">
            <Label htmlFor="disciplineId" className="sm:sr-only">
              Disziplin
            </Label>
            <Select name="disciplineId" disabled={isPending}>
              <SelectTrigger id="disciplineId" className="w-full">
                <SelectValue placeholder="Disziplin wählen…" />
              </SelectTrigger>
              <SelectContent>
                {disciplines.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {(isGuest || !noRegularParticipants) && !isTeamEvent && (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full sm:w-auto sm:shrink-0"
          >
            {isPending ? "Lädt…" : "Einschreiben"}
          </Button>
        )}
      </div>

      {/* Team-Auswahl */}
      {isTeamEvent && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="newTeam"
              checked={newTeam}
              onCheckedChange={(checked: boolean | "indeterminate") => setNewTeam(checked === true)}
              disabled={isPending}
            />
            <Label htmlFor="newTeam" className="cursor-pointer text-sm">
              Neues Team erstellen
            </Label>
            <input type="hidden" name="newTeam" value={newTeam ? "true" : "false"} />
          </div>

          {!newTeam && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="teamId" className="text-sm">
                Team wählen
              </Label>
              <Select name="teamId" disabled={isPending}>
                <SelectTrigger id="teamId" className="w-full">
                  <SelectValue placeholder="Team wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {incompleteTeams.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      Keine unvollständigen Teams vorhanden
                    </SelectItem>
                  ) : (
                    incompleteTeams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        Team {t.teamNumber} ({t.members.length}/{teamSize})
                        {t.members.length > 0 &&
                          ` — ${t.members.map((m) => m.firstName).join(", ")}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || (!newTeam && incompleteTeams.length === 0)}
            className="w-full sm:w-auto"
          >
            {isPending ? "Lädt…" : "Einschreiben"}
          </Button>
        </div>
      )}
    </form>
  )
}
```

Änderungen gegenüber dem Original:

- `useActionState` + `useEffect` entfernt → `useTransition` + `useRef` + `formKey`
- `handleSubmit`: erfasst FormData, resettet State + formKey, ruft `action(null, formData)` im Hintergrund auf
- Button `type="submit"` → `type="button"` mit `onClick={handleSubmit}` (beide Buttons)
- `<form action={formAction}>` → `<form key={formKey} ref={formRef}>` (kein action-Attribut)
- `fieldErrors` / `generalError` DOM-Ausgabe entfernt → Fehler nur per Toast
- `toast` importiert aus `sonner`

- [ ] **Schritt 3: TypeScript prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartung: keine Fehler.

- [ ] **Schritt 4: Commit**

```
feat(enrollment): clear EnrollParticipantForm immediately on submit

Form resets before the server action completes. Errors are
reported via toast instead of inline field errors.
```

---

## Task 3: Quality Gates

- [ ] **Schritt 1: Alle Gates grün**

```bash
# Lint
docker compose -f docker-compose.dev.yml run --rm app npm run lint

# Format
docker compose -f docker-compose.dev.yml run --rm app npm run format:check

# Tests
docker compose -f docker-compose.dev.yml run --rm app npm run test

# TypeScript
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Alle müssen grün sein.
