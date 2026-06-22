"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LockOpen } from "lucide-react"
import type { AdminLoginRateLimitBucket } from "@/lib/admin/types"
import { clearLoginRateLimitBucket } from "@/lib/admin/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface Props {
  buckets: AdminLoginRateLimitBucket[]
}

function formatTime(date: Date | null): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Zurich",
  }).format(new Date(date))
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("de-CH").format(value)
}

function getTypeBadgeClass(type: AdminLoginRateLimitBucket["type"]): string {
  if (type === "IP") {
    return "border-amber-800 bg-amber-950 text-amber-300"
  }
  return "border-sky-800 bg-sky-950 text-sky-300"
}

export function AdminLoginRateLimitTable({ buckets }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [clearCandidate, setClearCandidate] = useState<AdminLoginRateLimitBucket | null>(null)

  function performClear(bucketKey: string): void {
    setMessage(null)
    startTransition(async () => {
      const result = await clearLoginRateLimitBucket(bucketKey)
      if ("error" in result) {
        setMessage(typeof result.error === "string" ? result.error : "Fehler beim Entsperren.")
        return
      }
      router.refresh()
    })
  }

  if (buckets.length === 0) {
    return <p className="text-sm text-muted-foreground">Aktuell sind keine Login-Sperren aktiv.</p>
  }

  return (
    <div className="space-y-3">
      {message && <p className="text-sm text-destructive">{message}</p>}

      {/* Mobile: Card-Layout */}
      <div className="space-y-2 md:hidden">
        {buckets.map((bucket) => (
          <Card key={bucket.key}>
            <CardContent className="py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getTypeBadgeClass(bucket.type)}>
                      {bucket.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatCount(bucket.attempts)} Versuche
                    </span>
                  </div>
                  <p className="break-all text-sm">{bucket.identifier}</p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-destructive/70 hover:text-destructive"
                  disabled={pending}
                  onClick={() => setClearCandidate(bucket)}
                  title="Entsperren"
                >
                  <LockOpen className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                <div>
                  <p className="font-medium">Seit</p>
                  <p className="tabular-nums">{formatTime(bucket.windowStartedAt)}</p>
                </div>
                <div>
                  <p className="font-medium">Letzter</p>
                  <p className="tabular-nums">{formatTime(bucket.lastAttemptAt)}</p>
                </div>
                <div>
                  <p className="font-medium">Bis</p>
                  <p className="tabular-nums">{formatTime(bucket.blockedUntil)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: Tabelle */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Typ</th>
              <th className="pb-2 pr-4 font-medium">Identifikator</th>
              <th className="pb-2 pr-4 font-medium">Versuche</th>
              <th className="pb-2 pr-4 font-medium">Seit</th>
              <th className="pb-2 pr-4 font-medium">Letzter</th>
              <th className="pb-2 pr-4 font-medium">Bis</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {buckets.map((bucket) => (
              <tr key={bucket.key}>
                <td className="py-2 pr-4">
                  <Badge variant="outline" className={getTypeBadgeClass(bucket.type)}>
                    {bucket.type}
                  </Badge>
                </td>
                <td className="max-w-[260px] py-2 pr-4">
                  <p className="break-all">{bucket.identifier}</p>
                </td>
                <td className="py-2 pr-4">
                  <span className="tabular-nums">{formatCount(bucket.attempts)}</span>
                </td>
                <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                  {formatTime(bucket.windowStartedAt)}
                </td>
                <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                  {formatTime(bucket.lastAttemptAt)}
                </td>
                <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                  {formatTime(bucket.blockedUntil)}
                </td>
                <td className="py-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive/70 hover:text-destructive"
                    disabled={pending}
                    onClick={() => setClearCandidate(bucket)}
                    title="Entsperren"
                  >
                    <LockOpen className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog
        open={clearCandidate !== null}
        onOpenChange={(open) => !open && setClearCandidate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Login-Sperre entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              {clearCandidate
                ? `Der Bucket ${clearCandidate.type} (${clearCandidate.identifier}) wird sofort entfernt.`
                : "Der Bucket wird sofort entfernt."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                if (!clearCandidate) return
                // Schlüssel vor dem Schließen sichern, damit asynchroner Refresh keinen Null-Zugriff erzeugt.
                const key = clearCandidate.key
                setClearCandidate(null)
                performClear(key)
              }}
            >
              Entsperren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
