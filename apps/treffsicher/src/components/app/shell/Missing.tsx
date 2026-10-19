import { missingReason, type MissingKind } from "@/lib/missing"

/** „–“ und daneben leise der Grund, warum hier kein Wert steht */
export function Missing({ kind, className }: { kind: MissingKind; className?: string }) {
  return (
    <span data-missing={kind} className={`inline-flex items-baseline gap-1.5 ${className ?? ""}`}>
      <span aria-hidden="true">–</span>
      <span className="text-xs font-normal text-muted-foreground">{missingReason(kind)}</span>
    </span>
  )
}
