"use client"

import { mpiConfidence } from "@vereinsheim/shot-core/analysis"
import { centroid, smallestEnclosingCircle, type Point } from "@vereinsheim/shot-core/geometry"
import { isDrawn, metricByKey, type MetricShot } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { useMemo, type MouseEvent } from "react"

import {
  caliberRadius,
  groupView,
  nearestShot,
  scoreColor,
  screenSizes,
  SHOT_FILL_OPACITY,
  TAP_REACH_PX,
  targetView,
  unitsPerPixel,
} from "../geometry"
import { layerOrder } from "../layers"
import { KIND_TEXT } from "../list/KindMark"
import { formatShotValue, groupShots, isProbeShot, seriesKeyOf, shotLabels } from "../shots"
import type { SeriesKey } from "../types"
import { isSelected, type ViewState } from "../view-state"
import { MpiMark } from "./MpiMark"
import { TargetBoard } from "./TargetBoard"
import { useAnimatedViewBox, useElementWidth } from "./useAnimatedViewBox"

export interface TargetViewProps {
  target: TargetImage
  /** die Schüsse der Scheibe wie am Ausdruck (`asOnPrintout`) in Abgabefolge (`inShotOrder`) */
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
  /** Trefferlage als Summe: das Zeichen des Schwerpunkts an der Mitte (`MpiMark`), nur die Mitte, keine Streuung */
  summaryCenter?: { xUm: number; yUm: number } | null
  /** Art der Scheibe für den Namen einer Scheibe nur aus Probe („Probeschüsse als Wettkampf“); Vorgabe Training */
  kind?: "training" | "competition"
  className?: string
}

/** Linien bleiben 1 px breit, egal wie weit gezoomt ist */
const HAIR = { vectorEffect: "non-scaling-stroke" } as const
/** Schüsse außerhalb der Auswahl: grau statt farbig, damit nur die Auswahl Ringwert-Farben trägt */
const FADED_OPACITY = 0.55
const FADED_COLOR = "var(--shot-faded)"
const SPREAD_MIN_SHOTS = metricByKey("group.enclosingDiameter")?.minShots ?? 2

const point = (shot: MetricShot): Point => ({ xUm: shot.xUm as number, yUm: shot.yUm as number })
const mm = (um: number) => um / 1000

function selectionText(state: ViewState): string {
  return state.selection === "all" ? "" : `, gewählt: Serie ${state.selection}`
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
  summaryCenter = null,
  kind = "training",
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
    (i) => isDrawn(shots[i]) && (others === "dim" || selectedAt(i))
  )

  const circle =
    state.layers.circle && group.length >= SPREAD_MIN_SHOTS
      ? smallestEnclosingCircle(groupPoints)
      : null
  const confidence = state.layers.ellipse ? mpiConfidence(group) : null
  const center = state.layers.mpi && group.length >= 2 ? centroid(groupPoints) : null

  // eine Scheibe nur aus Probe heißt so, mit ihrer Art (eine Probe neben Wertung gibt es nicht)
  const probeOnly = shots.length > 0 && shots.every(isProbeShot)
  // ohne Schüsse mit Trefferlage als Summe nur die Mitte, keine „0 Wertungsschüsse“
  const label =
    shots.length === 0 && summaryCenter
      ? `${target.label}: Mitte der Schüsse`
      : `${target.label}: ${shots.length} ${
          probeOnly ? `Probeschüsse als ${KIND_TEXT[kind]}` : "Wertungsschüsse"
        }${selectionText(state)}${summaryCenter ? ", Mitte der Schüsse" : ""}`

  // die Scheibe zeigt das Probe-Eck, wenn alle Schüsse der Auswahl aus der Probe stammen (eine Scheibe nur aus Probe)
  const shown = shots.filter((_, i) => selectedAt(i))
  const showsProbe = shown.length > 0 && shown.every(isProbeShot)

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
      // Tippen auf die Scheibe markiert nicht die Ringzahlen
      className={`select-none ${className ?? ""}`}
      onClick={tap}
    >
      <style>{`
        .shot-ui-pop { animation: shot-ui-pop 260ms ease-out; transform-box: fill-box; transform-origin: center; }
        @keyframes shot-ui-pop { from { transform: scale(1.8); opacity: 0.2; } to { transform: scale(1); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .shot-ui-pop { animation: none; } }
      `}</style>
      <g data-layer="target">
        <TargetBoard target={target} view={view} ringLabel={sizes.ringLabel} probe={showsProbe} />
      </g>

      <g data-layer="shots">
        {order.map((i) => {
          const shot = shots[i]
          const faded = !selectedAt(i)
          const isChosen = i === chosen
          const x = mm(shot.xUm as number)
          const y = -mm(shot.yUm as number)
          const color = faded
            ? FADED_COLOR
            : shot.ring === null
              ? "var(--paper-line)"
              : scoreColor(shot.ring)
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
              <title>{`Schuss ${labels[i]}: ${formatShotValue(shot)}`}</title>
              <circle
                cx={x}
                cy={y}
                r={calR}
                fill={shot.ring === null ? "none" : color}
                fillOpacity={SHOT_FILL_OPACITY}
                // ohne Wert ist der Rand das ganze Zeichen: blass grau statt ganz weg
                stroke={faded ? (shot.ring === null ? FADED_COLOR : "none") : "var(--shot-edge)"}
                strokeWidth={1}
                strokeDasharray={shot.ring === null ? "2 2" : undefined}
                pointerEvents={hitArea}
                className={i === popIndex ? "shot-ui-pop" : undefined}
                {...HAIR}
              />
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
        {summaryCenter && (
          // Trefferlage als Summe: das Zeichen des Schwerpunkts an der Mitte, wie auf einer gemessenen Scheibe
          <MpiMark
            data-summary-center="true"
            x={mm(summaryCenter.xUm)}
            y={-mm(summaryCenter.yUm)}
            radius={sizes.mpiRadius}
          />
        )}
        {center && (
          // Schwerpunkt ganz oben: weiße Scheibe, zwei schwarze Viertel, Kontur mit hellem Saum
          <MpiMark
            data-overlay="mpi"
            x={mm(center.xUm)}
            y={-mm(center.yUm)}
            radius={sizes.mpiRadius}
          />
        )}
      </g>
    </svg>
  )
}
