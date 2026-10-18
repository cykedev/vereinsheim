"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition, type FormEvent } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"
import { Button } from "@vereinsheim/ui/button"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { disciplineChange, type DisciplineMapping } from "@/lib/admin/consequences"
import { saveDiscipline } from "@/lib/admin/discipline-actions"
import {
  fromIdLabel,
  ignoreHintText,
  shotsText,
  standText,
  statusText,
  targetSuggestionText,
  type DisciplineRow,
  type FamilyRow,
} from "@/lib/admin/discipline-model"

import { AdminHelp } from "./AdminHelp"
import { IgnoreButton } from "./DisciplineList"

type TargetChoice = TargetId | "own"
type ScoringChoice = "decimal" | "rings" | "open"
type ShotsChoice = "id" | "count" | "open"

const TARGET_OPTIONS: readonly { value: TargetChoice; label: string }[] = [
  ...(Object.keys(TARGETS) as TargetId[]).map((id) => ({ value: id, label: TARGETS[id].label })),
  { value: "own", label: "Eigene Scheibe" },
]
const SCORING_OPTIONS = [
  { value: "decimal", label: "Zehntel" },
  { value: "rings", label: "Ganze Ringe" },
  { value: "open", label: "Wie am Stand angezeigt" },
] as const

const CARD = "grid gap-3 rounded-2xl border border-border bg-card p-5"
const NOTE = "text-sm text-foreground-2"
const MAX_SHOTS = 200

/** die gespeicherte Zuordnung einer Zeile */
const mappingOf = (row: DisciplineRow): DisciplineMapping => ({
  targetId: row.targetId,
  familyId: row.familyId,
  officialScoring: row.officialScoring,
  plannedShots: row.plannedShots,
  confirmed: row.confirmed,
})

/** wie viele Scheiben, für den Kopf */
const cardsText = (cards: number) =>
  cards === 0 ? "noch keine Scheibe" : cards === 1 ? "1 Scheibe" : `${cards} Scheiben`

/**
 * Blatt einer Disziplin: Zustand, Scheibe, Familie, Wertung, Schusszahl, je mit Vorschlag oder dem, was
 * Spiegel beobachtet hat. Gesteuert; Absenden fragt erst (`DecisionDialog`), dann speichert es. Eine ignorierte
 * Disziplin zeigt nur ihren Zustand und „Wieder zeigen“.
 */
export function DisciplineForm({
  row,
  families,
}: {
  row: DisciplineRow
  families: readonly FamilyRow[]
}) {
  const router = useRouter()
  const back = () => router.push("/admin/disciplines")
  const [target, setTarget] = useState<TargetChoice>(row.targetId ?? "own")
  const [family, setFamily] = useState(row.familyId === null ? "none" : String(row.familyId))
  const [scoring, setScoring] = useState<ScoringChoice>(row.officialScoring ?? "open")
  const [shots, setShots] = useState<ShotsChoice>(
    row.plannedShots === null ? "id" : row.plannedShots === 0 ? "open" : "count"
  )
  const [count, setCount] = useState(
    row.plannedShots ? String(row.plannedShots) : String(row.suggestion.plannedShotsFromId ?? 40)
  )
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const countValue = Number(count)
  const countValid = Number.isInteger(countValue) && countValue >= 1 && countValue <= MAX_SHOTS
  const before = mappingOf(row)
  const after: DisciplineMapping = {
    targetId: target === "own" ? null : target,
    familyId: family === "none" ? null : Number(family),
    officialScoring: scoring === "open" ? null : scoring,
    plannedShots: shots === "id" ? null : shots === "open" ? 0 : countValue,
    confirmed: true,
  }
  const changed =
    before.targetId !== after.targetId ||
    before.familyId !== after.familyId ||
    before.officialScoring !== after.officialScoring ||
    before.plannedShots !== after.plannedShots
  const familyName = families.find((f) => f.id === after.familyId)?.name ?? null
  const state = statusText(row)
  const hint = ignoreHintText(row)

  const header = (
    <div className="grid gap-1">
      <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
        {row.name}
      </h1>
      <p className="text-[13px] text-muted-foreground">
        Nummer {row.meytonId} · {cardsText(row.stats.cards)}
        {row.stats.lastCardMonth && ` · zuletzt im ${row.stats.lastCardMonth}`}
      </p>
    </div>
  )

  // ignoriert (eingeordnet oder als Vorschlag des Einlesens): kein Formular, nur ignorieren (bestätigt den Vorschlag)
  // oder wieder zeigen
  if (row.ignored)
    return (
      <div className="grid gap-4">
        {header}
        <section className={CARD}>
          <p className={NOTE}>{state}</p>
          <div className="flex flex-wrap items-center gap-2">
            {!row.confirmed && <IgnoreButton row={row} ignore onDone={back} />}
            <IgnoreButton row={row} ignore={false} onDone={back} />
          </div>
        </section>
      </div>
    )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (pending || (shots === "count" && !countValid)) return
    setAsking(true)
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      {header}
      {(state || hint) && (
        <section className={CARD} data-discipline-state>
          {state && <p className={NOTE}>{state}</p>}
          {hint && <p className={NOTE}>{hint}</p>}
        </section>
      )}
      <section className={CARD}>
        <h2 className="flex items-center gap-1 text-[15px] font-semibold">
          Scheibe <AdminHelp id="discipline" />
        </h2>
        <Segmented
          label="Scheibe"
          options={TARGET_OPTIONS}
          value={target}
          onChange={setTarget}
          wrap
        />
        <p className={NOTE}>{targetSuggestionText(row)}</p>
        {target === "own" && (
          <p className={NOTE}>
            Spiegel kennt diese Scheibe nicht. Ihre Scheiben zeigt Spiegel deshalb nicht.
          </p>
        )}
      </section>
      <section className={CARD}>
        <h2 className="flex items-center gap-1 text-[15px] font-semibold">
          Familie <AdminHelp id="family" />
        </h2>
        <p className={NOTE}>Scheiben einer Familie stehen zusammen in Liste und Fortschritt.</p>
        <Segmented
          label="Familie"
          options={[
            ...families.map((f) => ({ value: String(f.id), label: f.name })),
            { value: "none", label: "Keine" },
          ]}
          value={family}
          onChange={setFamily}
          wrap
        />
        {family === "none" && (
          <p className={NOTE}>Ohne Familie zeigt Spiegel die Scheiben nicht.</p>
        )}
      </section>
      <section className={CARD}>
        <h2 className="text-[15px] font-semibold">Wertung</h2>
        <p className={NOTE}>
          So zählt Spiegel jede Scheibe dieser Disziplin, im Training wie im Wettkampf. Ein Schütze
          kann es an jeder Scheibe selbst umstellen.
        </p>
        <Segmented
          label="Wertung"
          options={SCORING_OPTIONS}
          value={scoring}
          onChange={setScoring}
          wrap
        />
        <p className={NOTE}>{standText(row.stats)}</p>
      </section>
      <section className={CARD}>
        <h2 className="text-[15px] font-semibold">Schusszahl</h2>
        <p className={NOTE}>Nur eine Scheibe mit allen Schüssen zählt für Rekorde.</p>
        <Segmented
          label="Schusszahl"
          options={[
            { value: "id", label: fromIdLabel(row.suggestion.plannedShotsFromId) },
            { value: "count", label: "Eigene Zahl" },
            { value: "open", label: "Keine feste" },
          ]}
          value={shots}
          onChange={setShots}
          wrap
        />
        {shots === "count" && (
          <div className="grid max-w-40 gap-1.5">
            <Label htmlFor="planned-shots">Schüsse</Label>
            <Input
              id="planned-shots"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_SHOTS}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              aria-invalid={countValid ? undefined : true}
            />
          </div>
        )}
        <p className={NOTE}>{shotsText(row.stats)}</p>
      </section>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          className="h-10"
          disabled={pending || (row.confirmed && !changed) || (shots === "count" && !countValid)}
        >
          {pending ? "Speichern…" : row.confirmed ? "Übernehmen" : "So einordnen"}
        </Button>
        <IgnoreButton row={row} ignore onDone={back} />
      </div>
      <DecisionDialog
        decision={disciplineChange({
          name: row.name,
          cards: row.stats.cards,
          before,
          after,
          targetLabel: after.targetId ? TARGETS[after.targetId as TargetId].label : null,
          familyName,
          plannedShotsFromId: row.suggestion.plannedShotsFromId,
        })}
        open={asking}
        onOpenChange={setAsking}
        onConfirm={() =>
          startTransition(async () => {
            const result = await saveDiscipline(row.id, {
              targetId: target,
              familyId: after.familyId,
              officialScoring: scoring,
              plannedShots:
                shots === "count" ? { mode: "count", count: countValue } : { mode: shots },
            })
            if ("error" in result) setError(getErrorMessage(result) ?? null)
            else back()
          })
        }
      />
    </form>
  )
}
