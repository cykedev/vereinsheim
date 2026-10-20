"use client"

import { useEffect, useRef, type ReactNode } from "react"

import { CONN_W, SLOT_W } from "./constants"

/**
 * Der seitlich scrollende Rahmen des Turnierbaums: Ist er schmaler als der Baum (Telefon), steht beim Öffnen die
 * laufende Runde (`column`) links im Bild statt der ersten. Die Seite selbst scrollt nie seitlich.
 */
export function ScrollToColumn({ column, children }: { column: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = ref.current
    if (!box || column <= 0 || box.scrollWidth <= box.clientWidth) return
    box.scrollLeft = column * (SLOT_W + CONN_W)
  }, [column])
  return (
    <div ref={ref} data-bracket-scroll className="overflow-x-auto">
      {children}
    </div>
  )
}
