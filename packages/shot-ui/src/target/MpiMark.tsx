import type { SVGProps } from "react"

/** Linien bleiben 1 px breit, egal wie weit gezoomt ist */
const HAIR = { vectorEffect: "non-scaling-stroke" } as const

export interface MpiMarkProps extends Omit<SVGProps<SVGGElement>, "transform"> {
  x: number
  y: number
  /** Radius in Einheiten des Bildes (auf der Scheibe mm, in Diagrammen Pixel) */
  radius: number
  /** nur Schmuck neben einem Satz, der es schon sagt: ohne `<title>`, damit ein Screenreader ihn nicht mitliest */
  decorative?: boolean
}

/**
 * Schwerpunkt-Zeichen (spiegel-ui-design): weiße Scheibe, zwei schwarze Viertel, Kontur mit hellem Saum,
 * aus den Design-2-Tokens. Auf der Scheibe und in den Diagrammen der Analyse dasselbe Zeichen.
 */
export function MpiMark({ x, y, radius, decorative = false, ...rest }: MpiMarkProps) {
  return (
    <g {...rest} transform={`translate(${x} ${y}) scale(${radius})`}>
      {!decorative && <title>Schwerpunkt</title>}
      <circle r={1} fill="none" stroke="var(--mpi-halo)" strokeWidth={3} {...HAIR} />
      <circle r={1} fill="var(--mpi-light)" />
      <path d="M0 0L0-1A1 1 0 0 0-1 0ZM0 0L0 1A1 1 0 0 0 1 0Z" fill="var(--mpi-dark)" />
      <circle r={1} fill="none" stroke="var(--mpi-dark)" strokeWidth={1} {...HAIR} />
    </g>
  )
}
