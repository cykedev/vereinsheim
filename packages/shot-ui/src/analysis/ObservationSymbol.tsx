// Symbol einer Beobachtung: im Überblick der Analyse und im Kopf der Scheibe

import type { ObservationIcon } from "./observations"

/** Symbole der Beobachtungen (24er-Raster, Linien) */
const ICONS: Readonly<Record<ObservationIcon, string[]>> = {
  position: [
    "M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17",
    "M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4",
  ],
  spread: [
    "M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17",
    "M12 10.4a1.6 1.6 0 1 0 0 3.2a1.6 1.6 0 1 0 0-3.2",
  ],
  outlier: [
    "M9.5 8a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11",
    "M19 3.2a1.8 1.8 0 1 0 0 3.6a1.8 1.8 0 1 0 0-3.6",
  ],
  trend: ["M3 16.5l5.5-5.5 4 4L20 7.5", "M14.5 7.5H20V13"],
  pause: ["M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17", "M10 9v6M14 9v6"],
  clock: ["M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17", "M12 7.5V12l3 2"],
}

export function ObservationSymbol({ icon }: { icon: ObservationIcon }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 size-[18px] shrink-0 text-primary"
    >
      {ICONS[icon].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
