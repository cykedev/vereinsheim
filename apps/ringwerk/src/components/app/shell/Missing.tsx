import { cn } from "@vereinsheim/lib/utils"

import { missingReason, type MissingKind } from "@/lib/help/missing"

/**
 * „–“ mit dem Grund, warum hier kein Wert steht. Sichtbar leise daneben; wo die Zelle zu schmal ist (`quiet`), nur als
 * Tooltip und für Screenreader.
 */
export function Missing({
  kind,
  quiet = false,
  className,
}: {
  kind: MissingKind
  quiet?: boolean
  className?: string
}) {
  const reason = missingReason(kind)
  return (
    <span
      data-missing={kind}
      title={quiet ? reason : undefined}
      className={cn("inline-flex items-baseline gap-1.5 text-muted-foreground", className)}
    >
      <span aria-hidden="true">–</span>
      <span className={quiet ? "sr-only" : "text-xs font-normal"}>{reason}</span>
    </span>
  )
}
