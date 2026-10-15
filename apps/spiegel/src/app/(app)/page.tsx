import { StartScreen } from "@/components/start/StartScreen"
import { requireSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { pendingFirstCards } from "@/lib/db/reads"
import { openItems, pendingItems } from "@/lib/open"
import { startPageData } from "@/lib/overview"
import { pageContext } from "@/lib/page-context"

// Start: der letzte Abend und die Form, nur aus den eigenen Scheiben. Gerechnet auf dem Server aus den Projektionen
// (ADR-031); an den Browser gehen das Modell und die Lagen der Scheiben des Abends.
export default async function StartRoute() {
  const session = await requireSession()
  const context = await pageContext(session.user.id)
  const [{ model, marks, families }, pending] = await Promise.all([
    startPageData(db, session.user.id, context),
    pendingFirstCards(db, session.user.id),
  ])
  const open = openItems(pendingItems(pending, context.timeZone))
  return (
    <StartScreen model={model} marks={marks} families={families} context={context} open={open} />
  )
}
