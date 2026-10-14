"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"

import { DecisionDialog } from "@/components/shell/DecisionDialog"
import { consentConfirm, consentReject, consentRemove } from "@/lib/admin/consequences"
import { confirmConsent, rejectConsent, removeConsent } from "@/lib/consent/actions"
import type { ConsentRow } from "@/lib/consent/queries"
import { isOpenConsent } from "@/lib/consent/status"
import type { ActionResult } from "@/lib/types"

import { AdminHelp } from "./AdminHelp"

/**
 * Zustimmungen per Sportpass an einem Konto (SP-1.7 a, D5): Der Schütze stimmt im Profil zu, hier bestätigt oder lehnt
 * ein Admin ab. Nur bestätigte bringen Scheiben von der Brücke ([[spiegel-privacy]]); eintragen kann nur der Schütze.
 */
export function SportpassSection({ consents, who }: { consents: ConsentRow[]; who: string }) {
  return (
    <section
      data-admin-sportpass
      className="grid max-w-lg gap-4 rounded-2xl border border-border bg-card p-5"
    >
      <div className="grid gap-1">
        <h2 className="flex items-center gap-1 text-[15px] font-semibold">
          Zustimmungen per Sportpass <AdminHelp id="consent" />
        </h2>
        <p className="text-sm text-foreground-2">
          Bestätige nur, wenn die Nummer in der Meyton-Schützenverwaltung zu dieser Person gehört.
          Eintragen kann nur der Schütze selbst, im Profil.
        </p>
      </div>
      {consents.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {consents.map((consent) => (
            <ConsentItem key={consent.id} consent={consent} who={who} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground-2">Keine Zustimmung an diesem Konto.</p>
      )}
    </section>
  )
}

type DialogKind = "confirm" | "reject" | "remove"

function ConsentItem({ consent, who }: { consent: ConsentRow; who: string }) {
  const router = useRouter()
  // die Art bleibt beim Schließen stehen, damit der Dialog nicht beim Ausblenden den anderen Titel zeigt (Review)
  const [dialog, setDialog] = useState<DialogKind>("remove")
  const [open, setOpen] = useState(false)
  const ask = (kind: DialogKind) => {
    setDialog(kind)
    setOpen(true)
  }
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
  const undecided = isOpenConsent(consent.status)
  const subject = { who, sportpassId: consent.sportpassId }
  // Kein Knopf ohne Folge (P2c): jede Entscheidung fragt mit ihren Folgen
  const decisions = {
    confirm: { decision: consentConfirm(subject), action: confirmConsent },
    reject: {
      decision: consentReject({ ...subject, active: consent.status === "active" }),
      action: rejectConsent,
    },
    remove: { decision: consentRemove(subject), action: removeConsent },
  }

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
        {undecided && (
          <>
            <Button
              type="button"
              className="h-10"
              disabled={pending}
              onClick={() => ask("confirm")}
            >
              Bestätigen
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 text-destructive"
              disabled={pending}
              onClick={() => ask("reject")}
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
          onClick={() => ask("remove")}
        >
          Entfernen
        </Button>
      </span>
      <DecisionDialog
        decision={decisions[dialog].decision}
        open={open}
        onOpenChange={setOpen}
        onConfirm={() => run(decisions[dialog].action)}
      />
    </li>
  )
}
