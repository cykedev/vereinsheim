"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Pencil, Target, Trash2 } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import { DetailActionBar } from "@vereinsheim/ui/shell/DetailActionBar"
import { DecisionDialog, type Decision } from "@vereinsheim/ui/design2/decision-dialog"

interface Props {
  pending: boolean
  backHref?: string
  onEditGoal: () => void
  onEditAssignments: () => void
  onDelete: () => void
  /** die Folgen in Worten (`goalDelete`) */
  deleteDecision: Decision
}

/** Zurück zur Liste der Ziele */
export function GoalBackButton({ href }: { href: string }) {
  return (
    <Button variant="ghost" size="sm" className="px-2 sm:px-3" asChild>
      <Link href={href} aria-label="Zurück zu Zielen">
        <ArrowLeft className="h-4 w-4 sm:mr-1.5" />
        <span className="hidden sm:inline">Zurück</span>
      </Link>
    </Button>
  )
}

/** die Leiste eines Ziels für ein Konto, das nach Spiegel umgezogen ist: nur Zurück */
export function GoalReadOnlyActions({ backHref }: { backHref?: string }) {
  return (
    <div className="flex items-start justify-end">
      <DetailActionBar>{backHref && <GoalBackButton href={backHref} />}</DetailActionBar>
    </div>
  )
}

// Aktionsleiste bündelt Bearbeiten/Zuweisen/Löschen, damit Card-Header aufgeräumt bleibt.
export function GoalActions({
  pending,
  backHref,
  onEditGoal,
  onEditAssignments,
  onDelete,
  deleteDecision,
}: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-start justify-end">
      {/* Mobile bekommt dieselben Aktionen als Icon/kurze Labels, damit nichts aus dem Header herausbricht. */}
      <DetailActionBar>
        <Button
          size="icon"
          variant="ghost"
          onClick={onEditGoal}
          disabled={pending}
          className="size-9"
          aria-label="Ziel bearbeiten"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onEditAssignments}
          disabled={pending}
          className="px-2 sm:px-3"
          aria-label="Einheiten zuweisen"
        >
          <Target className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Zuweisen</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="px-2 text-destructive hover:text-destructive sm:px-3"
          disabled={pending}
          aria-label="Ziel löschen"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Löschen</span>
        </Button>
        <DecisionDialog
          decision={deleteDecision}
          open={open}
          onOpenChange={setOpen}
          onConfirm={onDelete}
        />
        {backHref && <GoalBackButton href={backHref} />}
      </DetailActionBar>
    </div>
  )
}
