"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"

import { DecisionDialog } from "@/components/shell/DecisionDialog"
import { ownConsentRevoke, ownRejectionRemove } from "@/lib/admin/consequences"
import { revokeSportpass } from "@/lib/consent/actions"
import type { ConsentRow } from "@/lib/consent/queries"
import { MAX_CONSENTS_PER_ACCOUNT, onlyRemovable, ownerActionOf } from "@/lib/consent/status"
import { consentTextOf } from "@/lib/consent/texts"

import { ConsentForm } from "./ConsentForm"

/**
 * Sportpass im Profil: je SportpassID der Status in Worten und Widerrufen (bzw. Entfernen einer Ablehnung). Ohne
 * Nummer die Zustimmung; mit einer der Weg für einen neuen Ausweis (eine Nummer je Konto).
 */
export function SportpassConsents({
  consents,
  version,
}: {
  consents: ConsentRow[]
  /** die Version des Hinweistexts, der gezeigt und zugestimmt wird */
  version: string
}) {
  const text = consentTextOf(version)
  return (
    <div data-sportpass className="grid gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="grid gap-1">
        <h2 className="text-[15px] font-semibold">Sportpass</h2>
        <p className="text-sm text-foreground-2">
          Trag deine Sportpassnummer ein und stimme zu. Sobald ein Admin die Nummer geprüft hat,
          kommen deine Scheiben von selbst in Spiegel.
        </p>
      </div>
      {consents.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {consents.map((consent) => (
            <ConsentItem key={consent.id} consent={consent} />
          ))}
        </ul>
      )}
      {consents.length < MAX_CONSENTS_PER_ACCOUNT && text && (
        <ConsentForm version={version} text={text} />
      )}
      {consents.length >= MAX_CONSENTS_PER_ACCOUNT && (
        <p data-one-number className="text-[13px] text-muted-foreground">
          {/* eine abgelehnte heißt am Knopf „Entfernen“, nicht „Widerrufen“ */}
          {onlyRemovable(consents.map((consent) => consent.status))
            ? "Ein Konto hat eine Sportpassnummer. Für eine andere Nummer entferne die abgelehnte. Dann trag die neue ein."
            : "Ein Konto hat eine Sportpassnummer. Für einen neuen Ausweis widerrufe die alte Nummer. Dann trag die neue ein. Deine Scheiben bleiben."}
        </p>
      )}
    </div>
  )
}

function ConsentItem({ consent }: { consent: ConsentRow }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const revoke = ownerActionOf(consent.status) === "revoke"
  const label = revoke ? "Widerrufen" : "Entfernen"

  return (
    <li data-consent={consent.status} className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="grid min-w-0">
        <span className="font-mono tabular-nums">{consent.sportpassId}</span>
        <span className="text-[13px] text-muted-foreground">{consent.statusText}</span>
        {consent.history && (
          <span data-consent-history className="text-[13px] text-muted-foreground">
            {consent.history}
          </span>
        )}
        {error && (
          <span role="alert" className="text-[13px] text-destructive">
            {error}
          </span>
        )}
      </span>
      <Button
        type="button"
        variant="ghost"
        className="h-10 shrink-0 text-destructive"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <DecisionDialog
        decision={
          revoke
            ? ownConsentRevoke({
                sportpassId: consent.sportpassId,
                status: consent.status === "rejected" ? "active" : consent.status,
              })
            : ownRejectionRemove()
        }
        open={open}
        onOpenChange={setOpen}
        onConfirm={() =>
          startTransition(async () => {
            const result = await revokeSportpass(consent.id)
            if ("error" in result) setError(getErrorMessage(result) ?? null)
            else router.refresh()
          })
        }
      />
    </li>
  )
}
