import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { cn } from "@vereinsheim/lib/utils"

import { caliberRadius, miniView, probeCorner, scoreColor, SHOT_FILL_OPACITY } from "../geometry"
import { hasPosition } from "../shots"
import { TargetFace } from "./TargetFace"
import type { ViewBox } from "../types"

const HAIR = { vectorEffect: "non-scaling-stroke" } as const
const mm = (um: number) => um / 1000
/**
 * der Ausschnitt auf 1 µm: Gleitkommareste (24,400000000000002) bleiben nicht im Markup, und ein mitgegebener Ausschnitt
 * (etwa über `Math.hypot`) kann auf Server und Browser in der letzten Stelle verschieden ausfallen; das gezeichnete HTML
 * passte sonst beim Hydrieren nicht (Übersichten auf dem Server)
 */
const fixed = (value: number) => Math.round(value * 1000) / 1000

export interface MiniTargetProps {
  target: TargetImage
  /**
   * Ausschnitt in mm; ohne ihn `miniView` über die eigenen Treffer (um die Mitte, der Spiegel überall gleich groß).
   * Die Serien geben ihren gemeinsamen Ausschnitt mit (`seriesTileView`).
   */
  view?: ViewBox
  /**
   * die Treffer, die sie zeigt; ohne Lage fallen sie weg. Sie braucht nur Lage und Ring: Schüsse oder die kompakten
   * Lagen der Übersichten (`MarkShot` aus `shot-core/projection`)
   */
  shots: readonly Pick<MetricShot, "xUm" | "yUm" | "ring">[]
  /** Ecke oben rechts in der Farbe des Spiegels: eine Kachel der Probe */
  probeCorner?: boolean
  /** blass: nur das Bild tritt zurück */
  dim?: boolean
  className?: string
}

/**
 * Kleine Scheibe (Serien, Liste, Start, Ablesung einer Scheibe, Offen): Papier, Spiegel, Ringe als Haarlinien, Treffer
 * in Kalibergröße und Ringwert-Farbe, ohne Wert gestrichelt. Nur Bild (`aria-hidden`), die Worte stehen daneben.
 */
export function MiniTarget({
  target,
  view: given,
  shots,
  probeCorner: corner = false,
  dim = false,
  className,
}: MiniTargetProps) {
  const drawn = shots.filter(hasPosition)
  const computed =
    given ??
    miniView(
      target,
      drawn.map((shot) => ({ xUm: shot.xUm as number, yUm: shot.yUm as number }))
    )
  const view = { x: fixed(computed.x), y: fixed(computed.y), w: fixed(computed.w) }
  const calR = caliberRadius(target)
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
      <TargetFace target={target} view={view}>
        {corner && (
          <polygon data-probe-corner="true" points={probeCorner(view)} fill="var(--spiegel)" />
        )}
      </TargetFace>
      {drawn.map((shot, i) => {
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
