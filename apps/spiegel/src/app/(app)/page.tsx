import { startModel } from "@vereinsheim/shot-ui/start/model"

import { StartScreen } from "@/components/start/StartScreen"
import { requireSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { marksOfCards, ownerCards } from "@/lib/db/reads"
import { pageContext } from "@/lib/page-context"
import { familiesOf, listable, withFamily } from "@/lib/pages"

// Start: der letzte Abend und die Form, nur aus den eigenen Scheiben. Gerechnet auf dem Server aus den Projektionen
// (ADR-031, SP-1.8); an den Browser gehen das Modell und die Lagen der Scheiben des Abends.
export default async function StartRoute() {
  const session = await requireSession()
  const ownerId = session.user.id
  const [cards, context] = await Promise.all([ownerCards(db, { ownerId }), pageContext(ownerId)])
  const shown = listable(cards)
  const families = familiesOf(shown)
  const model = startModel({
    cards: withFamily(shown),
    timeZone: context.timeZone,
    nowMs: context.nowMs,
    named: context.named,
    scoring: context.scoring,
    family: families[0]?.value ?? "",
  })
  const ids = model.blocks.flatMap((block) => block.rows.map((row) => row.id))
  const marks = await marksOfCards(db, { ownerId, ids })
  return <StartScreen model={model} marks={marks} families={families} context={context} />
}
