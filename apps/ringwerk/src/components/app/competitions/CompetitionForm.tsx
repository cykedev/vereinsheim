"use client"

import { Button } from "@vereinsheim/ui/button"
import type { SerializableDiscipline } from "@/lib/disciplines/types"
import type { CompetitionDetail } from "@/lib/competitions/types"
import type { ActionResult } from "@/lib/types"
import { ConfirmDialog } from "@vereinsheim/ui/shell/ConfirmDialog"
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
  /** Gruppenphase/Format sperren, sobald Paarungen existieren. */
  hasMatchups?: boolean
  /** Playoff-/Finale-Einstellungen sperren, sobald die Playoffs gestartet sind. */
  playoffsStarted?: boolean
}

export function CompetitionForm({
  competition,
  disciplines,
  action,
  hasMatchups = false,
  playoffsStarted = false,
}: Props) {
  const form = useCompetitionFormState({ competition, action })
  const { router, formAction, isPending, markDirty, setSubmitted, nav, generalError } = form

  return (
    <form
      action={formAction}
      onSubmit={() => setSubmitted(true)}
      onChange={markDirty}
      className="space-y-4"
    >
      <BasicFieldsSection
        form={form}
        competition={competition}
        disciplines={disciplines}
        hasMatchups={hasMatchups}
      />
      <SeasonFieldsSection form={form} competition={competition} />
      <LeagueFieldsSection
        form={form}
        competition={competition}
        hasMatchups={hasMatchups}
        playoffsStarted={playoffsStarted}
      />
      <EventFieldsSection form={form} competition={competition} />
      <PublishSection form={form} competition={competition} />

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

      <ConfirmDialog
        open={nav.isConfirmOpen}
        onOpenChange={(o) => !o && nav.cancel()}
        title="Ungespeicherte Änderungen verwerfen?"
        description="Es gibt nicht gespeicherte Änderungen. Beim Verlassen gehen sie verloren."
        confirmLabel="Verwerfen"
        destructive
        onConfirm={nav.confirm}
      />
    </form>
  )
}
