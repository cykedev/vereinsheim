import type { HelpTopic, ViewHelp } from "@vereinsheim/shot-help/types"
import { cn } from "@vereinsheim/lib/utils"

/** Felder einer Erklärung in der Reihenfolge des Leitfadens (`shot-help/markdown`); ein Test hält sie gleich */
export const HELP_FIELDS = [
  ["what", "Was"],
  ["read", "So liest du es"],
  ["act", "Was du tun kannst"],
  ["caution", "Vorsicht"],
  ["minimum", "Mindestzahl"],
] as const

type Field = (typeof HELP_FIELDS)[number][0] | "formula"

export interface HelpBodyProps {
  /** Erklärung einer Kennzahl oder Auswertung (`helpTopic`) oder der Oberfläche (`VIEW_HELP`) */
  topic: HelpTopic | ViewHelp
  className?: string
}

/** Die Erklärung selbst: nur die vorhandenen Felder, die Formel für Profis zugeklappt nach den Worten */
export function HelpBody({ topic, className }: HelpBodyProps) {
  const fields = topic as Partial<Record<Field, string>>
  return (
    <div
      className={cn(
        "grid gap-1.5 text-[13.5px] leading-normal text-foreground-2 [&_b]:font-semibold [&_b]:text-foreground",
        className
      )}
    >
      {HELP_FIELDS.map(([field, label]) =>
        fields[field] ? (
          <p key={field}>
            <b>{`${label}:`}</b>
            {` ${fields[field]}`}
          </p>
        ) : null
      )}
      {fields.formula && (
        <details>
          <summary className="cursor-pointer text-[12.5px] font-semibold text-muted-foreground">
            Formel für Profis
          </summary>
          <code className="mt-1.5 block font-mono text-xs break-words whitespace-pre-wrap">
            {fields.formula}
          </code>
        </details>
      )}
    </div>
  )
}
