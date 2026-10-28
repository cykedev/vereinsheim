import { formatTimeOfDay } from "@vereinsheim/lib/format"
import { markShots, type CardMark } from "@vereinsheim/shot-core/projection"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import { MiniTarget } from "@vereinsheim/shot-ui/target/MiniTarget"

import type { ResultCard } from "@/lib/results-read"

import { resultText } from "../summaries"

/** Uhrzeit einer Scheibe wie in den Listen, ohne bekannte Uhrzeit „Uhrzeit unbekannt“ */
export const timeOf = (card: ResultCard, timeZone: string) =>
  card.timeUnknown ? "Uhrzeit unbekannt" : formatTimeOfDay(new Date(card.startedAtMs), timeZone)

/**
 * Eine Scheibe in einer Zeile wie in der Scheibenliste: kleine Scheibe, Uhrzeit, Ringe; ohne Ergebnis „–“ und leise
 * der Grund. Für die Scheiben eines Eintrags, das Blatt „Scheiben ändern“ und den Kopf in der Ausführung.
 */
export function CardHead({
  card,
  marks,
  timeZone,
}: {
  card: ResultCard
  marks: Record<string, CardMark[]>
  timeZone: string
}) {
  const shots = markShots(marks[card.id] ?? [])
  return (
    <span className="flex min-w-0 items-center gap-3">
      {card.targetId && (
        <MiniTarget
          target={TARGETS[card.targetId]}
          shots={shots}
          placeholder={shots.length === 0}
          className="size-10 shrink-0"
        />
      )}
      <span className="text-sm tabular-nums">
        <span className="font-semibold text-primary">{timeOf(card, timeZone)}</span>
        {card.result ? (
          <span className="text-foreground-2">{` · ${resultText(card.result)}`}</span>
        ) : (
          <>
            <span className="text-foreground-2"> · –</span>
            <span className="text-[13px] text-muted-foreground"> ohne Werte</span>
          </>
        )}
      </span>
    </span>
  )
}
