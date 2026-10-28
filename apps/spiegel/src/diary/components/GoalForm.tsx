"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useState, useTransition } from "react"
import { toast } from "sonner"

import { getErrorMessage, getFieldError } from "@vereinsheim/lib/forms/fieldErrors"
import { useNavigationConfirm } from "@vereinsheim/lib/hooks/useNavigationConfirm"
import { useUnsavedChangesGuard } from "@vereinsheim/lib/hooks/useUnsavedChangesGuard"
import { cn } from "@vereinsheim/lib/utils"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { Page } from "@vereinsheim/ui/design2/page"
import { Segmented } from "@vereinsheim/ui/design2/segmented"

import type { ActionResult } from "@/lib/types"

import { goalDiscard } from "../consequences"
import { createGoalAction, previewGoalAction, updateGoalAction } from "../goals/actions"
import { dateText } from "../goals/labels"
import type { GoalCards, GoalMeasure, GoalScoring } from "../goals/measure"
import type { FamilyDefaults } from "../goals/queries"
import type { Season } from "../goals/season"
import { GOAL_FORM_TEXTS as T, GOAL_TEXTS } from "../goals/texts"
import type { GoalData } from "../goals/validation"
import { ERRORS } from "../texts"

const BOX = "rounded-2xl border border-border bg-card p-4"
const LABEL = "text-[12px] font-semibold tracking-wide text-muted-foreground uppercase"
const FIELD =
  "rounded-xl border border-border bg-background px-3 py-2 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive"
const CHIP =
  "inline-flex h-8 cursor-pointer items-center rounded-full border border-line-strong px-3 text-[13px] font-semibold text-foreground-2 focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-accent-wash aria-pressed:text-foreground"

type Period = "current" | "next" | "free"

interface FormState {
  title: string
  kind: "result" | "process"
  familyId: number | null
  period: Period
  from: string
  to: string
  measured: boolean
  measure: GoalMeasure
  threshold: string
  scoring: GoalScoring
  shots: string
  cards: GoalCards
}

/** der Anfangszustand: ein bestehendes Ziel, sonst die laufende Saison, die erste Disziplin, Messung an */
function initialState(
  goal: GoalData | null,
  families: readonly FamilyDefaults[],
  seasons: { current: Season; next: Season }
): FormState {
  const first = families[0]
  if (!goal)
    return {
      title: "",
      kind: "result",
      familyId: first?.family.id ?? null,
      period: "current",
      from: seasons.current.from,
      to: seasons.current.to,
      measured: Boolean(first),
      measure: "card",
      threshold: "",
      scoring: first?.scoring ?? "decimal",
      shots: String(first?.shots ?? 40),
      cards: "all",
    }
  const defaults = families.find((f) => f.family.id === goal.familyId) ?? first
  const period: Period =
    goal.from === seasons.current.from && goal.to === seasons.current.to
      ? "current"
      : goal.from === seasons.next.from && goal.to === seasons.next.to
        ? "next"
        : "free"
  const m = goal.measure
  return {
    title: goal.title,
    kind: goal.kind,
    familyId: goal.familyId,
    period,
    from: goal.from,
    to: goal.to,
    measured: m !== null,
    measure: m?.measure ?? "card",
    threshold: m ? String(m.threshold).replace(".", ",") : "",
    scoring: m?.scoring ?? defaults?.scoring ?? "decimal",
    shots: String(m?.shots ?? defaults?.shots ?? 40),
    cards: m?.cards ?? "all",
  }
}

/**
 * „Neues Ziel“ und „Ziel ändern“: die Fragen in der Reihenfolge, in der man denkt (was, welche Disziplin, wann, ob
 * Spiegel mitzählt). Wertung und Schusszahl sind vorbelegt und stehen als eine Zeile mit „Ändern“. Darunter steht,
 * was die Messung mit den Scheiben im Zeitraum ergäbe. Gesteuert (conventions §9), Speichern klebt unten.
 */
export function GoalForm({
  goalId,
  goal,
  families,
  seasons,
  timeZone,
}: {
  goalId: string | null
  goal: GoalData | null
  families: readonly FamilyDefaults[]
  seasons: { current: Season; next: Season }
  timeZone: string
}) {
  const router = useRouter()
  const id = useId()
  const [start] = useState(() => initialState(goal, families, seasons))
  const [form, setForm] = useState(start)
  const [details, setDetails] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<ActionResult<unknown> | null>(null)
  const [pending, startTransition] = useTransition()
  const dirty = JSON.stringify(form) !== JSON.stringify(start)
  useUnsavedChangesGuard({ enabled: dirty && !pending })
  const leave = useNavigationConfirm({ isDirty: dirty && !pending })
  const back = goalId ? `/diary/goals/${goalId}` : "/diary/goals"
  const defaultsOf = (familyId: number | null) =>
    families.find((f) => f.family.id === familyId) ?? null
  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }))
  const canMeasure = form.kind === "result" && form.familyId !== null
  const measuring = canMeasure && form.measured
  const shots = Number(form.shots)

  // ein Toast der vorigen Seite läge über der klebenden Leiste (conventions §9)
  useEffect(() => {
    toast.dismiss()
  }, [])

  // die Vorschau 300 ms nach der letzten Änderung, nur mit vollständiger Messung
  useEffect(() => {
    if (!measuring || form.familyId === null) return
    const familyId = form.familyId
    const timer = setTimeout(async () => {
      const answer = await previewGoalAction({
        familyId,
        from: form.from,
        to: form.to,
        measure: form.measure,
        threshold: form.threshold,
        scoring: form.scoring,
        shots,
        cards: form.cards,
      })
      setPreview("success" in answer ? (answer.data?.text ?? null) : null)
    }, 300)
    return () => clearTimeout(timer)
  }, [
    measuring,
    form.familyId,
    form.from,
    form.to,
    form.measure,
    form.threshold,
    form.scoring,
    shots,
    form.cards,
  ])

  const chooseFamily = (familyId: number | null) => {
    const d = defaultsOf(familyId)
    set({
      familyId,
      // ohne geöffnetes „Ändern“ folgen Wertung und Schusszahl der Disziplin
      ...(d && !details
        ? { scoring: d.scoring, shots: String(form.measure === "series" ? d.seriesShots : d.shots) }
        : {}),
    })
  }
  const chooseMeasure = (measure: GoalMeasure) => {
    const d = defaultsOf(form.familyId)
    const wasSeries = form.measure === "series"
    set({
      measure,
      ...(d && wasSeries !== (measure === "series")
        ? { shots: String(measure === "series" ? d.seriesShots : d.shots) }
        : {}),
    })
  }
  const choosePeriod = (period: Period) => {
    if (period === "current") set({ period, from: seasons.current.from, to: seasons.current.to })
    else if (period === "next") set({ period, from: seasons.next.from, to: seasons.next.to })
    else set({ period })
  }

  const submit = () =>
    startTransition(async () => {
      const input = {
        title: form.title,
        kind: form.kind,
        familyId: form.familyId,
        from: form.from,
        to: form.to,
        measure: measuring
          ? {
              measure: form.measure,
              threshold: form.threshold,
              scoring: form.scoring,
              shots: Number.isInteger(shots) ? shots : 0,
              cards: form.cards,
            }
          : null,
      }
      const answer = goalId ? await updateGoalAction(goalId, input) : await createGoalAction(input)
      setResult(answer)
      if ("error" in answer) {
        if (getFieldError(answer, "threshold") || getFieldError(answer, "shots")) setDetails(true)
        return
      }
      toast.success(goalId ? T.saved : T.created)
      const target = goalId ?? (answer as { data?: { id: string } }).data?.id ?? null
      router.replace(target ? `/diary/goals/${target}` : "/diary/goals")
    })

  const error = (field: string) => (result ? getFieldError(result, field) : undefined)
  const general =
    result && "error" in result && typeof result.error === "string"
      ? (getErrorMessage(result) ?? ERRORS.failed)
      : null

  return (
    <Page>
      <form
        data-goal-form
        className={`grid gap-5 ${PAGE_SINGLE}`}
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Link
          href={back}
          onClick={(event) => {
            if (!dirty) return
            event.preventDefault()
            leave.requestNavigation(() => router.push(back))
          }}
          className="inline-flex items-center gap-1.5 justify-self-start text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {goalId && goal ? goal.title : GOAL_TEXTS.back}
        </Link>
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
          {goalId ? T.titleEdit : T.titleNew}
        </h1>

        <div className={`${BOX} grid gap-4`}>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-title`} className={LABEL}>
              {T.sentence}
            </label>
            <input
              id={`${id}-title`}
              data-goal-title
              value={form.title}
              placeholder={T.sentencePlaceholder}
              aria-invalid={error("title") ? true : undefined}
              onChange={(event) => set({ title: event.target.value })}
              className={FIELD}
            />
            <FieldText message={error("title")} />
          </div>
          <div className="grid gap-1.5">
            <span className={LABEL}>{T.kind}</span>
            <Segmented
              label={T.kind}
              options={[
                { value: "result", label: T.result },
                { value: "process", label: T.process },
              ]}
              value={form.kind}
              onChange={(kind) => set({ kind })}
              className="justify-self-start"
            />
          </div>
          <div className="grid gap-1.5">
            <span className={LABEL}>{T.family}</span>
            <div role="group" aria-label={T.family} className="flex flex-wrap gap-2">
              {families.map(({ family }) => (
                <button
                  key={family.id}
                  type="button"
                  aria-pressed={form.familyId === family.id}
                  onClick={() => chooseFamily(form.familyId === family.id ? null : family.id)}
                  className={CHIP}
                >
                  {family.name}
                </button>
              ))}
            </div>
            <FieldText message={error("familyId")} />
          </div>
          <div className="grid gap-1.5">
            <span className={LABEL}>{T.period}</span>
            <Segmented
              label={T.period}
              options={[
                { value: "current", label: seasons.current.label },
                { value: "next", label: seasons.next.label },
                { value: "free", label: T.free },
              ]}
              value={form.period}
              onChange={choosePeriod}
              wrap
              className="justify-self-start"
            />
            {form.period === "free" ? (
              <div className="flex flex-wrap gap-3">
                {(["from", "to"] as const).map((key) => (
                  <label key={key} className="grid gap-1 text-[13px] font-semibold">
                    {key === "from" ? T.from : T.to}
                    <input
                      type="date"
                      value={form[key]}
                      aria-invalid={key === "to" && error("to") ? true : undefined}
                      onChange={(event) => set({ [key]: event.target.value })}
                      className={FIELD}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground tabular-nums">
                {T.range(dateText(form.from, timeZone), dateText(form.to, timeZone))}
              </p>
            )}
            <FieldText message={error("to")} />
          </div>
        </div>

        {form.kind === "result" && (
          <div data-goal-measure className={`${BOX} grid gap-4`}>
            <div className="flex items-center justify-between gap-3">
              <span className="grid">
                <span className="text-[15px] font-semibold">{T.measured}</span>
                <span className="text-[13px] text-muted-foreground">
                  {canMeasure ? T.measuredHint : T.needsFamily}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={measuring}
                aria-label={T.measured}
                disabled={!canMeasure}
                onClick={() => set({ measured: !form.measured })}
                className={cn(
                  "relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
                  measuring ? "bg-primary" : "bg-line-strong"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1 size-5 rounded-full bg-card shadow-sm transition-[left]",
                    measuring ? "left-6" : "left-1"
                  )}
                />
              </button>
            </div>
            {measuring && (
              <>
                <div className="grid gap-1.5">
                  <span className={LABEL}>{T.measure}</span>
                  <Segmented
                    label={T.measure}
                    options={[
                      { value: "card", label: T.card },
                      { value: "series", label: T.series },
                      { value: "average", label: T.average },
                    ]}
                    value={form.measure}
                    onChange={chooseMeasure}
                    className="justify-self-start"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor={`${id}-threshold`} className={LABEL}>
                    {T.threshold}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id={`${id}-threshold`}
                      data-goal-threshold
                      inputMode={form.scoring === "decimal" ? "decimal" : "numeric"}
                      value={form.threshold}
                      placeholder={form.scoring === "decimal" ? "365,5" : "355"}
                      aria-invalid={error("threshold") ? true : undefined}
                      onChange={(event) => set({ threshold: event.target.value })}
                      className={cn(FIELD, "w-0 max-w-28 grow tabular-nums")}
                    />
                    <span className="text-[13px] text-muted-foreground">
                      {`${form.scoring === "decimal" ? T.inTenths : T.inRings} · ${T.onShots(Number.isInteger(shots) ? shots : 0)}`}
                    </span>
                    {!details && (
                      <button
                        type="button"
                        onClick={() => setDetails(true)}
                        className="cursor-pointer text-[13px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {T.change}
                      </button>
                    )}
                  </div>
                  <FieldText message={error("threshold")} />
                </div>
                {details && (
                  <div data-goal-details className="grid gap-3 rounded-xl bg-surface-2 p-3">
                    <div className="grid gap-1.5">
                      <span className={LABEL}>{T.scoring}</span>
                      <Segmented
                        label={T.scoring}
                        options={[
                          { value: "rings", label: T.rings },
                          { value: "decimal", label: T.tenths },
                        ]}
                        value={form.scoring}
                        onChange={(scoring) => set({ scoring })}
                        className="justify-self-start"
                      />
                    </div>
                    <label className="grid gap-1.5">
                      <span className={LABEL}>
                        {form.measure === "series" ? T.shotsPerSeries : T.shotsPerCard}
                      </span>
                      <input
                        inputMode="numeric"
                        value={form.shots}
                        aria-invalid={error("shots") ? true : undefined}
                        onChange={(event) => set({ shots: event.target.value })}
                        className={cn(FIELD, "w-0 max-w-20 grow tabular-nums")}
                      />
                    </label>
                    <FieldText message={error("shots")} />
                  </div>
                )}
                <div className="grid gap-1.5">
                  <span className={LABEL}>{T.cards}</span>
                  <Segmented
                    label={T.cards}
                    options={[
                      { value: "all", label: T.all },
                      { value: "training", label: T.training },
                      { value: "competition", label: T.competition },
                    ]}
                    value={form.cards}
                    onChange={(cards) => set({ cards })}
                    className="justify-self-start"
                  />
                </div>
                {preview && (
                  <p
                    data-goal-preview
                    aria-live="polite"
                    className="rounded-xl bg-accent-wash px-3 py-2 text-sm tabular-nums"
                  >
                    {preview}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div className="sticky bottom-[calc(var(--app-bar,0px)+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-border bg-background px-4 py-3 after:absolute after:inset-x-0 after:top-full after:h-4 after:bg-background">
          {general && (
            <p role="alert" className="pb-2 text-sm text-destructive">
              {general}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Link
              href={back}
              onClick={(event) => {
                if (!dirty) return
                event.preventDefault()
                leave.requestNavigation(() => router.push(back))
              }}
              className="inline-flex h-11 items-center rounded-md px-4 text-sm font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              {T.cancel}
            </Link>
            <button
              type="submit"
              data-goal-save
              disabled={pending}
              className="inline-flex h-11 cursor-pointer items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
            >
              {pending ? "Speichern…" : goalId ? T.save : T.create}
            </button>
          </div>
        </div>
      </form>
      <DecisionDialog
        decision={goalDiscard()}
        open={leave.isConfirmOpen}
        onOpenChange={(open) => !open && leave.cancel()}
        onConfirm={leave.confirm}
      />
    </Page>
  )
}

function FieldText({ message }: { message: string | undefined }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}
