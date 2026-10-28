"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useState, useTransition, type MouseEvent } from "react"
import { toast } from "sonner"

import { getErrorMessage, getFieldError } from "@vereinsheim/lib/forms/fieldErrors"
import { useNavigationConfirm } from "@vereinsheim/lib/hooks/useNavigationConfirm"
import { useUnsavedChangesGuard } from "@vereinsheim/lib/hooks/useUnsavedChangesGuard"
import { cn } from "@vereinsheim/lib/utils"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { Page } from "@vereinsheim/ui/design2/page"

import type { ActionResult } from "@/lib/types"

import { routineDiscard } from "../consequences"
import { ROUTINES_PATH } from "../paths"
import type { Family } from "../queries"
import { createRoutineAction, updateRoutineAction } from "../routines/actions"
import { textToSteps } from "../routines/steps"
import { ROUTINE_FORM_TEXTS as T, ROUTINE_TEXTS } from "../routines/texts"
import { ERRORS } from "../texts"

import { FieldText, StickySaveBar } from "./FormParts"
import { BOX, CHIP, FIELD, LABEL } from "./styles"

/**
 * „Neuer Ablauf“ und „Ablauf bearbeiten“: Name, bei neu die Disziplin, die Schritte als ein Textfeld (Absatz = Schritt,
 * erste Zeile = Titel). Der Hinweis zählt die Schritte, während man schreibt. Gesteuert, Speichern klebt unten.
 */
export function RoutineForm({
  routine,
  families,
  familyId,
}: {
  /** zum Bearbeiten: Kennung, Name, Disziplin und die Schritte als Text */
  routine: { id: string; name: string; family: Family | null; text: string } | null
  families: Family[]
  /** bei neu vorgewählt (`?family=`) */
  familyId: number | null
}) {
  const router = useRouter()
  const id = useId()
  const [start] = useState(() => ({
    name: routine?.name ?? "",
    familyId: routine ? (routine.family?.id ?? null) : familyId,
    text: routine?.text ?? "",
  }))
  const [form, setForm] = useState(start)
  const [result, setResult] = useState<ActionResult<unknown> | null>(null)
  const [pending, startTransition] = useTransition()
  const dirty = JSON.stringify(form) !== JSON.stringify(start)
  useUnsavedChangesGuard({ enabled: dirty && !pending })
  const leave = useNavigationConfirm({ isDirty: dirty && !pending })
  const back = routine ? `/diary/routines/${routine.id}` : ROUTINES_PATH
  const steps = textToSteps(form.text).length

  // ein Toast der vorigen Seite läge über der klebenden Leiste (conventions §9)
  useEffect(() => {
    toast.dismiss()
  }, [])

  const error = (field: string) => (result ? getFieldError(result, field) : undefined)
  const general =
    result && "error" in result && typeof result.error === "string"
      ? (getErrorMessage(result) ?? ERRORS.failed)
      : null
  const goBack = (event: MouseEvent) => {
    if (!dirty) return
    event.preventDefault()
    leave.requestNavigation(() => router.push(back))
  }

  return (
    <Page>
      <form
        data-routine-form
        className={`grid gap-5 ${PAGE_SINGLE}`}
        onSubmit={(event) => {
          event.preventDefault()
          startTransition(async () => {
            const answer = routine
              ? await updateRoutineAction(routine.id, { name: form.name, text: form.text })
              : await createRoutineAction(form)
            setResult(answer)
            if ("error" in answer) return
            toast.success(routine ? T.saved : T.created)
            const target = routine?.id ?? (answer as { data?: { id: string } }).data?.id
            router.replace(target ? `/diary/routines/${target}` : ROUTINES_PATH)
          })
        }}
      >
        <Link
          href={back}
          onClick={goBack}
          className="inline-flex items-center gap-1.5 justify-self-start text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {routine ? routine.name : ROUTINE_TEXTS.back}
        </Link>
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
          {routine ? T.titleEdit : T.titleNew}
        </h1>

        <div className={`${BOX} grid gap-4`}>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-name`} className={LABEL}>
              {T.name}
            </label>
            <input
              id={`${id}-name`}
              data-routine-name
              value={form.name}
              placeholder={T.namePlaceholder}
              aria-invalid={error("name") ? true : undefined}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className={FIELD}
            />
            <FieldText message={error("name")} />
          </div>
          {!routine && (
            <div className="grid gap-1.5">
              <span className={LABEL}>{T.family}</span>
              <div role="group" aria-label={T.family} className="flex flex-wrap gap-2">
                {families.map((family) => (
                  <button
                    key={family.id}
                    type="button"
                    aria-pressed={form.familyId === family.id}
                    onClick={() =>
                      setForm({
                        ...form,
                        familyId: form.familyId === family.id ? null : family.id,
                      })
                    }
                    className={CHIP}
                  >
                    {family.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-text`} className={LABEL}>
              {T.steps}
            </label>
            <textarea
              id={`${id}-text`}
              data-routine-text
              value={form.text}
              rows={10}
              aria-invalid={error("text") ? true : undefined}
              aria-describedby={`${id}-hint`}
              onChange={(event) => setForm({ ...form, text: event.target.value })}
              className={cn(FIELD, "field-sizing-content min-h-48 resize-none leading-relaxed")}
            />
            <p id={`${id}-hint`} data-routine-hint className="text-[13px] text-muted-foreground">
              {T.hint(steps)}
            </p>
            <FieldText message={error("text")} />
          </div>
        </div>

        <StickySaveBar
          name="routine"
          error={general}
          back={back}
          onBack={goBack}
          cancel={T.cancel}
          save={routine ? T.save : T.create}
          pending={pending}
        />
      </form>
      <DecisionDialog
        decision={routineDiscard()}
        open={leave.isConfirmOpen}
        onOpenChange={(open) => !open && leave.cancel()}
        onConfirm={leave.confirm}
      />
    </Page>
  )
}
