"use client"

import { ArrowLeft, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { Page } from "@vereinsheim/ui/design2/page"
import { useUndo } from "@vereinsheim/ui/design2/undo"

import { ActionRow } from "@/components/card/ActionRow"

import { routineDelete } from "../consequences"
import { ROUTINES_PATH } from "../paths"
import type { Family } from "../queries"
import {
  deleteRoutineAction,
  restoreRoutineAction,
  setRoutineFamilyAction,
} from "../routines/actions"
import type { RoutineView } from "../routines/queries"
import { ROUTINE_TEXTS } from "../routines/texts"
import { ERRORS } from "../texts"

import { PlusRow } from "./FormParts"
import { BOX, CHIP, ROW_BUTTON } from "./styles"

/**
 * Ein Ablauf zum Lesen, gut am Stand auf dem Telefon: nummerierte Schritte in weichen Kreisen, Titel fett, die
 * Erklärung darunter. Ohne Disziplin oben „Disziplin festlegen“, dann steht er in „Abläufe“ unter dieser Disziplin.
 */
export function RoutineScreen({ routine, families }: { routine: RoutineView; families: Family[] }) {
  const [familyOpen, setFamilyOpen] = useState(false)
  const back = ROUTINES_PATH
  return (
    <Page>
      <section data-routine-page className={`grid gap-5 ${PAGE_SINGLE}`}>
        <Link
          href={back}
          className="inline-flex items-center gap-1.5 justify-self-start text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {ROUTINE_TEXTS.back}
        </Link>
        <div className="grid gap-1">
          <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
            {routine.name}
          </h1>
          <p className="text-foreground-2 tabular-nums">
            {ROUTINE_TEXTS.meta(
              routine.family?.name ?? ROUTINE_TEXTS.noFamily,
              routine.steps.length
            )}
          </p>
        </div>

        {!routine.family && !familyOpen && (
          <PlusRow
            name="family"
            title={ROUTINE_TEXTS.setFamily}
            hint={ROUTINE_TEXTS.setFamilyHint}
            onClick={() => setFamilyOpen(true)}
            boxed
          />
        )}

        <ol data-routine-steps className={`${BOX} grid divide-y divide-border py-1`}>
          {routine.steps.map((step, i) => (
            <li key={i} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-3">
              <span
                aria-hidden
                className="flex size-7 items-center justify-center rounded-full bg-accent-wash text-[13px] font-bold text-primary tabular-nums"
              >
                {i + 1}
              </span>
              <span className="grid gap-0.5">
                <span className="text-[15px] font-semibold">{step.title}</span>
                {step.description && (
                  <span className="text-sm whitespace-pre-line text-foreground-2">
                    {step.description}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>

        <section data-routine-actions aria-labelledby="routine-actions-title" className={BOX}>
          <h2 id="routine-actions-title" className="mb-3 text-[15px] font-semibold">
            {ROUTINE_TEXTS.thisRoutine}
          </h2>
          <div className="grid divide-y divide-border">
            <ActionRow
              title={ROUTINE_TEXTS.stepsAndName}
              state=""
              action={
                <Link href={`/diary/routines/${routine.id}/edit`} className={ROW_BUTTON}>
                  {ROUTINE_TEXTS.edit}
                </Link>
              }
            />
            <RoutineFamily
              routine={routine}
              families={families}
              open={familyOpen}
              onOpen={setFamilyOpen}
            />
            <DeleteRoutine routineId={routine.id} name={routine.name} back={back} />
          </div>
        </section>
      </section>
    </Page>
  )
}

/** Zeile „Disziplin“: ändern oder festlegen, an Ort und Stelle wie „Tag, Art und Disziplin“ eines Eintrags */
function RoutineFamily({
  routine,
  families,
  open,
  onOpen,
}: {
  routine: RoutineView
  families: Family[]
  open: boolean
  onOpen: (open: boolean) => void
}) {
  const router = useRouter()
  const [chosen, setChosen] = useState<number | null>(routine.family?.id ?? null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  return (
    <ActionRow
      data-routine-family
      title={ROUTINE_TEXTS.family}
      state={routine.family?.name ?? ROUTINE_TEXTS.noFamily}
      action={
        open ? undefined : (
          <button type="button" onClick={() => onOpen(true)} className={ROW_BUTTON}>
            {routine.family ? ROUTINE_TEXTS.change : ROUTINE_TEXTS.set}
          </button>
        )
      }
    >
      {open && (
        <div className="grid gap-3">
          <div role="group" aria-label={ROUTINE_TEXTS.family} className="flex flex-wrap gap-2">
            {families.map((family) => (
              <button
                key={family.id}
                type="button"
                aria-pressed={chosen === family.id}
                onClick={() => setChosen(chosen === family.id ? null : family.id)}
                className={CHIP}
              >
                {family.name}
              </button>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null)
                  const result = await setRoutineFamilyAction(routine.id, chosen)
                  if ("error" in result) {
                    setError(getErrorMessage(result) ?? ERRORS.failed)
                    return
                  }
                  toast.success(ROUTINE_TEXTS.familySaved)
                  onOpen(false)
                  router.refresh()
                })
              }
              className="inline-flex h-10 cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
            >
              {pending ? "Speichern…" : ROUTINE_TEXTS.save}
            </button>
            <button
              type="button"
              onClick={() => {
                onOpen(false)
                setChosen(routine.family?.id ?? null)
                setError(null)
              }}
              className="inline-flex h-10 cursor-pointer items-center rounded-md px-4 text-sm font-medium hover:bg-surface-2"
            >
              {ROUTINE_TEXTS.cancel}
            </button>
          </div>
        </div>
      )}
    </ActionRow>
  )
}

/** Löschen wie bei einem Eintrag: Rückfrage, Papierkorb, zurück auf „Abläufe“ mit „Ablauf gelöscht · Rückgängig“ */
function DeleteRoutine({
  routineId,
  name,
  back,
}: {
  routineId: string
  name: string
  back: string
}) {
  const router = useRouter()
  const showUndo = useUndo()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  return (
    <ActionRow
      data-delete-routine
      title={ROUTINE_TEXTS.remove}
      state={ROUTINE_TEXTS.removeState}
      action={
        <button
          type="button"
          aria-label={ROUTINE_TEXTS.removeLabel}
          disabled={pending}
          onClick={() => setOpen(true)}
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-destructive hover:bg-destructive-wash focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
        >
          <Trash2 aria-hidden className="size-4" />
          {pending ? "Löschen…" : ROUTINE_TEXTS.remove}
        </button>
      }
    >
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DecisionDialog
        decision={routineDelete({ name })}
        open={open}
        onOpenChange={setOpen}
        onConfirm={() =>
          startTransition(async () => {
            setError(null)
            const result = await deleteRoutineAction(routineId)
            if ("error" in result) {
              setError(getErrorMessage(result) ?? ERRORS.failed)
              return
            }
            showUndo({
              text: ROUTINE_TEXTS.deleted,
              undo: () => restoreRoutineAction(routineId),
              navigating: true,
            })
            router.replace(back)
          })
        }
      />
    </ActionRow>
  )
}
