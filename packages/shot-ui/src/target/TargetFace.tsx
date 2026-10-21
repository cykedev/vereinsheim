import type { TargetImage } from "@vereinsheim/shot-core/targets"
import type { ReactNode } from "react"

import type { ViewBox } from "../types"

const HAIR = { vectorEffect: "non-scaling-stroke" } as const
const mm = (um: number) => um / 1000

/**
 * Das Scheibenbild ohne Treffer, als Teil eines SVG in mm (y nach unten): Papier über den Ausschnitt, Spiegel, Ringe als
 * Haarlinien; Ringe weit außerhalb des Ausschnitts fallen weg. `children` liegt auf dem Papier unter Spiegel und Ringen
 * (das Probe-Eck der kleinen Scheiben). Für `MiniTarget` und die Bilder eines Zeitraums.
 */
export function TargetFace({
  target,
  view,
  children,
}: {
  target: TargetImage
  view: ViewBox
  children?: ReactNode
}) {
  const half = view.w / 2
  const blackR = mm(target.ringRadiiUm[target.blackFromRing - 1])
  return (
    <>
      <rect x={view.x} y={view.y} width={view.w} height={view.w} fill="var(--paper)" />
      {children}
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
    </>
  )
}
