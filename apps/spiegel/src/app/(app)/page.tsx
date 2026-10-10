import { StartScreen } from "@/components/start/StartScreen"
import { requireSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { ownerCardsWithShots } from "@/lib/db/reads"
import { pageContext } from "@/lib/page-context"
import { familiesOf, listable } from "@/lib/pages"

// Start: der letzte Abend und die Form, nur aus den eigenen Scheiben
export default async function StartRoute() {
  const session = await requireSession()
  const [cards, context] = await Promise.all([
    ownerCardsWithShots(db, session.user.id),
    pageContext(session.user.id),
  ])
  const shown = listable(cards)
  return <StartScreen cards={shown} families={familiesOf(shown)} context={context} />
}
