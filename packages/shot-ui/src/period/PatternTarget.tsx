import type { PatternLayer } from "@vereinsheim/shot-core/analysis"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { cn } from "@vereinsheim/lib/utils"

import { caliberRadius, scoreColor, SHOT_FILL_OPACITY } from "../geometry"
import { MpiMark } from "../target/MpiMark"
import { TargetFace } from "../target/TargetFace"
import type { ViewBox } from "../types"
import { contourPath } from "./contours"

const HAIR = { vectorEffect: "non-scaling-stroke" } as const
/** Raster der Punkte im Muster: 10 µm (`periodPattern`) */
const POINT_MM = 0.01
/** Farben der Bänder von außen (selten) nach innen (oft) */
export const HEAT_COLORS = [
  "var(--heat-1)",
  "var(--heat-2)",
  "var(--heat-3)",
  "var(--heat-4)",
  "var(--heat-5)",
] as const

/**
 * Deckkraft der Bänder von außen nach innen: Die seltenen lassen Papier und Spiegel durchscheinen (die Scheibe bleibt
 * echt erkennbar), die dichten decken fast
 */
const HEAT_OPACITY = [0.5, 0.62, 0.74, 0.86, 0.94] as const

export interface PatternTargetProps {
  /** das Bild aus `periodPattern`: unter 50 Schuss die Punkte, sonst die Dichte in Bändern */
  layer: PatternLayer
  target: TargetImage
  /** der Satz unter dem Bild als Name des Bilds */
  label: string
  className?: string
}

/**
 * Trefferbild über einen Zeitraum (L9) auf der echten Scheibe (Papier und Spiegel wie auf der Seite einer Scheibe). Ab
 * 50 Schuss eine Heatmap: fünf Bänder von selten (violett) bis oft (gelb), deren Grenzen Anteile der Schüsse
 * umschließen, darüber Ringe und Ringzahlen wie gedruckt, mit Saum lesbar auf jedem Band. Darunter
 * jeder Schuss in Kalibergröße und Ringfarbe wie auf der Seite einer Scheibe. Der geviertelte Kreis ist die Mitte aller
 * Schüsse. Das Bild trägt den Satz als Namen, die Worte stehen daneben.
 */
export function PatternTarget({ layer, target, label, className }: PatternTargetProps) {
  const half = layer.halfUm / 1000
  const view = { x: -half, y: -half, w: 2 * half }
  const calR = caliberRadius(target)
  return (
    <svg
      viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
      role="img"
      aria-label={label}
      data-pattern-target={layer.grid ? "density" : "points"}
      className={cn(
        "block aspect-square h-auto w-full rounded-xl border border-border select-none",
        className
      )}
    >
      <TargetFace target={target} view={view} />
      {layer.grid ? (
        <>
          {layer.grid.levels.map((level, i) => (
            <path
              key={i}
              data-pattern-band={i + 1}
              d={contourPath(layer.grid!, level, layer.halfUm)}
              fill={HEAT_COLORS[i]}
              fillOpacity={HEAT_OPACITY[i]}
              fillRule="evenodd"
            />
          ))}
          <HeatRings target={target} view={view} />
        </>
      ) : (
        (layer.points ?? []).map(([x, y, ring], i) => (
          <circle
            key={i}
            data-pattern-shot
            cx={x * POINT_MM}
            cy={-y * POINT_MM}
            r={calR}
            fill={ring === null ? "none" : scoreColor(ring)}
            fillOpacity={SHOT_FILL_OPACITY}
            stroke="var(--shot-edge)"
            strokeWidth={1}
            strokeDasharray={ring === null ? "2 2" : undefined}
            {...HAIR}
          />
        ))
      )}
      {layer.center && (
        <MpiMark x={layer.center.xUm / 1000} y={-layer.center.yUm / 1000} radius={view.w * 0.022} />
      )}
    </svg>
  )
}

const mm = (um: number) => um / 1000

/**
 * die Ringzahlen eines Scheibenbilds im Ausschnitt: je Ring 1 bis 9 die Mitte seines Bands bei 3 und 9 Uhr, nur wo das
 * Band breit genug für die Zahl ist (10 trägt die Mitte selbst)
 */
export function ringLabels(
  target: TargetImage,
  view: ViewBox,
  fontMm: number
): { ring: number; xMm: number }[] {
  const half = view.w / 2
  const labels: { ring: number; xMm: number }[] = []
  for (let ring = 1; ring <= 9; ring++) {
    const outer = mm(target.ringRadiiUm[ring - 1])
    const inner = mm(target.ringRadiiUm[ring])
    const mid = (outer + inner) / 2
    if (mid > half - fontMm || outer - inner < fontMm * 1.2) continue
    labels.push({ ring, xMm: mid }, { ring, xMm: -mid })
  }
  return labels
}

/** Farben wie gedruckt: auf dem Papier dunkel mit hellem Saum, im Spiegel hell mit dunklem Saum */
const PRINT = {
  paper: { line: "var(--paper-line)", halo: "var(--heat-halo-light)" },
  spiegel: { line: "var(--spiegel-line)", halo: "var(--heat-halo-dark)" },
} as const

/**
 * Ringe über der Heatmap wie auf der echten Scheibe gedruckt, mit Saum, damit sie auf jedem Band lesbar bleiben; der
 * Rand des Spiegels kräftiger. Dazu die Ringzahlen in ihren Ringen, damit sich der Wert einer Stelle ablesen lässt.
 */
function HeatRings({ target, view }: { target: TargetImage; view: ViewBox }) {
  const half = view.w / 2
  const fontMm = view.w * 0.032
  const blackR = mm(target.ringRadiiUm[target.blackFromRing - 1])
  return (
    <g data-heat-rings>
      {target.ringRadiiUm.map((radiusUm, i) => {
        const r = mm(radiusUm)
        if (r > half * 1.5 || (i === 9 && target.weapon === "lg")) return null
        const edge = i + 1 === target.blackFromRing
        const print = i + 1 > target.blackFromRing ? PRINT.spiegel : PRINT.paper
        return (
          <g key={i} data-mirror-edge={edge || undefined}>
            <circle r={r} fill="none" stroke={print.halo} strokeWidth={edge ? 4 : 2.5} {...HAIR} />
            <circle r={r} fill="none" stroke={print.line} strokeWidth={edge ? 2 : 1} {...HAIR} />
          </g>
        )
      })}
      {ringLabels(target, view, fontMm).map(({ ring, xMm }) => {
        const print = Math.abs(xMm) < blackR ? PRINT.spiegel : PRINT.paper
        return (
          <text
            key={`${ring}:${xMm}`}
            data-ring-label={ring}
            x={xMm}
            y={fontMm * 0.36}
            textAnchor="middle"
            fontSize={fontMm}
            fontWeight={600}
            fill={print.line}
            stroke={print.halo}
            strokeWidth={fontMm * 0.18}
            paintOrder="stroke"
          >
            {ring}
          </text>
        )
      })}
    </g>
  )
}

/** Legende der Heatmap: ein Verlauf von selten nach oft in den Farben der Bänder */
export function HeatLegend() {
  return (
    <div data-heat-legend className="flex items-center gap-2 text-[12px] text-muted-foreground">
      <span>selten</span>
      <span
        aria-hidden="true"
        className="h-2 flex-1 rounded-full"
        style={{ background: `linear-gradient(90deg, ${HEAT_COLORS.join(", ")})` }}
      />
      <span>oft</span>
    </div>
  )
}
