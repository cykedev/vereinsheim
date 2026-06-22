"use client"

import { useTransition } from "react"
import { Trophy } from "lucide-react"
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
import { startPlayoffs } from "@/lib/playoffs/actions"

interface Props {
  competitionId: string
  disabled?: boolean
  disabledReason?: string
}

export function StartPlayoffsButton({ competitionId, disabled, disabledReason }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await startPlayoffs(competitionId)
      if ("error" in result) {
        toast.error(
          typeof result.error === "string" ? result.error : "Fehler beim Starten der Playoffs."
        )
      }
    })
  }

  return (
    <div className="space-y-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={isPending || disabled}>
            <Trophy className="mr-2 h-4 w-4" />
            {isPending ? "Starte…" : "Playoffs starten"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Playoffs starten?</AlertDialogTitle>
            <AlertDialogDescription>
              Die K.O.-Phase wird basierend auf der aktuellen Tabelle gestartet. Dieser Schritt kann
              nicht rückgängig gemacht werden. Rückzüge von Teilnehmern sind danach nicht mehr
              möglich.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Playoffs starten</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {disabled && disabledReason && (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      )}
    </div>
  )
}
