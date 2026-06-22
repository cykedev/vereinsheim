"use client"

import { useTransition } from "react"
import { ArrowRight } from "lucide-react"
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
import { advanceRound } from "@/lib/playoffs/actions"

interface Props {
  competitionId: string
  label: string
}

export function AdvanceRoundButton({ competitionId, label }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleAdvance() {
    startTransition(async () => {
      const result = await advanceRound(competitionId)
      if ("error" in result) {
        toast.error(
          typeof result.error === "string" ? result.error : "Fehler beim Anlegen der Runde."
        )
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={isPending} size="sm">
          <ArrowRight className="mr-2 h-4 w-4" />
          {isPending ? "Anlegen…" : label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label} anlegen?</AlertDialogTitle>
          <AlertDialogDescription>
            Die nächste Runde wird basierend auf den aktuellen Ergebnissen angelegt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={handleAdvance}>{label} anlegen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
