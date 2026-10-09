import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { cn } from "@vereinsheim/lib/utils"

import { caliberRadius, probeCorner, scoreColor, SHOT_FILL_OPACITY } from "../geometry"
import { hasPosition } from "../shots"
import type { ViewBox } from "../types"

const HAIR = { vectorEffect: "non-scaling-stroke" } as const
const mm = (um: number) => um / 1000

export interface MiniTargetProps {
  target: TargetImage
  /** Ausschnitt in mm, etwa `seriesTileView` oder `groupView` */
  view: ViewBox
  /** die Treffer, die sie zeigt; ohne Lage fallen sie weg, Probe als Ring */
  shots: readonly MetricShot[]
  /** Ecke oben rechts in der Farbe des Spiegels: eine Kachel der Probe */
  probeCorner?: boolean
  /** blass: nur das Bild tritt zurück */
  dim?: boolean
  className?: string
}

/**
 * Kleine Scheibe (aus den Serien, `SeriesStrip`): Papier, Spiegel, Ringe als Haarlinien, Treffer in
 * Kalibergröße und Ringwert-Farbe, Probe als Ring; ohne Wert gestrichelt. Nur Bild (`aria-hidden`), die
 * Worte stehen daneben. Auch in der Ablesung einer Scheibe auf der Seite eines Zeitraums.
 */
export function MiniTarget({
  target,
  view,
  shots,
  probeCorner: corner = false,
  dim = false,
  className,
}: MiniTargetProps) {
  const half = view.w / 2
  const calR = caliberRadius(target)
  const blackR = mm(target.ringRadiiUm[target.blackFromRing - 1])
  return (
    <svg
      viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
      aria-hidden="true"
      className={cn(
        "block aspect-square h-auto w-full rounded-lg border border-border",
        dim && "opacity-55",
        className
      )}
    >
      <rect x={view.x} y={view.y} width={view.w} height={view.w} fill="var(--paper)" />
      {corner && (
        <polygon data-probe-corner="true" points={probeCorner(view)} fill="var(--spiegel)" />
      )}
      <circle r={blackR} fill="var(--spiegel)" />
      {target.weapon === "lg" && <circle r={mm(target.ringRadiiUm[9])} fill="var(--paper)" />}
      {target.ringRadiiUm.map((radiusUm, i) => {
        const r = mm(radiusUm)
        if (r > half * 1.5 || (i === 9 && target.weapon === "lg")) return null
        return (
          <circle
            key={i}
            r={r}
            fill="none"
            stroke={i + 1 >= target.blackFromRing ? "var(--spiegel-line)" : "var(--paper-line)"}
            strokeWidth={0.75}
            opacity={0.7}
            {...HAIR}
          />
        )
      })}
      {shots.filter(hasPosition).map((shot, i) => {
        const x = mm(shot.xUm as number)
        const y = -mm(shot.yUm as number)
        const color = shot.ring === null ? "var(--paper-line)" : scoreColor(shot.ring)
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={calR}
            fill={shot.ring === null ? "none" : color}
            fillOpacity={SHOT_FILL_OPACITY}
            stroke="var(--shot-edge)"
            strokeWidth={1}
            strokeDasharray={shot.ring === null ? "2 2" : undefined}
            {...HAIR}
          />
        )
      })}
    </svg>
  )
}
