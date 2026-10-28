"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition, type FormEvent } from "react"

import { getFieldError, getGeneralError } from "@vereinsheim/lib/forms/fieldErrors"
import { DEFAULT_SERIES_SHOTS } from "@vereinsheim/shot-core/discipline"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { FieldError } from "@vereinsheim/ui/field-error"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"

import { disciplineCreate } from "@/lib/admin/consequences"
import { createDiscipline } from "@/lib/admin/discipline-actions"
import type { FamilyRow } from "@/lib/admin/discipline-model"

import { SeriesFields } from "./DisciplineForm"

const CARD = "grid gap-3 rounded-2xl border border-border bg-card p-5"
const MAX_SHOTS = 200
const TARGET_IDS = Object.keys(TARGETS) as TargetId[]

type ScoringChoice = "decimal" | "rings" | "open"

const isCount = (value: number) => Number.isInteger(value) && value >= 1 && value <= MAX_SHOTS

/**
 * Kasten „Neue Disziplin“ (Admin → Disziplinen): eine Disziplin ohne Meyton für Scheiben von Hand, von fremden Anlagen
 * und aus Treffsicher. Name, Familie, Scheibe, Schusszahl, Serienlänge und Wertung; Anlegen fragt erst
 * (`disciplineCreate`). Familie und Scheibe sind Pflicht, sonst wäre die Disziplin nicht wählbar.
 */
export function NewDisciplineForm({ families }: { families: readonly FamilyRow[] }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [family, setFamily] = useState(families[0] ? String(families[0].id) : "")
  const [target, setTarget] = useState<TargetId>(TARGET_IDS[0]!)
  const [shots, setShots] = useState<"count" | "open">("count")
  const [count, setCount] = useState("40")
  const [series, setSeries] = useState<"count" | "none">("count")
  const [seriesCount, setSeriesCount] = useState(String(DEFAULT_SERIES_SHOTS))
  const [scoring, setScoring] = useState<ScoringChoice>("decimal")
  const [asking, setAsking] = useState(false)
  const [state, setState] = useState<Awaited<ReturnType<typeof createDiscipline>> | null>(null)
  const [pending, startTransition] = useTransition()

  const countValue = Number(count)
  const countValid = shots === "open" || isCount(countValue)
  const seriesValue = Number(seriesCount)
  const seriesValid = series === "none" || isCount(seriesValue)
  const familyName = families.find((f) => String(f.id) === family)?.name ?? null
  const nameError = getFieldError(state, "name")
  const general = getGeneralError(state)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (pending || !countValid || !seriesValid || familyName === null) return
    if (!name.trim()) {
      setState({ error: { name: ["Gib der Disziplin einen Namen."] } })
      return
    }
    setAsking(true)
  }

  return (
    <form className={CARD} data-new-discipline onSubmit={submit}>
      <div className="grid gap-1">
        <h2 className="text-[15px] font-semibold">Neue Disziplin</h2>
        <p className="text-sm text-foreground-2">
          Für Scheiben, die nicht von der Anlage kommen. Meyton-Disziplinen legt Spiegel selbst an.
        </p>
      </div>
      <div className="grid max-w-sm gap-1.5">
        <Label htmlFor="new-discipline-name">Name</Label>
        <Input
          id="new-discipline-name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
          {...(nameError
            ? { "aria-invalid": true, "aria-describedby": "new-discipline-name-error" }
            : {})}
        />
        <FieldError id="new-discipline-name-error" message={nameError} />
      </div>
      <div className="grid gap-2">
        <p className="text-[13px] font-semibold text-muted-foreground">Familie</p>
        <Segmented
          label="Familie"
          options={families.map((f) => ({ value: String(f.id), label: f.name }))}
          value={family}
          onChange={setFamily}
          wrap
        />
      </div>
      <div className="grid gap-2">
        <p className="text-[13px] font-semibold text-muted-foreground">Scheibe</p>
        <Segmented
          label="Scheibe"
          options={TARGET_IDS.map((id) => ({ value: id, label: TARGETS[id].label }))}
          value={target}
          onChange={setTarget}
          wrap
        />
      </div>
      <div className="grid gap-2">
        <p className="text-[13px] font-semibold text-muted-foreground">Schusszahl</p>
        <Segmented
          label="Schusszahl"
          options={[
            { value: "count", label: "Zahl" },
            { value: "open", label: "Keine feste" },
          ]}
          value={shots}
          onChange={setShots}
          wrap
        />
        {shots === "count" && (
          <div className="grid max-w-40 gap-1.5">
            <Label htmlFor="new-discipline-shots">Schüsse</Label>
            <Input
              id="new-discipline-shots"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_SHOTS}
              value={count}
              onChange={(e) => {
                setCount(e.target.value)
                // Serien zu zehn, solange die Schusszahl aus Zehnern besteht; sonst bleibt die Wahl, wie sie ist
                const next = Number(e.target.value)
                if (isCount(next) && series === "count")
                  setSeriesCount((current) =>
                    next % DEFAULT_SERIES_SHOTS === 0 ? String(DEFAULT_SERIES_SHOTS) : current
                  )
              }}
              aria-invalid={countValid ? undefined : true}
            />
          </div>
        )}
      </div>
      <div className="grid gap-2">
        <p className="text-[13px] font-semibold text-muted-foreground">Serienlänge</p>
        <SeriesFields
          id="new-discipline-series"
          value={series}
          onChange={setSeries}
          count={seriesCount}
          onCount={setSeriesCount}
          valid={seriesValid}
        />
      </div>
      <div className="grid gap-2">
        <p className="text-[13px] font-semibold text-muted-foreground">Wertung</p>
        <Segmented
          label="Wertung"
          options={[
            { value: "decimal", label: "Zehntel" },
            { value: "rings", label: "Ganze Ringe" },
            { value: "open", label: "Wie eingetragen" },
          ]}
          value={scoring}
          onChange={setScoring}
          wrap
        />
      </div>
      {general && (
        <p role="alert" className="text-sm text-destructive">
          {general}
        </p>
      )}
      <div>
        <Button
          type="submit"
          className="h-10"
          disabled={pending || !countValid || !seriesValid || familyName === null}
        >
          {pending ? "Anlegen…" : "Anlegen"}
        </Button>
      </div>
      <DecisionDialog
        decision={disciplineCreate({
          name: name.trim().replace(/\s+/g, " "),
          familyName: familyName ?? "",
          targetLabel: TARGETS[target].label,
          plannedShots: shots === "count" ? countValue : null,
        })}
        open={asking}
        onOpenChange={setAsking}
        onConfirm={() =>
          startTransition(async () => {
            const result = await createDiscipline({
              name,
              targetId: target,
              familyId: Number(family),
              officialScoring: scoring,
              plannedShots: shots === "count" ? countValue : 0,
              seriesShots: series === "count" ? seriesValue : 0,
            })
            setState(result)
            if ("success" in result) {
              setName("")
              router.refresh()
            }
          })
        }
      />
    </form>
  )
}
