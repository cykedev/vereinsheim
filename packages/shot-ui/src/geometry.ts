// Geometrie der Scheibe in Millimetern (SVG-Koordinaten, y nach unten) und die Regeln, die in
// Bildschirm-Pixeln bemessen sind. Werte wie in spiegel-ui-design „Zeichnen der Scheibe“.

import { smallestEnclosingCircle, type Point } from "@vereinsheim/shot-core/geometry"
import type { TargetImage } from "@vereinsheim/shot-core/targets"

import type { ViewBox } from "./types"

const mm = (um: number) => um / 1000

/** halbes Kaliber in mm: Radius eines Treffers */
export const caliberRadius = (target: TargetImage) => mm(target.caliberUm) / 2

/** die ganze Scheibe: Ring 1 plus 10 % Rand, mindestens 4 mm */
export function targetView(target: TargetImage): ViewBox {
  const outer = mm(target.ringRadiiUm[0])
  const half = outer + Math.max(4, outer * 0.1)
  return { x: -half, y: -half, w: 2 * half }
}

/**
 * Die Gruppe: Streukreis plus halbes Kaliber, um 30 % erweitert, mindestens fünf halbe Kaliber. Die
 * Punkte wählt der Aufrufer (Wertung, Auswahl); ohne Punkte die ganze Scheibe.
 */
export function groupView(target: TargetImage, points: readonly Point[]): ViewBox {
  const circle = smallestEnclosingCircle(points)
  if (!circle) return targetView(target)
  const calR = caliberRadius(target)
  const half = Math.max((mm(circle.radiusUm) + calR) * 1.3, calR * 5)
  return { x: mm(circle.xUm) - half, y: -mm(circle.yUm) - half, w: 2 * half }
}

/** Millimeter je Bildschirm-Pixel; ohne gemessene Breite wie bei 600 px */
export const unitsPerPixel = (view: ViewBox, widthPx: number) =>
  view.w / (widthPx > 0 ? widthPx : 600)

export interface ScreenSizes {
  /** Schussnummer: 8–12 px, etwa halb so groß wie der Treffer auf dem Schirm */
  numberFont: number
  /** dunkler Saum der Nummer */
  numberHalo: number
  /** Radius des Schwerpunkt-Symbols: 5–8 px, kleiner als ein Treffer */
  mpiRadius: number
  /** Ringzahl: höchstens 12 px und nie größer als 62 % des Rings */
  ringLabel: number
  /** Luft zwischen Treffern und Streukreis: 2 px */
  spreadGap: number
}

/** alles, was beim Zoomen gleich groß auf dem Schirm bleibt, in mm für den aktuellen Maßstab */
export function screenSizes(target: TargetImage, unitsPerPx: number): ScreenSizes {
  const calR = caliberRadius(target)
  const shotPx = calR / unitsPerPx
  const numberPx = Math.max(8, Math.min(12, ((2 * calR) / unitsPerPx) * 0.52))
  return {
    numberFont: numberPx * unitsPerPx,
    numberHalo: 2.4 * unitsPerPx,
    mpiRadius: Math.max(5, Math.min(8, shotPx * 0.55)) * unitsPerPx,
    ringLabel: Math.min(mm(target.ringWidthUm) * 0.62, 12 * unitsPerPx),
    spreadGap: 2 * unitsPerPx,
  }
}

/** Deckkraft eines Treffers: kräftig, aber Ringe und Treffer darunter bleiben sichtbar */
export const SHOT_FILL_OPACITY = 0.9

/** Ringwert-Farbe als Token: 10 rot, 9 gold, 8 türkis, alles darunter violett (farbenblind geprüft) */
export function scoreColor(ring: number): string {
  if (ring >= 10) return "var(--score-10)"
  if (ring === 9) return "var(--score-9)"
  if (ring === 8) return "var(--score-8)"
  return "var(--score-7)"
}

/** weitester Treffer in x oder y plus halbes Kaliber, in mm; ohne Treffer −∞ */
const reachMm = (target: TargetImage, points: readonly Point[]) =>
  Math.max(-Infinity, ...points.map((p) => Math.max(Math.abs(mm(p.xUm)), Math.abs(mm(p.yUm))))) +
  caliberRadius(target)

/**
 * Ein gemeinsamer Ausschnitt um die Mitte für alle kleinen Scheiben, damit Lage und Streuung der Serien
 * vergleichbar sind: weitester Treffer (in x oder y) plus halbes Kaliber, 12 % Luft, mindestens sechs
 * halbe Kaliber, höchstens Ring 1 plus halbes Kaliber.
 */
export function seriesTileView(target: TargetImage, points: readonly Point[]): ViewBox {
  const calR = caliberRadius(target)
  const half = Math.min(
    mm(target.ringRadiiUm[0]) + calR,
    Math.max(reachMm(target, points) * 1.12, calR * 6)
  )
  return { x: -half, y: -half, w: 2 * half }
}

/** halbe Breite einer kleinen Scheibe für sich, gemessen am Radius des Spiegels */
const MINI_SPIEGEL = 1.6

/**
 * Ausschnitt einer kleinen Scheibe, die für sich steht (Start, Liste, Ablesung, Offen): um die Mitte, und der Spiegel
 * ist überall gleich groß (halbe Breite = Radius des Spiegels × 1,6). So stehen die Spiegel nebeneinander auf einer
 * Linie, und eine Scheibe sieht überall gleich aus. Nur ein Treffer weiter außen vergrößert den Ausschnitt, weiter um
 * die Mitte: weitester Treffer (in x oder y) plus halbes Kaliber, 12 % Luft, höchstens Ring 1 plus halbes Kaliber.
 */
export function miniView(target: TargetImage, points: readonly Point[]): ViewBox {
  const spiegel = mm(target.ringRadiiUm[target.blackFromRing - 1]) * MINI_SPIEGEL
  const half = Math.min(
    mm(target.ringRadiiUm[0]) + caliberRadius(target),
    Math.max(spiegel, reachMm(target, points) * 1.12)
  )
  return { x: -half, y: -half, w: 2 * half }
}

/**
 * Spalten für die kleinen Scheiben: so viele, wie bei 60 px plus Abstand (70 px) passen, dann auf die
 * nötigen Zeilen gleichmäßig verteilt, damit keine Kachel allein in der letzten Zeile steht.
 */
export function tileColumns(count: number, widthPx: number): number {
  if (count < 1) return 1
  const most = Math.max(1, Math.floor((widthPx + 10) / 70))
  const rows = Math.ceil(count / most)
  return Math.max(1, Math.ceil(count / rows))
}

/** Reichweite eines Tipps in Bildschirm-Pixeln: etwa eine Fingerkuppe */
export const TAP_REACH_PX = 20

export interface TapTarget {
  index: number
  x: number
  y: number
}

/**
 * Antippen (spiegel-ui-design): der Treffer, dessen Mitte dem Tipp am nächsten liegt, sofern sie höchstens
 * `reach` entfernt ist (gleiche Einheit wie die Lagen). Auf dem Handy misst ein Treffer auf der ganzen
 * Scheibe nur wenige Pixel, so muss man ihn nicht genau treffen. Bei gleichem Abstand gewinnt der spätere,
 * also der oben gezeichnete; die Treffer kommen in Zeichenreihenfolge.
 */
export function nearestShot(
  targets: readonly TapTarget[],
  tap: { x: number; y: number },
  reach: number
): number | null {
  let best: number | null = null
  let bestDistance = Infinity
  for (const target of targets) {
    const distance = Math.hypot(target.x - tap.x, target.y - tap.y)
    if (distance <= reach && distance <= bestDistance) {
      best = target.index
      bestDistance = distance
    }
  }
  return best
}

/** Schenkel des Probe-Ecks als Anteil der Breite des Ausschnitts */
const PROBE_CORNER = 0.12

/**
 * Probe-Eck (Konvention der Probescheibe): ein schwarzes Dreieck oben rechts im Ausschnitt, als Punkte
 * für ein SVG-Polygon. Es hängt am Ausschnitt, nicht an der Scheibe, damit es auch gezoomt oben rechts
 * sitzt und auf dem Schirm gleich groß bleibt.
 */
export function probeCorner(view: ViewBox): string {
  const leg = view.w * PROBE_CORNER
  const right = view.x + view.w
  return `${right - leg},${view.y} ${right},${view.y} ${right},${view.y + leg}`
}
