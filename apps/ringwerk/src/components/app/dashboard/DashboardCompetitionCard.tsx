import type { ReactNode } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@vereinsheim/ui/card"

interface Props {
  title: string
  // Kanonische Detailseite des Wettbewerbs — der Titel ist der Link (§7:
  // keine zusätzlichen "Details →"-Buttons).
  href: string
  badges?: ReactNode
  children: ReactNode
  // Anzahl der Zeilen, die die Vorschau nicht zeigt.
  moreCount?: number
}

// Ein aktiver Wettbewerb auf dem Dashboard: Kopf mit verlinktem Namen,
// darunter eine gekürzte Tabelle bzw. das Playoff-Bracket.
export function DashboardCompetitionCard({ title, href, badges, children, moreCount }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center gap-2">
        <CardTitle className="text-lg">
          <Link href={href} className="hover:underline">
            {title}
          </Link>
        </CardTitle>
        {badges}
      </CardHeader>
      <CardContent className="space-y-2">
        {children}
        {moreCount != null && moreCount > 0 && (
          <p className="text-sm text-muted-foreground">
            + {moreCount} weitere{" "}
            <Link href={href} className="underline hover:no-underline">
              anzeigen
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
