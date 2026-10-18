import { scoreBgClass } from "@/lib/scoreColors"

/**
 * Die Schusswerte einer Serie: vor jedem Wert ein Farbpunkt in der Ringwert-Farbe wie Spiegels Ablesung, der Wert
 * selbst in Schriftfarbe (Gold und Türkis tragen als Schrift auf Hell nicht).
 */
export function ShotValues({ shots, className }: { shots: string[]; className?: string }) {
  return (
    <span
      className={`inline-flex flex-wrap gap-x-2.5 gap-y-1 font-mono text-xs ${className ?? ""}`}
    >
      {shots.map((shot, index) => {
        const color = scoreBgClass(shot)
        return (
          <span key={index} className="inline-flex items-center gap-1 whitespace-nowrap">
            {color && (
              <span
                aria-hidden="true"
                className={`inline-block size-2 rounded-full border border-shot-edge ${color}`}
              />
            )}
            {shot}
          </span>
        )
      })}
    </span>
  )
}
