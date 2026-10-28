"use client"

import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition, type FormEvent, type ReactNode } from "react"
import { toast } from "sonner"

import { getFieldError, getGeneralError } from "@vereinsheim/lib/forms/fieldErrors"
import { useNavigationConfirm } from "@vereinsheim/lib/hooks/useNavigationConfirm"
import { useUnsavedChangesGuard } from "@vereinsheim/lib/hooks/useUnsavedChangesGuard"
import { cn } from "@vereinsheim/lib/utils"
import { KIND_TEXT } from "@vereinsheim/shot-ui/list/KindMark"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { Page } from "@vereinsheim/ui/design2/page"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { FieldError } from "@vereinsheim/ui/field-error"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"

import type { CardKind } from "@/generated/prisma/enums"
import { enteredDiscard } from "@/lib/admin/consequences"
import { saveEnteredCard } from "@/lib/entered/actions"
import {
  seriesTotalText,
  type CenterFields,
  type EnteredFormState,
  type FormDiscipline,
} from "@/lib/entered/form"
import type { NewCardOption } from "@/lib/fetch-card/queries"
import { PLACE_MAX } from "@/lib/entered/details"
import type { ActionResult } from "@/lib/types"

import { NewCardSheet } from "../scan/NewCardSheet"
import { SeriesRows } from "./SeriesRows"

/** Satz im Blatt „Neue Scheibe“ auf dem Weg von Hand */
export const HAND_INTRO = "Wähle Disziplin und Art. Danach trägst du die Werte ein."

const CARD = "grid gap-4 rounded-2xl border border-border bg-card p-4"
const HEADING = "text-[13px] font-semibold text-muted-foreground"
const VALUE_MODES = [
  { value: "decimal", label: "Zehnteln" },
  { value: "rings", label: "ganzen Ringen" },
] as const
const RESULT_MODES = [
  { value: "series", label: "Serien" },
  { value: "total", label: "nur Gesamtergebnis" },
] as const

const errorProps = (id: string, message: string | undefined) =>
  message ? { "aria-invalid": true as const, "aria-describedby": id } : {}

/**
 * Formular „Ergebnis eintragen“ ([[adr-033]]) für eine neue Scheibe von Hand und zum Ändern einer eingetragenen: Tag,
 * Uhrzeit (wenn bekannt), Ort mit Vorschlägen, Werte in Zehnteln oder ganzen Ringen, Serien mit „Schüsse einzeln“ oder
 * nur das Gesamtergebnis, Trefferlage als Summe. Gesteuert; Fehler je Feld aus der Action. Ungespeicherte Eingaben
 * fragen vor dem Verlassen über „Zurück“ (`enteredDiscard`), vor dem Neuladen der Browser.
 */
export function EnteredCardForm({
  mode,
  cardId,
  discipline,
  kind,
  initial,
  places,
  today,
  back,
  choices,
}: {
  mode: "new" | "edit"
  /** beim Ändern die Scheibe */
  cardId?: string
  discipline: FormDiscipline & { id: number; name: string }
  kind: CardKind
  initial: EnteredFormState
  places: readonly string[]
  /** heute in der Anzeige-Zone (`YYYY-MM-DD`), Grenze des Tags */
  today: string
  /** der Rückweg: „Scheibe holen“ oder die Scheibe */
  back: string
  /** beim Anlegen: Disziplin und Art noch einmal wählen */
  choices?: { options: readonly NewCardOption[] }
}) {
  const router = useRouter()
  const [state, setForm] = useState(initial)
  // eine Disziplin ohne Serien (auch nach einer anderen Wahl) hat nur das Gesamtergebnis
  const form: EnteredFormState =
    discipline.seriesShots === null && state.result === "series"
      ? { ...state, result: "total" }
      : state
  const [result, setResult] = useState<ActionResult<{ cardId: string }> | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [pending, startTransition] = useTransition()
  const dirty = JSON.stringify(state) !== JSON.stringify(initial)
  useUnsavedChangesGuard({ enabled: dirty && !pending })
  const leave = useNavigationConfirm({ isDirty: dirty })

  const set = <K extends keyof EnteredFormState>(key: K, value: EnteredFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))
  const setCenter = (patch: Partial<CenterFields>) =>
    setForm((current) => ({ ...current, center: { ...current.center, ...patch } }))
  const errorOf = (field: string) => getFieldError(result, field)
  const general = result && "error" in result ? getGeneralError(result) : undefined
  const total = form.result === "series" ? seriesTotalText(form, discipline) : null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    startTransition(async () => {
      let saved: Awaited<ReturnType<typeof saveEnteredCard>>
      try {
        saved = await saveEnteredCard(
          mode === "edit" ? { cardId, form } : { disciplineId: discipline.id, kind, form }
        )
      } catch {
        saved = { error: "Das ließ sich nicht speichern. Bitte noch einmal versuchen." }
      }
      setResult(saved)
      if ("error" in saved || !saved.data) {
        if (getGeneralError(saved)) toast.error(getGeneralError(saved))
        return
      }
      toast.success(mode === "edit" ? "Änderung gespeichert." : "Scheibe eingetragen.")
      router.push(`/cards/${saved.data.cardId}`)
    })
  }

  const field = (id: string, label: string, error: string | undefined, input: ReactNode) => (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {input}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )

  return (
    <Page>
      <form
        data-entered-form={mode}
        noValidate
        onSubmit={submit}
        className={cn("grid gap-6", PAGE_SINGLE)}
      >
        <div className="grid max-w-lg gap-3">
          <div>
            <Button
              type="button"
              variant="ghost"
              className="h-10 px-2"
              onClick={() => leave.requestNavigation(() => router.push(back))}
            >
              <ArrowLeft aria-hidden className="size-4" />
              Zurück
            </Button>
          </div>
          <div className="grid gap-1">
            <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
              {mode === "edit" ? "Eintrag ändern" : "Ergebnis eintragen"}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p data-entered-discipline className="text-foreground-2">
                {discipline.name} · {KIND_TEXT[kind]}
              </p>
              {choices && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 px-2 text-[13px]"
                  onClick={() => setChoosing(true)}
                >
                  Ändern
                </Button>
              )}
            </div>
          </div>
        </div>

        <section className={cn(CARD, "max-w-lg")} aria-label="Wann und wo">
          <div className="flex flex-wrap gap-3">
            {field(
              "entered-day",
              "Tag",
              errorOf("day"),
              <Input
                id="entered-day"
                type="date"
                max={today}
                className="w-44"
                value={form.day}
                disabled={pending}
                onChange={(e) => set("day", e.target.value)}
                {...errorProps("entered-day-error", errorOf("day"))}
              />
            )}
            {field(
              "entered-time",
              "Uhrzeit (wenn bekannt)",
              errorOf("time"),
              <Input
                id="entered-time"
                type="time"
                className="w-36"
                value={form.time}
                disabled={pending}
                onChange={(e) => set("time", e.target.value)}
                {...errorProps("entered-time-error", errorOf("time"))}
              />
            )}
          </div>
          {field(
            "entered-place",
            "Ort",
            errorOf("place"),
            <>
              <Input
                id="entered-place"
                list="entered-places"
                autoComplete="off"
                maxLength={PLACE_MAX}
                placeholder="etwa Schützenhaus Musterdorf"
                value={form.place}
                disabled={pending}
                onChange={(e) => set("place", e.target.value)}
                {...errorProps("entered-place-error", errorOf("place"))}
              />
              <datalist id="entered-places">
                {places.map((place) => (
                  <option key={place} value={place} />
                ))}
              </datalist>
            </>
          )}
        </section>

        <section className={cn(CARD, "max-w-lg")} aria-label="Ergebnis">
          <div className="grid gap-2">
            <p className={HEADING}>Werte in</p>
            <Segmented
              label="Werte in"
              options={VALUE_MODES}
              value={form.values}
              onChange={(value) => set("values", value)}
            />
          </div>
          {discipline.seriesShots !== null && (
            <div className="grid gap-2">
              <p className={HEADING}>Ergebnis</p>
              <Segmented
                label="Ergebnis"
                options={RESULT_MODES}
                value={form.result}
                onChange={(value) => set("result", value)}
              />
            </div>
          )}
          {form.result === "series" ? (
            <>
              <SeriesRows
                rows={form.series}
                mode={form.values}
                discipline={discipline}
                disabled={pending}
                errorOf={errorOf}
                onChange={(rows) => set("series", rows)}
              />
              {total && (
                <p data-entered-total className="text-sm font-semibold tabular-nums">
                  {total}
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-wrap gap-3">
              {field(
                "entered-total",
                "Ergebnis",
                errorOf("total"),
                <Input
                  id="entered-total"
                  inputMode="decimal"
                  autoComplete="off"
                  className="w-32 tabular-nums"
                  value={form.total}
                  disabled={pending}
                  onChange={(e) => set("total", e.target.value)}
                  {...errorProps("entered-total-error", errorOf("total"))}
                />
              )}
              {field(
                "entered-total-shots",
                "Schusszahl",
                errorOf("totalShots"),
                <Input
                  id="entered-total-shots"
                  inputMode="numeric"
                  autoComplete="off"
                  className="w-28 tabular-nums"
                  placeholder={
                    discipline.plannedShots ? String(discipline.plannedShots) : undefined
                  }
                  value={form.totalShots}
                  disabled={pending}
                  onChange={(e) => set("totalShots", e.target.value)}
                  {...errorProps("entered-total-shots-error", errorOf("totalShots"))}
                />
              )}
            </div>
          )}
          <FieldError id="entered-result-error" message={errorOf("result")} />
        </section>

        <section className={cn(CARD, "max-w-lg")} aria-labelledby="entered-center-title">
          <div className="grid gap-1">
            <h2 id="entered-center-title" className="text-[15px] font-semibold">
              Trefferlage (wenn bekannt)
            </h2>
            <p className="text-sm text-foreground-2">
              Die Mitte deiner Schüsse, wie sie die Anlage anzeigt.
            </p>
          </div>
          {(
            [
              [
                "x",
                "waagrecht",
                "xDir",
                [
                  { value: "left", label: "links" },
                  { value: "right", label: "rechts" },
                ],
              ],
              [
                "y",
                "senkrecht",
                "yDir",
                [
                  { value: "up", label: "hoch" },
                  { value: "down", label: "tief" },
                ],
              ],
            ] as const
          ).map(([axis, label, dir, options]) => {
            const id = `entered-center-${axis}`
            const error = errorOf(`center.${axis}`)
            return (
              <div key={axis} className="grid gap-1.5">
                <Label htmlFor={id}>{label}</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Input
                      id={id}
                      inputMode="decimal"
                      autoComplete="off"
                      className="w-24 tabular-nums"
                      value={form.center[axis]}
                      disabled={pending}
                      onChange={(e) => setCenter({ [axis]: e.target.value })}
                      {...errorProps(`${id}-error`, error)}
                    />
                    <span className="text-sm text-foreground-2">mm</span>
                  </div>
                  <Segmented
                    label={`Richtung ${label}`}
                    options={options}
                    value={form.center[dir]}
                    onChange={(value) => setCenter({ [dir]: value })}
                  />
                </div>
                <FieldError id={`${id}-error`} message={error} />
              </div>
            )
          })}
        </section>

        <div className="grid max-w-lg gap-2">
          {general && (
            <p role="alert" className="text-sm text-destructive">
              {general}
            </p>
          )}
          <Button type="submit" data-entered-save className="h-11" disabled={pending}>
            {pending ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      </form>

      <DecisionDialog
        decision={enteredDiscard()}
        open={leave.isConfirmOpen}
        onOpenChange={(open) => {
          if (!open) leave.cancel()
        }}
        onConfirm={leave.confirm}
      />
      {choices && choosing && (
        <NewCardSheet
          open
          onClose={() => setChoosing(false)}
          relifts={false}
          intro={HAND_INTRO}
          confirmLabel="Weiter"
          options={choices.options}
          preset={{ disciplineId: discipline.id, kind }}
          pending={false}
          onCreate={(choice) => {
            setChoosing(false)
            router.replace(`/cards/new?discipline=${choice.disciplineId}&kind=${choice.kind}`)
          }}
        />
      )}
    </Page>
  )
}
