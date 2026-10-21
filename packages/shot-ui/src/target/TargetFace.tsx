import type { TargetImage } from "@vereinsheim/shot-core/targets"
import type { ReactNode } from "react"

import type { ViewBox } from "../types"

const HAIR = { vectorEffect: "non-scaling-stroke" } as const
const mm = (um: number) => um / 1000

/** Farben des Scheibenbilds: wie am Stand oder ruhig unter einer Heatmap */
const FACES = {
  paper: {
    paper: "var(--paper)",
    spiegel: "var(--spiegel)",
    paperLine: "var(--paper-line)",
    spiegelLine: "var(--spiegel-line)",
  },
  quiet: {
    paper: "var(--heat-paper)",
    spiegel: "var(--heat-spiegel)",
    paperLine: "var(--heat-line)",
    spiegelLine: "var(--heat-line)",
  },
} as const

/** die Ringe als Haarlinien; Ringe weit außerhalb des Ausschnitts fallen weg */
export function TargetRings({
  target,
  view,
  quiet = false,
  stroke,
}: {
  target: TargetImage
  view: ViewBox
  quiet?: boolean
  /** eine Farbe für alle Ringe, etwa über einer Heatmap */
  stroke?: string
}) {
  const half = view.w / 2
  const face = quiet ? FACES.quiet : FACES.paper
  return (
    <>
      {target.ringRadiiUm.map((radiusUm, i) => {
        const r = mm(radiusUm)
        if (r > half * 1.5 || (i === 9 && target.weapon === "lg")) return null
        return (
          <circle
            key={i}
            r={r}
            fill="none"
            stroke={stroke ?? (i + 1 >= target.blackFromRing ? face.spiegelLine : face.paperLine)}
            strokeWidth={0.75}
            opacity={quiet ? 1 : 0.7}
            {...HAIR}
          />
        )
      })}
    </>
  )
}

/**
 * Das Scheibenbild ohne Treffer, als Teil eines SVG in mm (y nach unten): Papier über den Ausschnitt, Spiegel, Ringe als
 * Haarlinien. `quiet`: Papier und Spiegel zurückgenommen, damit eine Heatmap darüber trägt. `children` liegt auf dem
 * Papier unter Spiegel und Ringen (das Probe-Eck der kleinen Scheiben). Für `MiniTarget` und die Bilder eines Zeitraums.
 */
export function TargetFace({
  target,
  view,
  quiet = false,
  children,
}: {
  target: TargetImage
  view: ViewBox
  quiet?: boolean
  children?: ReactNode
}) {
  const face = quiet ? FACES.quiet : FACES.paper
  const blackR = mm(target.ringRadiiUm[target.blackFromRing - 1])
  return (
    <>
      <rect x={view.x} y={view.y} width={view.w} height={view.w} fill={face.paper} />
      {children}
      <circle r={blackR} fill={face.spiegel} />
      {target.weapon === "lg" && <circle r={mm(target.ringRadiiUm[9])} fill={face.paper} />}
      <TargetRings target={target} view={view} quiet={quiet} />
    </>
  )
}
