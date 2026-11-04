"use client"

import { useRef, useState, type FormEvent } from "react"
import { Button } from "@vereinsheim/ui/button"
import type { LeagueFormat } from "@/generated/prisma/client"
import type { SerializableDiscipline } from "@/lib/disciplines/types"
import type { CompetitionDetail } from "@/lib/competitions/types"
import type { ActionResult } from "@/lib/types"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { leagueFormatChange, leaveUnsaved } from "@/lib/consequences"
import {
  BasicFieldsSection,
  EventFieldsSection,
  LeagueFieldsSection,
  PublishSection,
  SeasonFieldsSection,
  useCompetitionFormState,
} from "./competition-form"

interface Props {
  competition?: CompetitionDetail
  disciplines: SerializableDiscipline[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (prevState: ActionResult<any> | null, formData: FormData) => Promise<ActionResult<any>>
  /** Die Liga hat einen Spielplan: Ein anderes Format erzeugt ihn beim Speichern neu (nach Rückfrage). */
  hasSchedule?: boolean
  /** Ein Ergebnis existiert: Regelset (Wertungsmodus, Format, Gruppenphase) gesperrt. */
  rulesetLocked?: boolean
  /** Playoff-/Finale-Einstellungen sperren, sobald die Playoffs gestartet sind. */
  playoffsStarted?: boolean
}

export function CompetitionForm({
  competition,
  disciplines,
  action,
  hasSchedule = false,
  rulesetLocked = false,
  playoffsStarted = false,
}: Props) {
  const form = useCompetitionFormState({ competition, action })
  const { router, formAction, isPending, markDirty, setSubmitted, nav, generalError } = form

  const formRef = useRef<HTMLFormElement>(null)
  // Schickt nach der Rückfrage ab und trägt dabei `replaceSchedule=true` mit; jedes andere Absenden fragt wieder.
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [replaceOpen, setReplaceOpen] = useState(false)

  // Ein anderes Format bei bestehendem Spielplan ersetzt ihn: erst fragen, dann speichern.
  const savedFormat = competition?.type === "LEAGUE" ? competition.leagueFormat : null
  const formatReplacesSchedule =
    hasSchedule && !rulesetLocked && savedFormat !== null && form.leagueFormat !== savedFormat

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const confirmed = (e.nativeEvent as SubmitEvent).submitter === confirmRef.current
    if (formatReplacesSchedule && !confirmed) {
      e.preventDefault()
      setReplaceOpen(true)
      return
    }
    setSubmitted(true)
  }

  function confirmReplace() {
    setReplaceOpen(false)
    formRef.current?.requestSubmit(confirmRef.current)
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={onSubmit}
      onChange={markDirty}
      className="space-y-4"
    >
      <BasicFieldsSection
        form={form}
        competition={competition}
        disciplines={disciplines}
        rulesetLocked={rulesetLocked}
      />
      <SeasonFieldsSection form={form} competition={competition} />
      <LeagueFieldsSection
        form={form}
        competition={competition}
        hasSchedule={hasSchedule}
        rulesetLocked={rulesetLocked}
        playoffsStarted={playoffsStarted}
      />
      <EventFieldsSection form={form} competition={competition} />
      <PublishSection form={form} competition={competition} />
      <button ref={confirmRef} type="submit" name="replaceSchedule" value="true" hidden />

      {generalError && <p className="text-sm text-destructive">{generalError}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Speichern…" : "Speichern"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => nav.requestNavigation(() => router.back())}
          disabled={isPending}
        >
          Abbrechen
        </Button>
      </div>

      <DecisionDialog
        decision={leaveUnsaved()}
        open={nav.isConfirmOpen}
        onOpenChange={(o) => !o && nav.cancel()}
        onConfirm={nav.confirm}
      />
      {savedFormat !== null && (
        <DecisionDialog
          decision={leagueFormatChange({
            from: savedFormat,
            to: form.leagueFormat as LeagueFormat,
          })}
          open={replaceOpen}
          onOpenChange={setReplaceOpen}
          onConfirm={confirmReplace}
        />
      )}
    </form>
  )
}
