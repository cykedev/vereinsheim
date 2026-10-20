import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { routeFromUrl } from "@vereinsheim/shot-ui/nav/routes"

import { CardScreen } from "@/components/card/CardScreen"
import { SharedShell } from "@/components/share/SharedShell"
import { db } from "@/lib/db"
import { sharedCard } from "@/lib/db/reads"
import { sharedPageContext } from "@/lib/page-context"
import { isShareId, sharePath } from "@/lib/share"
import { targetDisplay } from "@/lib/target-display"

export const metadata: Metadata = {
  title: "Geteilte Scheibe",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

// Eine geteilte Scheibe: ohne Anmeldung (`proxy.ts` lässt `/share/` frei), ohne Rahmen der App, nur Ansicht
// (`own={null}`). Der Link allein öffnet sie; ist das Teilen beendet, kommt der Hinweis aus `not-found.tsx`.
export default async function SharedCardPage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params
  if (!isShareId(shareId)) notFound()
  const card = await sharedCard(db, shareId)
  if (!card?.targetId) notFound()
  // ohne Herkunft und ohne Abfrage: die Scheibe öffnet in ihrer Wertung, Serie und Schuss wählt man auf der Seite
  const route = routeFromUrl(`/cards/${encodeURIComponent(card.id)}`, "", "")
  if (route.page !== "card") notFound()
  return (
    <SharedShell>
      <CardScreen
        card={card}
        route={route}
        own={null}
        path={sharePath(shareId)}
        context={sharedPageContext()}
        display={await targetDisplay()}
        key={card.id}
      />
    </SharedShell>
  )
}
