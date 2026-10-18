/**
 * Höhe der klebenden Leisten oben, etwa Sprungleiste und Reiter der Analyse (`h-14`); Abschnitte und klebende Spalten
 * beginnen darunter
 */
export const BAR_PX = 56
/** Luft zwischen Inhalt und Fensterrand */
export const EDGE_PX = 16

/**
 * Die Klassen, die an der Höhe der Leiste hängen. Tailwind findet nur ganze Klassen im Quelltext, deshalb stehen sie
 * hier als Literale; `bar.test.ts` hält sie bei `BAR_PX`.
 */
export const JUMP_BAR = {
  height: "h-14",
  mdTop: "md:top-14",
  scrollMargin: "scroll-mt-14",
  /** zwei Leisten übereinander: Sprungleiste und Reiter der Analyse */
  mdScrollMarginTwo: "md:scroll-mt-28",
  /** mindestens das Fenster unter der Leiste hoch */
  screenBelow: "min-h-[calc(100svh-3.5rem)]",
} as const
