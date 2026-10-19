// Links aus den Bausteinen der Seite eines Zeitraums: Die App zeichnet sie (Spiegel als `RouteLink` mit seiner Adresse,
// Treffsicher als Link auf die Einheit), der Baustein gibt nur Klasse, Inhalt und Kennzeichen vor.

import type { ReactNode } from "react"

export interface PeriodLinkProps {
  className: string
  children: ReactNode
  /** Kennzeichen für Tests und Skriptprüfung, etwa `data-show-all` */
  [data: `data-${string}`]: string | boolean | undefined
}

/** ein Link auf eine Scheibe oder Einheit des Zeitraums */
export type RenderItemLink = (id: string, props: PeriodLinkProps) => ReactNode

/** ein Link ohne Bezug auf einen Eintrag, etwa „Alle in Scheiben zeigen“ */
export type RenderLink = (props: PeriodLinkProps) => ReactNode
