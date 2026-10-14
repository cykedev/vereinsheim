"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"
import { ConfirmDialog } from "@vereinsheim/ui/shell/ConfirmDialog"

import { confirmConsent, rejectConsent, removeConsent } from "@/lib/consent/actions"
import type { ConsentRow } from "@/lib/consent/queries"
import { isOpenConsent } from "@/lib/consent/status"
import type { ActionResult } from "@/lib/types"

/**
 * Zustimmungen per Sportpass an einem Konto (SP-1.7 a, D5): Der Schütze stimmt im Profil zu, hier bestätigt oder lehnt
 * ein Admin ab. Nur bestätigte bringen Scheiben von der Brücke ([[spiegel-privacy]]); eintragen kann nur der Schütze.
 */
export function SportpassSection({ consents }: { consents: ConsentRow[] }) {
  return (
    <section
      data-admin-sportpass
      className="grid max-w-lg gap-4 rounded-2xl border border-border bg-card p-5"
    >
      <div className="grid gap-1">
        <h2 className="text-[15px] font-semibold">Zustimmungen per Sportpass</h2>
        <p className="text-sm text-foreground-2">
          Bestätige nur, wenn die Nummer in der Meyton-Schützenverwaltung zu dieser Person gehört.
          Eintragen kann nur der Schütze selbst, im Profil.
        </p>
      </div>
      {consents.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {consents.map((consent) => (
            <ConsentItem key={consent.id} consent={consent} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground-2">Keine Zustimmung an diesem Konto.</p>
      )}
    </section>
  )
}

type Pending = "reject" | "remove" | null

function ConsentItem({ consent }: { consent: ConsentRow }) {
  const router = useRouter()
  const [dialog, setDialog] = useState<Pending>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (action: (id: number) => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await action(consent.id)
      if ("error" in result) setError(getErrorMessage(result) ?? null)
      else {
        setError(null)
        router.refresh()
      }
    })
  const open = isOpenConsent(consent.status)

  return (
    <li data-consent={consent.status} className="grid gap-2 px-3 py-2">
      <span className="grid">
        <span className="font-mono tabular-nums">{consent.sportpassId}</span>
        <span className="text-[13px] text-muted-foreground">
          {consent.siteName} · {consent.statusText} · zugestimmt {consent.consentedAt} (Hinweis{" "}
          {consent.consentVersion})
        </span>
        {error && (
          <span role="alert" className="text-[13px] text-destructive">
            {error}
          </span>
        )}
      </span>
      <span className="flex flex-wrap gap-2">
        {open && (
          <>
            <Button
              type="button"
              className="h-10"
              disabled={pending}
              onClick={() => run(confirmConsent)}
            >
              Bestätigen
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 text-destructive"
              disabled={pending}
              onClick={() => setDialog("reject")}
            >
              Ablehnen
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          className="h-10 text-destructive"
          disabled={pending}
          onClick={() => setDialog("remove")}
        >
          Entfernen
        </Button>
      </span>
      <ConfirmDialog
        open={dialog !== null}
        onOpenChange={(next) => !next && setDialog(null)}
        title={
          dialog === "reject"
            ? `SportpassID ${consent.sportpassId} ablehnen?`
            : `SportpassID ${consent.sportpassId} entfernen?`
        }
        description={
          dialog === "reject"
            ? "Der Schütze sieht „abgelehnt“ und kann die Ablehnung entfernen und neu zustimmen."
            : "Die Zustimmung verschwindet; ab dem nächsten Abgleich lädt die Brücke nichts mehr. Hochgeladene Scheiben bleiben beim Schützen."
        }
        confirmLabel={dialog === "reject" ? "Ablehnen" : "Entfernen"}
        destructive
        onConfirm={() => run(dialog === "reject" ? rejectConsent : removeConsent)}
      />
    </li>
  )
}
