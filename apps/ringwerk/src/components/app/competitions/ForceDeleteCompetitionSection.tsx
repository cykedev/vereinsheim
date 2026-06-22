"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { forceDeleteCompetition } from "@/lib/competitions/actions"

interface Props {
  competitionId: string
  competitionName: string
}

export function ForceDeleteCompetitionSection({ competitionId, competitionName }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmName, setConfirmName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const nameMatches = confirmName.trim() === competitionName

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await forceDeleteCompetition(competitionId, confirmName)
      if ("error" in result) {
        setError(typeof result.error === "string" ? result.error : "Fehler beim Löschen.")
      } else {
        router.push("/competitions")
      }
    })
  }

  return (
    <div className="rounded-lg border border-destructive/50 p-4 sm:p-6">
      <h2 className="mb-2 text-lg font-semibold text-destructive">Gefahrenzone</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Der Wettbewerb und alle zugehörigen Daten (Teilnehmer-Einschreibungen, Spielplan,
        Ergebnisse, Playoffs, Audit-Einträge) werden unwiderruflich gelöscht.
      </p>
      <AlertDialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen)
          if (!isOpen) {
            setConfirmName("")
            setError(null)
          }
        }}
      >
        <AlertDialogTrigger asChild>
          <Button variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Wettbewerb endgültig löschen
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wettbewerb endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten dieses Wettbewerbs
              werden dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-competition-name">
              Zur Bestätigung den Wettbewerb-Namen eingeben:{" "}
              <span className="font-semibold">{competitionName}</span>
            </Label>
            <Input
              id="confirm-competition-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={competitionName}
              disabled={isPending}
              autoComplete="off"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Abbrechen</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!nameMatches || isPending}
            >
              {isPending ? "Löschen…" : "Endgültig löschen"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
