"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"

import { DecisionDialog } from "@/components/shell/DecisionDialog"
import { consentConfirm, consentReject, consentRemove, notMineLift } from "@/lib/admin/consequences"
import { confirmConsent, liftNotMine, rejectConsent, removeConsent } from "@/lib/consent/actions"
import type { AdminConsentRow } from "@/lib/consent/queries"
import { isOpenConsent } from "@/lib/consent/status"
import type { ActionResult } from "@/lib/types"

import { AdminHelp } from "./AdminHelp"

/**
 * Zustimmungen per Sportpass an einem Konto (SP-1.7 a, D5): Der Schütze stimmt im Profil zu, hier bestätigt oder lehnt
 * ein Admin ab. Nur bestätigte bringen Scheiben von der Brücke ([[spiegel-privacy]]); eintragen kann nur der Schütze.
 */
export function SportpassSection({
  consents,
  who,
  accountActive,
}: {
  consents: AdminConsentRow[]
  who: string
  /** ein deaktiviertes Konto bekommt nichts, auch mit bestätigter Zustimmung (Review) */
  accountActive: boolean
}) {
  return (
    <section
      data-admin-sportpass
      className="grid max-w-lg gap-4 rounded-2xl border border-border bg-card p-5"
    >
      <div className="grid gap-1">
        <h2 className="flex items-center gap-1 text-[15px] font-semibold">
          Sportpassnummern <AdminHelp id="consent" />
        </h2>
        <p className="text-sm text-foreground-2">
          Prüf in der Meyton-Schützenverwaltung, ob die Nummer zu dieser Person gehört. Eintragen
          kann nur der Schütze selbst, in der App im Profil.
        </p>
      </div>
      {consents.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {consents.map((consent) => (
            <ConsentItem
              key={consent.id}
              consent={consent}
              who={who}
              accountActive={accountActive}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground-2">Keine Zustimmung an diesem Konto.</p>
      )}
    </section>
  )
}

type DialogKind = "confirm" | "reject" | "remove" | "lift"

function ConsentItem({
  consent,
  who,
  accountActive,
}: {
  consent: AdminConsentRow
  who: string
  accountActive: boolean
}) {
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
    confirm: {
      decision: consentConfirm({
        ...subject,
        returned: consent.status === "returned",
        accountActive,
        historyOpen: !consent.historyLoaded,
        notMine: consent.notMine,
      }),
      action: confirmConsent,
    },
    reject: { decision: consentReject(subject), action: rejectConsent },
    remove: { decision: consentRemove(subject), action: removeConsent },
    // Meldungen „nicht meine“ aufheben (P2d, D8)
    lift: {
      decision: notMineLift({
        ...subject,
        cards: consent.notMine,
        consentActive: consent.status === "active",
      }),
      action: liftNotMine,
    },
  }

  return (
    <li data-consent={consent.status} className="grid gap-2 px-3 py-2">
      <span className="grid">
        <span className="font-mono tabular-nums">{consent.sportpassId}</span>
        <span className="text-[13px] text-muted-foreground">
          {consent.statusText} · eingetragen am {consent.consentedAt} · Hinweistext{" "}
          {consent.consentVersion}
        </span>
        {consent.history && (
          <span className="text-[13px] text-muted-foreground">{consent.history}</span>
        )}
        {consent.notMine > 0 && (
          <span data-consent-not-mine className="text-[13px] text-muted-foreground">
            {consent.notMine === 1 ? "1 Scheibe" : `${consent.notMine} Scheiben`} als „nicht meine“
            zurückgewiesen
          </span>
        )}
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
              Nummer bestätigen
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
        {/* eine abgelehnte Zustimmung lässt sich nicht wieder bestätigen: Aufheben brächte dort nichts (Review) */}
        {consent.notMine > 0 && consent.status !== "rejected" && (
          <Button
            type="button"
            variant="ghost"
            className="h-10"
            disabled={pending}
            onClick={() => ask("lift")}
          >
            Wieder zulassen
          </Button>
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
