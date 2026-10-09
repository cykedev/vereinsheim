"use client"

import { cn } from "@vereinsheim/lib/utils"

import { formatSigned, formatValue } from "../format"
import { RouteLink } from "../nav/RouteLink"
import { verdictText } from "../period/sentence"
import type { StartForm } from "./model"

/** das Urteil gegen die 90 Tage davor als Satzteil (U5, D4), mit den Worten von `verdictText` */
function formSentence(form: StartForm, familyLabel: string): string {
  const mean = `${familyLabel}: Ø ${formatValue(form.mean as number, 2)} je Schuss`
  const c = form.comparison
  if (!c || c.test === null)
    return `${mean}; für einen Vergleich mit den 90 Tagen davor zu wenige Scheiben.`
  const verdict = verdictText(c, "higher")
  const delta = formatSigned(c.delta, 2)
  return c.verdict === "unclear"
    ? `${mean}, ${verdict} zu den 90 Tagen davor (${delta}).`
    : `${mean}, ${verdict} als in den 90 Tagen davor (${delta}).`
}

/**
 * „Form der letzten 90 Tage“ auf Start (Plan N5, D7; U5, D4): ein Titel und ein Satz für die zuletzt gewählte Familie,
 * Ø je Schuss und das Urteil gegen die 90 Tage davor wie im Fortschritt; das Ganze führt dorthin. Ohne Wert nichts.
 */
export function FormLine({
  form,
  familyLabel,
  className,
}: {
  form: StartForm
  familyLabel: string
  className?: string
}) {
  if (form.mean === null) return null
  return (
    <RouteLink
      route={form.route}
      data-form-line
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-[14px] hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring",
        className
      )}
    >
      <span className="grid min-w-0 gap-0.5">
        <span data-form-title className="font-semibold text-foreground">
          Form der letzten 90 Tage
        </span>
        <span className="text-foreground-2">{formSentence(form, familyLabel)}</span>
      </span>
      <span aria-hidden="true" className="text-muted-foreground">
        ›
      </span>
    </RouteLink>
  )
}
