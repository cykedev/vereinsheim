"use client"

import { useTransition } from "react"
import { CalendarPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { generateCompetitionSchedule } from "@/lib/matchups/actions"

interface Props {
  competitionId: string
  hasSchedule: boolean
}

export function GenerateScheduleButton({ competitionId, hasSchedule }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await generateCompetitionSchedule(competitionId)
      if ("error" in result) {
        toast.error(
          typeof result.error === "string" ? result.error : "Fehler bei der Spielplan-Generierung."
        )
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={isPending} title="Spielplan generieren">
          <CalendarPlus className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">
            {isPending ? "Generiere…" : "Spielplan generieren"}
          </span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Spielplan generieren?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasSchedule
              ? "Es existiert bereits ein Spielplan. Alle offenen Paarungen werden gelöscht und neu generiert. Bereits abgeschlossene Paarungen bleiben erhalten (Abbruch wenn vorhanden)."
              : "Es wird ein Doppelrunden-Spielplan (Hin- und Rückrunde) für alle aktiven Teilnehmer generiert."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Generieren</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
