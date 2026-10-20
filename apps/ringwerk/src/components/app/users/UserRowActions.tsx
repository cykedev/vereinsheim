"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, UserCheck, UserX } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { toast } from "sonner"
import { accountActivate, accountDeactivate } from "@/lib/consequences"
import { setUserActive } from "@/lib/users/actions"

interface Props {
  userId: string
  userName: string | null
  email: string
  isActive: boolean
}

export function UserRowActions({ userId, userName, email, isActive }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  function handleToggleActive() {
    startTransition(async () => {
      const result = await setUserActive(userId, !isActive)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Statuswechsel.")
      } else {
        toast.success(isActive ? "Konto deaktiviert." : "Konto aktiviert.")
      }
    })
  }

  return (
    <div className="flex items-center gap-1">
      {/* Bearbeiten */}
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        title="Bearbeiten"
        aria-label="Bearbeiten"
        onClick={() => router.push(`/admin/users/${userId}/edit`)}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      {/* Deaktivieren / Aktivieren */}
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        title={isActive ? "Deaktivieren" : "Aktivieren"}
        aria-label={isActive ? "Deaktivieren" : "Aktivieren"}
        disabled={isPending}
        onClick={() => setOpen(true)}
      >
        {isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
      </Button>
      <DecisionDialog
        decision={
          isActive
            ? accountDeactivate({ name: userName, email })
            : accountActivate({ name: userName, email })
        }
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleToggleActive}
      />
    </div>
  )
}
