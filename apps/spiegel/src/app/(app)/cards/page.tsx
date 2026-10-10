import type { Metadata } from "next"

import { ListScreen } from "@/components/list/ListScreen"
import { requireSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { ownerCardsWithShots } from "@/lib/db/reads"
import { pageContext } from "@/lib/page-context"
import { familiesOf, listable } from "@/lib/pages"

export const metadata: Metadata = { title: "Scheiben" }

// Scheiben: die eigenen nach Abend; Filter stehen in der Adresse und liest die Hülle
export default async function CardsRoute() {
  const session = await requireSession()
  const [cards, context] = await Promise.all([
    ownerCardsWithShots(db, session.user.id),
    pageContext(session.user.id),
  ])
  const shown = listable(cards)
  return <ListScreen cards={shown} families={familiesOf(shown)} context={context} />
}
