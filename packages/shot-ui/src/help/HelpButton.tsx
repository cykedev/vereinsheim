"use client"

import { cn } from "@vereinsheim/lib/utils"

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
