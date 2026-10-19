"use client"

import { formatSigned, formatValue } from "@vereinsheim/shot-ui/format"
import { countOf } from "@vereinsheim/shot-ui/period/words"

import type { SelfImage } from "@/lib/statistics/selfImage"
import { SESSION_WORDS } from "@/lib/statistics/words"

/** ein Balken von 0 bis 100 */
function Bar({ value, className }: { value: number; className: string }) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-surface-2">
      <span className={`block h-full rounded-full ${className}`} style={{ width: `${value}%` }} />
    </span>
  )
}

/**
 * Reiter „Selbstbild“: je Bereich Prognose (leise) und Feedback (Farbe der App) als Balken von 0 bis 100, dazu die
 * Zahlen und der Abstand. Kein Urteil, dafür sind es zu wenige Einheiten.
 */
export function StatisticsSelfImage({ image }: { image: SelfImage }) {
  return (
    <section aria-label="Selbstbild" className="grid gap-4">
      <div className="grid min-w-0 gap-1">
        <h2 className="font-display text-xl font-bold tracking-tight">Selbstbild</h2>
        <p className="text-[13px] text-muted-foreground">
          {image.n
            ? `Prognose vor und Feedback nach der Einheit, im Mittel über ${countOf(image.n, SESSION_WORDS)}.`
            : "Im Zeitraum gibt es keine Einheit mit Prognose und Feedback."}
        </p>
      </div>
      {image.n > 0 && (
        <ul className="grid divide-y divide-border rounded-2xl border border-border bg-card px-4">
          {image.rows.map((row) => (
            <li key={row.key} data-self-image={row.key} className="grid gap-1.5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
                <span className="font-semibold">{row.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {`Prognose ${formatValue(row.prognosis, 0)} · Feedback ${formatValue(row.feedback, 0)} · Abstand `}
                  <span className="font-semibold text-foreground">
                    {formatSigned(row.delta, 0)}
                  </span>
                </span>
              </div>
              <Bar value={row.prognosis} className="bg-quiet" />
              <Bar value={row.feedback} className="bg-primary" />
            </li>
          ))}
        </ul>
      )}
      {image.n > 0 && (
        <p className="text-[12.5px] text-muted-foreground">
          Oben die Prognose, unten das Feedback. Abstand ist Feedback minus Prognose. Plus heißt:
          besser als gedacht.
        </p>
      )}
    </section>
  )
}
