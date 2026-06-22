"use client"

import type { CompetitionParticipantListItem } from "@/lib/competitionParticipants/types"
import type { SerializableDiscipline } from "@/lib/disciplines/types"
import {
  DisciplineEditDialog,
  RevokeWithdrawalAction,
  UnenrollAction,
  useParticipantActions,
  WithdrawDialog,
} from "./participant-actions"

interface Props {
  entry: CompetitionParticipantListItem
  playoffsStarted: boolean
  /** Übergeben bei gemischten Wettbewerben — ermöglicht Disziplin-Edit */
  disciplines?: SerializableDiscipline[]
}

export function CompetitionParticipantActions({ entry, playoffsStarted, disciplines }: Props) {
  const actions = useParticipantActions(entry)

  const fullName = entry.isGuest
    ? entry.participant.firstName
    : `${entry.participant.lastName}, ${entry.participant.firstName}`

  // Disziplin-Edit möglich wenn: gemischter WB, aktiv, keine Serien, kein Gast
  const canEditDiscipline =
    disciplines &&
    disciplines.length > 0 &&
    !entry.isGuest &&
    entry.status === "ACTIVE" &&
    entry.seriesCount === 0

  if (playoffsStarted) return null

  return (
    <div className="flex items-center gap-1">
      {canEditDiscipline && (
        <DisciplineEditDialog
          actions={actions}
          fullName={fullName}
          disciplines={disciplines}
          currentDisciplineId={entry.disciplineId}
        />
      )}

      {entry.status === "ACTIVE" && <WithdrawDialog actions={actions} fullName={fullName} />}

      {entry.status === "WITHDRAWN" && (
        <RevokeWithdrawalAction
          fullName={fullName}
          isPending={actions.isPending}
          onConfirm={actions.handleRevokeWithdrawal}
        />
      )}

      <UnenrollAction
        fullName={fullName}
        isPending={actions.isPending}
        onConfirm={actions.handleUnenroll}
      />
    </div>
  )
}
