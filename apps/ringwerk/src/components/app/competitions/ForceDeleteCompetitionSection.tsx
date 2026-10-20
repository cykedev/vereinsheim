"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import {
  competitionForceDelete,
  CONFIRM_COMPETITION_NAME,
  FORCE_DELETE_SECTION,
} from "@/lib/consequences"
import { forceDeleteCompetition } from "@/lib/competitions/actions"

interface Props {
  competitionId: string
  competitionName: string
  isPublic: boolean
}

// Löschen mit allen Daten, auch dem Protokoll; nur mit dem Namen des Wettbewerbs als Bestätigung (die Action prüft
// ihn noch einmal und lässt nur Admins zu).
export function ForceDeleteCompetitionSection({ competitionId, competitionName, isPublic }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmName, setConfirmName] = useState("")
  const [open, setOpen] = useState(false)

  const nameMatches = confirmName.trim() === competitionName

  function handleDelete() {
    startTransition(async () => {
      const result = await forceDeleteCompetition(competitionId, confirmName)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Löschen.")
      } else {
        router.push("/competitions")
      }
    })
  }

  function onOpenChange(isOpen: boolean) {
    setOpen(isOpen)
    if (!isOpen) setConfirmName("")
  }

  return (
    <div className="rounded-2xl border border-destructive/50 bg-card p-4 sm:p-6">
      <h2 className="mb-2 text-lg font-semibold text-destructive">{FORCE_DELETE_SECTION.title}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{FORCE_DELETE_SECTION.text}</p>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 className="mr-2 h-4 w-4" />
        {FORCE_DELETE_SECTION.button}
      </Button>
      <DecisionDialog
        decision={competitionForceDelete({ name: competitionName, isPublic })}
        open={open}
        onOpenChange={onOpenChange}
        onConfirm={handleDelete}
        confirmDisabled={!nameMatches || isPending}
      >
        <div className="space-y-2">
          <Label htmlFor="confirm-competition-name" className="block leading-normal">
            {CONFIRM_COMPETITION_NAME} <span className="font-semibold">{competitionName}</span>
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
      </DecisionDialog>
    </div>
  )
}
