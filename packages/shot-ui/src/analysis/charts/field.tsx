import { ScaleBar } from "../parts"

// Feld um einen Punkt (Spielwiese `fieldFrame`, `scaleBar`): quadratisch, höchstens 260 px hoch, mittig in
// der Breite; µm nach Pixeln mit y nach oben. Mindestens 0,25 mm Ausdehnung, sonst wird der kleinste
// Maßstab (0,1 mm) länger als das Feld.

export interface FieldFrame {
  width: number
  size: number
  /** Pixel je µm */
  k: number
  cx: number
  cy: number
  X: (um: number) => number
  Y: (um: number) => number
}

const MIN_EXTENT_UM = 250

export function fieldFrame(width: number, extentUm: number): FieldFrame {
  const size = Math.min(width, 260)
  const half = size / 2 - 14
  const k = half / Math.max(extentUm, MIN_EXTENT_UM)
  const cx = width / 2
  const cy = size / 2
  return { width, size, k, cx, cy, X: (um) => cx + um * k, Y: (um) => cy - um * k }
}

/** Achsenkreuz durch die Mitte des Felds */
export function FieldAxes({ frame }: { frame: FieldFrame }) {
  const { width, size, cx, cy } = frame
  return (
    <>
      <line x1={cx} x2={cx} y1={8} y2={size - 8} stroke="var(--border)" />
      <line
        x1={(width - size) / 2 + 8}
        x2={(width + size) / 2 - 8}
        y1={cy}
        y2={cy}
        stroke="var(--border)"
      />
    </>
  )
}

/** Maßstab unten links im Feld für eine Spanne in µm */
export function FieldScale({ frame, spanUm }: { frame: FieldFrame; spanUm: number }) {
  return (
    <ScaleBar
      x={(frame.width - frame.size) / 2 + 12}
      y={frame.size - 10}
      spanMm={spanUm / 1000}
      pxPerMm={frame.k * 1000}
    />
  )
}
