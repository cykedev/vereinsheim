"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition, type FormEvent } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { plannedShotsOf, seriesShotsOf } from "@vereinsheim/shot-core/discipline"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"
import { Button } from "@vereinsheim/ui/button"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { disciplineChange, type DisciplineMapping } from "@/lib/admin/consequences"
import { saveDiscipline } from "@/lib/admin/discipline-actions"
import {
  cardsText,
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
type SeriesChoice = "count" | "none"

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

const isCount = (value: number) => Number.isInteger(value) && value >= 1 && value <= MAX_SHOTS

/** Schüsse je Serie, wie Einträge von Hand sie bekommen; 0 ohne Serien */
export const effectiveSeriesShots = (
  row: Pick<DisciplineRow, "meytonId" | "plannedShots" | "seriesShots">
) => seriesShotsOf(row.seriesShots, plannedShotsOf(row.meytonId, row.plannedShots)) ?? 0

/** die gespeicherte Zuordnung einer Zeile */
const mappingOf = (row: DisciplineRow): DisciplineMapping => ({
  targetId: row.targetId,
  familyId: row.familyId,
  officialScoring: row.officialScoring,
  plannedShots: row.plannedShots,
  confirmed: row.confirmed,
})

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
  // ohne Meyton-ID gibt es keine Schusszahl aus der Nummer
  const [shots, setShots] = useState<ShotsChoice>(
    row.plannedShots === null && row.meytonId !== null ? "id" : row.plannedShots ? "count" : "open"
  )
  const seriesBefore = effectiveSeriesShots(row)
  const [series, setSeries] = useState<SeriesChoice>(seriesBefore ? "count" : "none")
  const [seriesCount, setSeriesCount] = useState(String(seriesBefore || 10))
  const [count, setCount] = useState(
    row.plannedShots ? String(row.plannedShots) : String(row.suggestion.plannedShotsFromId ?? 40)
  )
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const countValue = Number(count)
  const countValid = isCount(countValue)
  const seriesValue = Number(seriesCount)
  const seriesValid = series === "none" || isCount(seriesValue)
  const seriesAfter = series === "none" ? 0 : seriesValue
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
    before.plannedShots !== after.plannedShots ||
    seriesAfter !== seriesBefore
  const familyName = families.find((f) => f.id === after.familyId)?.name ?? null
  const state = statusText(row)
  const hint = ignoreHintText(row)

  const header = (
    <div className="grid gap-1">
      <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
        {row.name}
      </h1>
      <p className="text-[13px] text-muted-foreground">
        {row.meytonId === null ? "" : `Nummer ${row.meytonId} · `}
        {cardsText(row.stats.cards)}
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
    if (pending || (shots === "count" && !countValid) || !seriesValid) return
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
            ...(row.meytonId === null
              ? []
              : [{ value: "id" as const, label: fromIdLabel(row.suggestion.plannedShotsFromId) }]),
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
      <section className={CARD}>
        <h2 className="text-[15px] font-semibold">Serienlänge</h2>
        <SeriesFields
          value={series}
          onChange={setSeries}
          count={seriesCount}
          onCount={setSeriesCount}
          valid={seriesValid}
        />
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
          disabled={
            pending ||
            (row.confirmed && !changed) ||
            (shots === "count" && !countValid) ||
            !seriesValid
          }
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
          series: {
            before: seriesBefore || null,
            after: seriesAfter || null,
          },
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
              // nur eine geänderte Serienlänge: eine aus der Schusszahl bleibt sonst eine aus der Schusszahl
              ...(seriesAfter === seriesBefore ? {} : { seriesShots: seriesAfter }),
            })
            if ("error" in result) setError(getErrorMessage(result) ?? null)
            else back()
          })
        }
      />
    </form>
  )
}

/** Serienlänge für Einträge von Hand: eine Zahl oder ohne Serien; im Formular einer Disziplin und beim Anlegen */
export function SeriesFields({
  value,
  onChange,
  count,
  onCount,
  valid,
  id = "series-shots",
}: {
  value: SeriesChoice
  onChange: (value: SeriesChoice) => void
  count: string
  onCount: (count: string) => void
  valid: boolean
  id?: string
}) {
  return (
    <>
      <Segmented
        label="Serienlänge"
        options={[
          { value: "count", label: "Zahl" },
          { value: "none", label: "Ohne Serien" },
        ]}
        value={value}
        onChange={onChange}
        wrap
      />
      {value === "count" && (
        <div className="grid max-w-40 gap-1.5">
          <Label htmlFor={id}>Schüsse je Serie</Label>
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_SHOTS}
            value={count}
            onChange={(e) => onCount(e.target.value)}
            aria-invalid={valid ? undefined : true}
          />
        </div>
      )}
    </>
  )
}
