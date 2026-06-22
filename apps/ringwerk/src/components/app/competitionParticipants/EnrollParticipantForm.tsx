"use client"

import { Label } from "@vereinsheim/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import type { ParticipantOption } from "@/lib/participants/types"
import type { SerializableDiscipline } from "@/lib/disciplines/types"
import type { EventTeamItem } from "@/lib/eventTeams/types"
import type { ActionResult } from "@/lib/types"
import { EnrollMainRow, TeamSelectSection, useEnrollForm } from "./enroll-form"

interface Props {
  competitionId: string
  availableParticipants: ParticipantOption[]
  /** Wenn gesetzt: gemischter Wettbewerb — Disziplinwahl pro Teilnehmer erforderlich */
  disciplines?: SerializableDiscipline[]
  /** Wenn true: Gast-Einschreibung erlaubt (allowGuests auf Event) */
  allowGuests?: boolean
  /** Team-Events: Teamgröße ≥ 2 */
  teamSize?: number | null
  /** Team-Events: bestehende Teams mit ihren Mitgliedern */
  eventTeams?: EventTeamItem[]
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>
}

export function EnrollParticipantForm({
  availableParticipants,
  disciplines,
  allowGuests,
  teamSize,
  eventTeams,
  action,
}: Props) {
  const form = useEnrollForm({ action })
  const { isPending, isGuest, setIsGuest, formKey, formRef } = form

  const isMixed = !!disciplines && disciplines.length > 0
  const isTeamEvent = (teamSize ?? 0) >= 2
  const noRegularParticipants = availableParticipants.length === 0

  // Im Team-Modus können Teilnehmer mehrfach eingeschrieben werden — kein "alle bereits eingeschrieben"
  if (noRegularParticipants && !allowGuests && !isTeamEvent) {
    return (
      <p className="text-sm text-muted-foreground">
        Alle aktiven Teilnehmer sind bereits in diesem Wettbewerb eingeschrieben.
      </p>
    )
  }

  const incompleteTeams = (eventTeams ?? []).filter((t) => t.members.length < (teamSize ?? 0))

  return (
    <form key={formKey} ref={formRef} className="space-y-3">
      {allowGuests && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="isGuest"
            checked={isGuest}
            onCheckedChange={(checked: boolean | "indeterminate") => setIsGuest(checked === true)}
            disabled={isPending}
          />
          <Label htmlFor="isGuest" className="cursor-pointer text-sm">
            Gast-Schütze
          </Label>
          <input type="hidden" name="isGuest" value={isGuest ? "true" : "false"} />
        </div>
      )}

      <EnrollMainRow
        form={form}
        availableParticipants={availableParticipants}
        noRegularParticipants={noRegularParticipants}
        isMixed={isMixed}
        isTeamEvent={isTeamEvent}
        disciplines={disciplines}
      />

      {isTeamEvent && (
        <TeamSelectSection form={form} teamSize={teamSize} incompleteTeams={incompleteTeams} />
      )}
    </form>
  )
}
