import { cn } from "@vereinsheim/lib/utils"

/**
 * Eine Erklärung in einfacher Sprache, wie sie hinter jedem „?“ steht. Spiegel holt sie aus `shot-help`, Ringwerk und
 * Treffsicher aus ihren eigenen Themen (`lib/help/topics.ts`).
 */
export interface HelpText {
  title: string
  /** ein Satz für Kachel und Tooltip */
  short?: string
  /** Was misst es? */
  what?: string
  /** So liest du es */
  read?: string
  /** Was du tun kannst */
  act?: string
  /** Vorsicht */
  caution?: string
  /** Mindestzahl */
  minimum?: string
  /** die Formel für Profis */
  formula?: string
}

/** Felder einer Erklärung in der Reihenfolge des Leitfadens (`shot-help/markdown`); ein Test hält sie gleich */
export const HELP_FIELDS = [
  ["what", "Was"],
  ["read", "So liest du es"],
  ["act", "Was du tun kannst"],
  ["caution", "Vorsicht"],
  ["minimum", "Mindestzahl"],
] as const

/** Fragezeichen im Kreis */
export function HelpIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      className={cn("size-4 shrink-0", className)}
    >
      <circle cx={12} cy={12} r={9} />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8v.3" />
      <path d="M12 17h.01" />
    </svg>
  )
}

export interface HelpButtonProps {
  /** wofür die Erklärung ist, etwa der Name der Kachel */
  label: string
  onClick: () => void
  /** Id der Erklärung, als `data-help` am Knopf (Prüfung: jedes Thema hat seinen Platz) */
  helpId?: string
  className?: string
}

/** „?“ an einer Zahl: öffnet ihre Erklärung (als Blatt, nie nur als Tooltip) */
export function HelpButton({ label, onClick, helpId, className }: HelpButtonProps) {
  return (
    <button
      type="button"
      aria-label={`Erklärung: ${label}`}
      data-help={helpId}
      onClick={onClick}
      className={cn(
        "-m-2.5 inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
        className
      )}
    >
      <HelpIcon />
    </button>
  )
}

export interface HelpBodyProps {
  topic: HelpText
  className?: string
}

/** Die Erklärung selbst: nur die vorhandenen Felder, die Formel für Profis zugeklappt nach den Worten */
export function HelpBody({ topic, className }: HelpBodyProps) {
  return (
    <div
      className={cn(
        "grid gap-1.5 text-[13.5px] leading-normal text-foreground-2 [&_b]:font-semibold [&_b]:text-foreground",
        className
      )}
    >
      {HELP_FIELDS.map(([field, label]) =>
        topic[field] ? (
          <p key={field}>
            <b>{`${label}:`}</b>
            {` ${topic[field]}`}
          </p>
        ) : null
      )}
      {topic.formula && (
        <details>
          <summary className="cursor-pointer text-[12.5px] font-semibold text-muted-foreground">
            Formel für Profis
          </summary>
          <code className="mt-1.5 block font-mono text-xs break-words whitespace-pre-wrap">
            {topic.formula}
          </code>
        </details>
      )}
    </div>
  )
}
