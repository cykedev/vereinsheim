import type { TargetImage } from "@vereinsheim/shot-core/targets"

import { probeCorner } from "../geometry"
import type { ViewBox } from "../types"

/** Linien bleiben 1 px breit, egal wie weit gezoomt ist */
const HAIR = { vectorEffect: "non-scaling-stroke" } as const
const mm = (um: number) => um / 1000

export interface TargetBoardProps {
  target: TargetImage
  /** Ausschnitt, für das Probe-Eck */
  view: ViewBox
  /** Größe der Ringzahlen in mm (`screenSizes(...).ringLabel`) */
  ringLabel: number
  /** Probe-Eck oben rechts: alle gezeigten Schüsse stammen aus der Probe */
  probe?: boolean
  /**
   * was gezeichnet wird: alles (Seite einer Scheibe), nur die Flächen (Papier, Spiegel, Zehn beim Luftgewehr) oder nur
   * Ringe und Ringzahlen; mit Flächen und Ringen getrennt liegt eine Heatmap dazwischen
   */
  part?: "all" | "fills" | "lines"
}

/**
 * Die Scheibe, wie sie gedruckt ist (spiegel-ui-design „Zeichnen der Scheibe“): Papier, Spiegel, Ringe als Haarlinien,
 * beim Luftgewehr die weiße Zehn, bei Innenzehnern zum Berühren ihr Kreis gestrichelt, die Ringzahlen auf vier Achsen
 * in der Schrift der Marke. Eine Zeichnung für die Seite einer Scheibe (`TargetView`) und das Trefferbild eines
 * Zeitraums.
 */
export function TargetBoard({
  target,
  view,
  ringLabel,
  probe = false,
  part = "all",
}: TargetBoardProps) {
  const fills = part !== "lines"
  const lines = part !== "fills"
  const ringW = mm(target.ringWidthUm)
  const blackR = mm(target.ringRadiiUm[target.blackFromRing - 1])
  return (
    <>
      {fills && <rect x={-500} y={-500} width={1000} height={1000} fill="var(--paper)" />}
      {fills && probe && (
        <polygon data-probe-corner="true" points={probeCorner(view)} fill="var(--spiegel)" />
      )}
      {fills && <circle cx={0} cy={0} r={blackR} fill="var(--spiegel)" />}
      {target.ringRadiiUm.map((radiusUm, i) => {
        const ring = i + 1
        if (ring === 10 && target.weapon === "lg") {
          return fills ? (
            <circle key={ring} cx={0} cy={0} r={mm(radiusUm)} fill="var(--paper)" />
          ) : null
        }
        if (!lines) return null
        const onBlack = ring >= target.blackFromRing
        return (
          <circle
            key={ring}
            cx={0}
            cy={0}
            r={mm(radiusUm)}
            fill="none"
            stroke={onBlack ? "var(--spiegel-line)" : "var(--paper-line)"}
            strokeWidth={1}
            {...HAIR}
          />
        )
      })}
      {lines && target.innerTen.kind === "touch" && (
        <circle
          cx={0}
          cy={0}
          r={target.innerTen.diameterMm / 2}
          fill="none"
          stroke="var(--spiegel-line)"
          strokeWidth={1}
          strokeDasharray="3 3"
          {...HAIR}
        />
      )}
      {lines &&
        target.labelRings.flatMap((ring) => {
          const rMid = mm(target.ringRadiiUm[ring - 1]) - ringW / 2
          const onBlack = ring >= target.blackFromRing
          return [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ].map(([dx, dy]) => (
            <text
              key={`${ring}:${dx}:${dy}`}
              data-ring={ring}
              x={dx * rMid}
              y={dy * rMid}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={ringLabel}
              fontWeight={600}
              fill={onBlack ? "var(--spiegel-line)" : "var(--paper-line)"}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {ring}
            </text>
          ))
        })}
    </>
  )
}
