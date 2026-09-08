"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import type { AdminLoginRateLimitBucket } from "@vereinsheim/lib/auth/rate-limit/adminTypes"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent } from "../ui/card"
import {
  LoginRateLimitBucketTable,
  bucketTypeBadgeClass,
  formatBucketDate,
} from "./LoginRateLimitBucketTable"

interface Props {
  buckets: AdminLoginRateLimitBucket[]
  displayTimeZone: string
  /**
   * Entsperren. Die Server Action bleibt in der App (geteilte Dateien dürfen
   * keine Server-Action-Re-Exports sein) — die App übergibt sie als Callback
   * und normalisiert das Ergebnis auf `{ error? }`.
   */
  onClear: (bucketKey: string) => Promise<{ error?: string }>
}

// Aktive Login-Sperren mit Entsperr-Aktion. Mobil als Karten, ab md als Tabelle.
export function LoginRateLimitTable({ buckets, displayTimeZone, onClear }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [clearCandidate, setClearCandidate] = useState<AdminLoginRateLimitBucket | null>(null)

  function performClear(bucketKey: string): void {
    setMessage(null)
    startTransition(async () => {
      const result = await onClear(bucketKey)
      if (result.error) {
        setMessage(result.error)
        return
      }
      router.refresh()
    })
  }

  if (buckets.length === 0) {
    return <p className="text-sm text-muted-foreground">Aktuell sind keine Login-Sperren aktiv.</p>
  }

  function clearButton(bucket: AdminLoginRateLimitBucket) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        // Kandidat zuerst puffern, damit wirklich der angezeigte Bucket bestätigt wird.
        onClick={() => setClearCandidate(bucket)}
      >
        Entsperren
      </Button>
    )
  }

  return (
    <div className="space-y-3">
      {message && <p className="text-sm text-destructive">{message}</p>}

      <div className="space-y-2 md:hidden">
        {buckets.map((bucket) => (
          <Card key={bucket.key}>
            <CardContent className="space-y-3 py-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={bucketTypeBadgeClass(bucket.type)}>
                    {bucket.type}
                  </Badge>
                  <p className="text-xs text-muted-foreground">Fehlversuche: {bucket.attempts}</p>
                </div>
                <p className="text-sm break-all">{bucket.identifier}</p>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Fenster seit: {formatBucketDate(bucket.windowStartedAt, displayTimeZone)}</p>
                <p>Letzter Versuch: {formatBucketDate(bucket.lastAttemptAt, displayTimeZone)}</p>
                <p>Blockiert bis: {formatBucketDate(bucket.blockedUntil, displayTimeZone)}</p>
              </div>

              {clearButton(bucket)}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden md:block">
        <LoginRateLimitBucketTable
          buckets={buckets}
          displayTimeZone={displayTimeZone}
          emptyText="Aktuell sind keine Login-Sperren aktiv."
          renderAction={clearButton}
        />
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
                // Schlüssel vor dem Schließen sichern, damit asynchroner Refresh
                // keinen Null-Zugriff erzeugt.
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
