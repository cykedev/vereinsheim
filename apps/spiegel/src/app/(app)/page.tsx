import { StartScreen } from "@/components/start/StartScreen"
import { requireSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { startPageData } from "@/lib/overview"
import { pageContext } from "@/lib/page-context"

// Start: der letzte Abend und die Form, nur aus den eigenen Scheiben. Gerechnet auf dem Server aus den Projektionen
// (ADR-031, SP-1.8); an den Browser gehen das Modell und die Lagen der Scheiben des Abends.
export default async function StartRoute() {
  const session = await requireSession()
  const context = await pageContext(session.user.id)
  const { model, marks, families } = await startPageData(db, session.user.id, context)
  return <StartScreen model={model} marks={marks} families={families} context={context} />
}
