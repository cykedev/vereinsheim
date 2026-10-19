"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { setUserActive, type AdminUserListItem } from "@/lib/admin/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@vereinsheim/ui/alert-dialog"
import { AdminUsersTableDesktop, AdminUsersTableMobile } from "@/components/app/admin/users-table"
import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import {
  confirmedDeactivation,
  requestActiveChange,
} from "@/components/app/admin/users-table/activeChange"

interface Props {
  users: AdminUserListItem[]
  currentAdminId: string
  displayTimeZone: string
}

export function AdminUsersTable({ users, currentAdminId, displayTimeZone }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [deactivationCandidate, setDeactivationCandidate] = useState<AdminUserListItem | null>(null)

  function performSetActive(userId: string, nextIsActive: boolean): void {
    setMessage(null)
    startTransition(async () => {
      const result = await setUserActive(userId, nextIsActive)
      const error = getErrorMessage(result)
      if (error) {
        setMessage(error)
        return
      }

      router.refresh()
    })
  }

  function handleSetActive(user: AdminUserListItem, nextIsActive: boolean) {
    const change = requestActiveChange(user, nextIsActive)
    if (change.kind === "confirm") setDeactivationCandidate(change.user)
    else performSetActive(change.userId, change.isActive)
  }

  return (
    <div className="space-y-3">
      {message && <p className="text-sm text-destructive">{message}</p>}

      <AdminUsersTableMobile
        users={users}
        currentAdminId={currentAdminId}
        displayTimeZone={displayTimeZone}
        pending={pending}
        onToggleActive={handleSetActive}
      />

      <AdminUsersTableDesktop
        users={users}
        currentAdminId={currentAdminId}
        displayTimeZone={displayTimeZone}
        pending={pending}
        onToggleActive={handleSetActive}
      />

      <p className="text-xs text-muted-foreground">
        Der eigene aktive Admin-Account kann nicht deaktiviert werden.
      </p>

      <AlertDialog
        open={deactivationCandidate !== null}
        onOpenChange={(open) => !open && setDeactivationCandidate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nutzer deaktivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivationCandidate
                ? `Der Account "${deactivationCandidate.name ? `${deactivationCandidate.name} <${deactivationCandidate.email}>` : deactivationCandidate.email}" kann sich danach nicht mehr anmelden.`
                : "Der Account kann sich danach nicht mehr anmelden."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={pending}
              onClick={() => {
                const change = confirmedDeactivation(deactivationCandidate)
                if (!change) return
                setDeactivationCandidate(null)
                performSetActive(change.userId, change.isActive)
              }}
            >
              Deaktivieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
