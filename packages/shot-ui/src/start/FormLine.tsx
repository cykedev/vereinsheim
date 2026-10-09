"use client"

import { cn } from "@vereinsheim/lib/utils"

import { formatSigned, formatValue } from "../format"
import { RouteLink } from "../nav/RouteLink"
import { verdictText } from "../period/sentence"
import type { StartForm } from "./model"

/**
 * „Form, letzte 90 Tage“ auf Start (Plan N5, D7): eine Zeile für die zuletzt gewählte Familie, Ø je Schuss und der
 * Vergleich mit den 90 Tagen davor wie im Fortschritt; die Zeile führt dorthin. Ohne Wert nichts.
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
  const compare = form.compareLabel
    ? form.comparison
      ? ` · ${formatSigned(form.comparison.delta, 2)} gegen ${form.compareLabel} · ${verdictText(form.comparison, "higher")}`
      : ` · gegen ${form.compareLabel}: zu wenige Scheiben`
    : ""
  return (
    <RouteLink
      route={form.route}
      data-form-line
      className={cn(
        "flex items-baseline justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-[14px] hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring",
        className
      )}
    >
      <span className="min-w-0 text-foreground-2">
        <span className="font-semibold text-foreground">Form, letzte 90 Tage</span>
        {` · ${familyLabel}: Ø ${formatValue(form.mean, 2)} je Schuss${compare}`}
      </span>
      <span aria-hidden="true" className="text-muted-foreground">
        ›
      </span>
    </RouteLink>
  )
}
