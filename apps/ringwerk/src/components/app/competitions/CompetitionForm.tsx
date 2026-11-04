"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { flushSync } from "react-dom"
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
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [replaceConfirmed, setReplaceConfirmed] = useState(false)

  // Ein anderes Format bei bestehendem Spielplan ersetzt ihn: erst fragen, dann speichern.
  const savedFormat = competition?.type === "LEAGUE" ? competition.leagueFormat : null
  const formatReplacesSchedule =
    hasSchedule && !rulesetLocked && savedFormat !== null && form.leagueFormat !== savedFormat

  // Die Bestätigung gilt nur für dieses eine Absenden: Ein Fehler oder ein anderes Format fragt wieder.
  useEffect(() => {
    if (!isPending) setReplaceConfirmed(false) // eslint-disable-line react-hooks/set-state-in-effect
  }, [isPending, form.leagueFormat])

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    if (formatReplacesSchedule && !replaceConfirmed) {
      e.preventDefault()
      setReplaceOpen(true)
      return
    }
    setSubmitted(true)
  }

  function confirmReplace() {
    // Das versteckte Feld muss im DOM stehen, bevor das Formular abschickt.
    flushSync(() => {
      setReplaceConfirmed(true)
      setReplaceOpen(false)
    })
    formRef.current?.requestSubmit()
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
      <input type="hidden" name="replaceSchedule" value={replaceConfirmed ? "true" : ""} />

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
