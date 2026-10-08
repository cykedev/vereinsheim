"use client"

import { mpiConfidence } from "@vereinsheim/shot-core/analysis"
import { centroid, smallestEnclosingCircle, type Point } from "@vereinsheim/shot-core/geometry"
import { metricByKey, type MetricShot } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { useMemo, type MouseEvent } from "react"

import {
  caliberRadius,
  groupView,
  nearestShot,
  scoreColor,
  screenSizes,
  TAP_REACH_PX,
  targetView,
  unitsPerPixel,
} from "../geometry"
import { layerOrder } from "../layers"
import { formatScore, groupShots, hasPosition, seriesKeyOf, shotLabels } from "../shots"
import type { SeriesKey } from "../types"
import { isSelected, type ViewState } from "../view-state"
import { useAnimatedViewBox, useElementWidth } from "./useAnimatedViewBox"

export interface TargetViewProps {
  target: TargetImage
  /** alle Schüsse der Scheibe in Abgabefolge (`inShotOrder`), Probe und Wertung */
  shots: readonly MetricShot[]
  state: ViewState
  /**
   * Antippen: der Treffer der Auswahl mit der nächsten Mitte, bis 20 px daneben (`nearestShot`);
   * `series` null für einen Wertungsschuss ohne Serie
   */
  onChoose?: (index: number, series: SeriesKey | null) => void
  /** Schüsse außerhalb der Auswahl: blass (Standard) oder ausgeblendet */
  others?: "dim" | "hide"
  /** ein eben gesetzter Schuss ploppt kurz auf */
  popIndex?: number | null
  /**
   * Schlüssel der Karte (etwa die Id der Session): Wechselt er, steht der neue Ausschnitt sofort, statt
   * vom alten herüberzugleiten. Ohne Angabe gilt das Scheibenbild als Karte.
   */
  viewKey?: string
  className?: string
}

/** Linien bleiben 1 px breit, egal wie weit gezoomt ist */
const HAIR = { vectorEffect: "non-scaling-stroke" } as const
const SHOT_FILL_OPACITY = 0.8
const FADED_OPACITY = 0.18
const SPREAD_MIN_SHOTS = metricByKey("group.enclosingDiameter")?.minShots ?? 2

const point = (shot: MetricShot): Point => ({ xUm: shot.xUm as number, yUm: shot.yUm as number })
const mm = (um: number) => um / 1000

function selectionText(state: ViewState): string {
  if (state.selection === "all") return ""
  return `, gewählt: ${state.selection === "probe" ? "Probe" : `Serie ${state.selection}`}`
}

/**
 * Die Scheibe (spiegel-ui-design „Zeichnen der Scheibe“): Papier, Spiegel und Ringe als Haarlinien,
 * Treffer in Kalibergröße, jeder mit seiner Nummer (ein späterer Treffer verdeckt auch die Nummer eines
 * früheren), darüber Streukreis, Vertrauensellipse und ganz oben der Schwerpunkt. Was beim Zoomen gleich
 * groß bleiben soll (Nummern, Ringzahlen, Schwerpunkt), richtet sich nach der gemessenen Breite.
 */
export function TargetView({
  target,
  shots,
  state,
  onChoose,
  others = "dim",
  popIndex = null,
  viewKey,
  className,
}: TargetViewProps) {
  const [width, measure] = useElementWidth()
  const group = useMemo(() => groupShots(shots, state.selection), [shots, state.selection])
  const groupPoints = useMemo(() => group.map(point), [group])
  const wanted = state.view === "group" ? groupView(target, groupPoints) : targetView(target)
  // eine andere Karte steht sofort, ein anderer Ausschnitt derselben Karte gleitet
  const view = useAnimatedViewBox(wanted, viewKey ?? target.id)
  const sizes = screenSizes(target, unitsPerPixel(view, width))
  const calR = caliberRadius(target)
  const labels = useMemo(() => shotLabels(shots), [shots])
  const selectedAt = (i: number) => isSelected(state.selection, seriesKeyOf(shots[i]))
  const chosen = state.chosen?.index ?? null
  const order = layerOrder(shots, { chosen, selected: selectedAt }).filter(
    (i) => hasPosition(shots[i]) && (others === "dim" || selectedAt(i))
  )

  const circle =
    state.layers.circle && group.length >= SPREAD_MIN_SHOTS
      ? smallestEnclosingCircle(groupPoints)
      : null
  const confidence = state.layers.ellipse ? mpiConfidence(group) : null
  const center = state.layers.mpi && group.length >= 2 ? centroid(groupPoints) : null

  const matchCount = shots.filter((shot) => shot.kind === "match").length
  const probeCount = shots.length - matchCount
  const label = `${target.label}: ${matchCount} Wertungsschüsse${
    probeCount ? `, ${probeCount} Probeschüsse` : ""
  }${selectionText(state)}`

  const ringW = mm(target.ringWidthUm)
  const blackR = mm(target.ringRadiiUm[target.blackFromRing - 1])

  // Ein Tipp gilt dem nächsten Treffer der Auswahl: bis 20 px neben seiner Mitte, gezoomt bis an seinen
  // Rand. Auf dem Handy misst ein Treffer auf der ganzen Scheibe nur wenige Pixel.
  const tap = onChoose
    ? (event: MouseEvent<SVGSVGElement>) => {
        const matrix = event.currentTarget.getScreenCTM()
        if (!matrix || !matrix.a) return
        const at = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
        const index = nearestShot(
          order
            .filter((i) => selectedAt(i))
            .map((i) => ({
              index: i,
              x: mm(shots[i].xUm as number),
              y: -mm(shots[i].yUm as number),
            })),
          { x: at.x, y: at.y },
          Math.max(calR, TAP_REACH_PX / matrix.a)
        )
        if (index !== null) onChoose(index, seriesKeyOf(shots[index]))
      }
    : undefined

  return (
    <svg
      ref={measure}
      role="img"
      aria-label={label}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
      className={className}
      onClick={tap}
    >
      <style>{`
        .shot-ui-pop { animation: shot-ui-pop 260ms ease-out; transform-box: fill-box; transform-origin: center; }
        @keyframes shot-ui-pop { from { transform: scale(1.8); opacity: 0.2; } to { transform: scale(1); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .shot-ui-pop { animation: none; } }
      `}</style>
      <g data-layer="target">
        <rect x={-500} y={-500} width={1000} height={1000} fill="var(--paper)" />
        <circle cx={0} cy={0} r={blackR} fill="var(--spiegel)" />
        {target.ringRadiiUm.map((radiusUm, i) => {
          const ring = i + 1
          if (ring === 10 && target.weapon === "lg") {
            return <circle key={ring} cx={0} cy={0} r={mm(radiusUm)} fill="var(--paper)" />
          }
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
        {target.innerTen.kind === "touch" && (
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
        {target.labelRings.flatMap((ring) => {
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
              fontSize={sizes.ringLabel}
              fontWeight={600}
              fill={onBlack ? "var(--spiegel-line)" : "var(--paper-line)"}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {ring}
            </text>
          ))
        })}
      </g>

      <g data-layer="shots">
        {order.map((i) => {
          const shot = shots[i]
          const probe = shot.kind === "probe"
          const faded = !selectedAt(i)
          const isChosen = i === chosen
          const x = mm(shot.xUm as number)
          const y = -mm(shot.yUm as number)
          const color = shot.ring === null ? "var(--paper-line)" : scoreColor(shot.ring)
          // auch in einem hohlen Kreis (fill="none") zeigt der Mauszeiger die Hand; blasse bleiben ganz aus
          const hitArea = faded ? undefined : "visible"
          return (
            <g
              key={i}
              data-shot={labels[i]}
              data-faded={faded || undefined}
              data-chosen={isChosen || undefined}
              opacity={faded ? FADED_OPACITY : undefined}
              pointerEvents={faded ? "none" : undefined}
              style={onChoose && !faded ? { cursor: "pointer" } : undefined}
            >
              <title>{`${probe ? "Probe" : "Schuss"} ${labels[i]}: ${formatScore(shot, state.scoring)}`}</title>
              {probe ? (
                <circle
                  cx={x}
                  cy={y}
                  r={calR * 0.92}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  pointerEvents={hitArea}
                  className={i === popIndex ? "shot-ui-pop" : undefined}
                  {...HAIR}
                />
              ) : (
                <circle
                  cx={x}
                  cy={y}
                  r={calR}
                  fill={shot.ring === null ? "none" : color}
                  fillOpacity={SHOT_FILL_OPACITY}
                  stroke="var(--shot-edge)"
                  strokeWidth={1}
                  strokeDasharray={shot.ring === null ? "2 2" : undefined}
                  pointerEvents={hitArea}
                  className={i === popIndex ? "shot-ui-pop" : undefined}
                  {...HAIR}
                />
              )}
              {/* der angetippte Schuss zeigt seine Nummer immer, die übrigen mit der Ebene */}
              {(state.layers.numbers || isChosen) && !faded && (
                <text
                  data-number={labels[i]}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={sizes.numberFont}
                  fontWeight={700}
                  fill="var(--shot-number)"
                  stroke="var(--shot-number-halo)"
                  strokeWidth={sizes.numberHalo}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                  pointerEvents="none"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {labels[i]}
                </text>
              )}
              {isChosen && (
                <>
                  <circle
                    data-ring="chosen"
                    cx={x}
                    cy={y}
                    r={calR + sizes.spreadGap}
                    fill="none"
                    stroke="var(--overlay-halo)"
                    strokeWidth={3}
                    {...HAIR}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={calR + sizes.spreadGap}
                    fill="none"
                    stroke="var(--overlay)"
                    strokeWidth={1.5}
                    {...HAIR}
                  />
                </>
              )}
            </g>
          )
        })}
      </g>

      <g data-layer="overlays" pointerEvents="none">
        {circle && (
          // liegt um die Treffer: durch die Zentren plus halbes Kaliber und 2 px Luft, als Haarlinie
          <circle
            data-overlay="spread"
            cx={mm(circle.xUm)}
            cy={-mm(circle.yUm)}
            r={mm(circle.radiusUm) + calR + sizes.spreadGap}
            fill="none"
            stroke="var(--overlay)"
            strokeWidth={1}
            {...HAIR}
          />
        )}
        {confidence && (
          <g
            data-overlay="ellipse"
            transform={`rotate(${(-confidence.ellipse.angleRad * 180) / Math.PI} ${mm(
              confidence.center.xUm
            )} ${-mm(confidence.center.yUm)})`}
          >
            {/* gestrichelt wie ein Modell, mit hellem Saum über farbigen Treffern */}
            <ellipse
              cx={mm(confidence.center.xUm)}
              cy={-mm(confidence.center.yUm)}
              rx={mm(confidence.ellipse.majorUm)}
              ry={mm(confidence.ellipse.minorUm)}
              fill="none"
              stroke="var(--overlay-halo)"
              strokeWidth={3}
              {...HAIR}
            />
            <ellipse
              cx={mm(confidence.center.xUm)}
              cy={-mm(confidence.center.yUm)}
              rx={mm(confidence.ellipse.majorUm)}
              ry={mm(confidence.ellipse.minorUm)}
              fill="none"
              stroke="var(--overlay)"
              strokeWidth={1.25}
              strokeDasharray="5 3"
              {...HAIR}
            />
          </g>
        )}
        {center && (
          // Schwerpunkt ganz oben: weiße Scheibe, zwei schwarze Viertel, Kontur mit hellem Saum
          <g
            data-overlay="mpi"
            transform={`translate(${mm(center.xUm)} ${-mm(center.yUm)}) scale(${sizes.mpiRadius})`}
          >
            <title>Schwerpunkt</title>
            <circle r={1} fill="none" stroke="var(--mpi-halo)" strokeWidth={3} {...HAIR} />
            <circle r={1} fill="var(--mpi-light)" />
            <path d="M0 0L0-1A1 1 0 0 0-1 0ZM0 0L0 1A1 1 0 0 0 1 0Z" fill="var(--mpi-dark)" />
            <circle r={1} fill="none" stroke="var(--mpi-dark)" strokeWidth={1} {...HAIR} />
          </g>
        )}
      </g>
    </svg>
  )
}
