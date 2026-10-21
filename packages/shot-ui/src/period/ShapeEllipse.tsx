import type { PeriodShape } from "@vereinsheim/shot-core/analysis"

const HAIR = { vectorEffect: "non-scaling-stroke" } as const

/** Halbachsen aus der gepoolten Streuung: λ₁ + λ₂ = 2σ², λ₁/λ₂ = (Länge zu Breite)² */
export function shapeAxes(shape: Pick<PeriodShape, "sigmaUm" | "ratio">): {
  majorUm: number
  minorUm: number
} {
  const ratio = Number.isFinite(shape.ratio) ? shape.ratio : 1e3
  const minor2 = (2 * shape.sigmaUm ** 2) / (1 + ratio ** 2)
  return { majorUm: Math.sqrt(minor2) * ratio, minorUm: Math.sqrt(minor2) }
}

/**
 * Die Form über mehrere Scheiben (L9) als Gestalt, nicht als Ort: die Ellipse der gepoolten Streuung (doppelte
 * Halbachsen, dort liegen bei einer Normalgruppe etwa 86 % der Schüsse), ihre lange Seite und gestrichelt der Kreis
 * gleicher Streuung, so sähe eine runde Gruppe aus. Ohne Maßstab: Es geht um die Gestalt, die Zahlen stehen daneben.
 */
export function ShapeEllipse({
  shape,
}: {
  shape: Pick<PeriodShape, "sigmaUm" | "ratio" | "angleRad">
}) {
  const { majorUm, minorUm } = shapeAxes(shape)
  const scale = 40 / (2 * majorUm)
  const rx = 40
  const ry = Math.max(0.6, 2 * minorUm * scale)
  const round = 2 * shape.sigmaUm * scale
  const degrees = (shape.angleRad * 180) / Math.PI
  return (
    <svg
      viewBox="-50 -46 100 92"
      role="img"
      aria-label="Form der Gruppe über alle Scheiben"
      data-shape-ellipse
      className="mx-auto block h-auto w-full max-w-[18rem] select-none"
    >
      <g fill="none" stroke="var(--line-strong)" strokeWidth={1} {...HAIR}>
        <circle r={15} />
        <circle r={30} />
        <circle r={45} />
        <line x1={-48} x2={48} y1={0} y2={0} />
        <line x1={0} x2={0} y1={-45} y2={45} />
      </g>
      <circle
        data-shape-round
        r={round}
        fill="none"
        stroke="var(--muted-foreground)"
        strokeWidth={1.2}
        strokeDasharray="3 3"
        {...HAIR}
      />
      <g transform={`rotate(${-degrees})`}>
        <ellipse
          rx={rx}
          ry={ry}
          fill="var(--primary)"
          fillOpacity={0.18}
          stroke="var(--primary)"
          strokeWidth={1.5}
          {...HAIR}
        />
        <line x1={-rx} x2={rx} y1={0} y2={0} stroke="var(--primary)" strokeWidth={1} {...HAIR} />
      </g>
    </svg>
  )
}
