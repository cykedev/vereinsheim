import type { ReactNode } from "react"

/**
 * Der Rahmen einer Seite im Inhalt von `AppFrame` (wie die Ansichten im Labor): Breite, Rand und Platz über der unteren
 * Leiste an einer Stelle statt in jeder Seite
 */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto grid max-w-7xl gap-7 px-4 pt-7 pb-24 ${className ?? ""}`}>
      {children}
    </div>
  )
}
