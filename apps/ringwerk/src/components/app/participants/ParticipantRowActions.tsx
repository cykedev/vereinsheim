"use client"

import {
  ParticipantDeleteDialog,
  ParticipantEditDialog,
  ToggleActiveAction,
  useParticipantRowActions,
} from "./row-actions"

interface Props {
  participantId: string
  firstName: string
  lastName: string
  contact: string | null
  isActive: boolean
  isAdmin: boolean
  competitionsCount: number
}

export function ParticipantRowActions({
  participantId,
  firstName,
  lastName,
  contact,
  isActive,
  isAdmin,
  competitionsCount,
}: Props) {
  const actions = useParticipantRowActions(participantId, isActive)

  return (
    <div className="flex items-center gap-1">
      <ParticipantEditDialog
        participantId={participantId}
        firstName={firstName}
        lastName={lastName}
        contact={contact}
        open={actions.editOpen}
        onOpenChange={actions.setEditOpen}
      />

      <ToggleActiveAction
        firstName={firstName}
        lastName={lastName}
        isActive={isActive}
        isPending={actions.isPending}
        onConfirm={actions.handleToggleActive}
      />

      {/* Löschen — nur für inaktive Teilnehmer */}
      {!isActive && (
        <ParticipantDeleteDialog
          actions={actions}
          firstName={firstName}
          lastName={lastName}
          isAdmin={isAdmin}
          competitionsCount={competitionsCount}
        />
      )}
    </div>
  )
}
