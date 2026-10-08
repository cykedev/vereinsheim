// Sprung zur Scheibe mit Rücksprung (Plan Schritt 4, D6): reine Entscheidungen, die der Hook `useReturnJump`
// mit dem Fenster füttert.

/** so viel muss von der Scheibe sichtbar sein, damit sie als im Bild gilt (px) */
const VISIBLE_MIN_PX = 120

/** außer Sicht: von der Scheibe ist zwischen Leiste (`topInset`) und unterem Rand weniger als 120 px zu sehen */
export function isOutOfView(
  rect: { top: number; bottom: number },
  viewportHeight: number,
  topInset: number
): boolean {
  const visible = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, topInset)
  return visible < VISIBLE_MIN_PX
}

export interface ReturnState {
  /** Scrollstelle vor dem Sprung */
  origin: number
  /** man war schon weit genug weg (der Sprung selbst beginnt nahe der Ausgangsstelle) */
  away: boolean
}

/** die Pille verschwindet, wenn man nach dem Sprung selbst auf 200 px an die Ausgangsstelle zurückscrollt */
export function shouldDismiss(
  state: ReturnState,
  scrollY: number
): { dismiss: boolean; away: boolean } {
  const distance = Math.abs(scrollY - state.origin)
  return { dismiss: state.away && distance < 200, away: state.away || distance > 400 }
}
