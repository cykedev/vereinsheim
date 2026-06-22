"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, UserCheck, UserX } from "lucide-react"
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
import { setUserActive } from "@/lib/users/actions"

interface Props {
  userId: string
  userName: string | null
  isActive: boolean
}

export function UserRowActions({ userId, userName, isActive }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleToggleActive() {
    startTransition(async () => {
      const result = await setUserActive(userId, !isActive)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Statuswechsel.")
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
        onClick={() => router.push(`/admin/users/${userId}/edit`)}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      {/* Deaktivieren / Aktivieren */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            title={isActive ? "Deaktivieren" : "Aktivieren"}
            disabled={isPending}
          >
            {isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isActive ? "Nutzer deaktivieren?" : "Nutzer aktivieren?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? `${userName ?? "Dieser Nutzer"} wird deaktiviert und kann sich nicht mehr einloggen.`
                : `${userName ?? "Dieser Nutzer"} wird wieder aktiviert.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive}>
              {isActive ? "Deaktivieren" : "Aktivieren"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
