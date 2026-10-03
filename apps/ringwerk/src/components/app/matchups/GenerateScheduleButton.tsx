"use client"

import { useState, useTransition } from "react"
import { CalendarPlus, RefreshCw } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import { ConfirmDialog } from "@vereinsheim/ui/shell/ConfirmDialog"
import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { toast } from "sonner"
import type { LeagueFormat } from "@/generated/prisma/client"
import { generateCompetitionSchedule } from "@/lib/matchups/actions"
import { scheduleDialogText } from "@/lib/matchups/regeneration"

interface Props {
  competitionId: string
  /** Es gibt schon einen Spielplan → „neu generieren“ (die Seite zeigt den Button nur ohne Ergebnisse) */
  hasSchedule: boolean
  leagueFormat: LeagueFormat
}

export function GenerateScheduleButton({ competitionId, hasSchedule, leagueFormat }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const text = scheduleDialogText({ hasSchedule, leagueFormat })
  const label = hasSchedule ? "Spielplan neu generieren" : "Spielplan generieren"
  const Icon = hasSchedule ? RefreshCw : CalendarPlus

  function handleConfirm() {
    setOpen(false)
    startTransition(async () => {
      const result = await generateCompetitionSchedule(competitionId)
      if ("error" in result) {
        toast.error(getErrorMessage(result, "Fehler bei der Spielplan-Generierung."))
        return
      }
      toast.success(hasSchedule ? "Spielplan neu generiert." : "Spielplan generiert.")
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="px-2 sm:px-3"
        disabled={isPending}
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        <Icon className="h-4 w-4 sm:mr-1.5" />
        <span className="hidden sm:inline">{isPending ? "Generiere…" : label}</span>
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={text.title}
        description={text.description}
        confirmLabel={text.confirmLabel}
        destructive={hasSchedule}
        onConfirm={handleConfirm}
      />
    </>
  )
}
