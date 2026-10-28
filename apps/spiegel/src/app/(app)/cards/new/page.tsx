import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { formatIsoDate } from "@vereinsheim/lib/format"

import { EnteredCardForm } from "@/components/entered/EnteredCardForm"
import { isRowId } from "@/lib/action-guards"
import { requireSession } from "@/lib/auth-helpers"
import { requestSiteId } from "@/lib/card-requests/queries"
import { db } from "@/lib/db"
import { emptyForm } from "@/lib/entered/form"
import { entryDiscipline, ownPlaces } from "@/lib/entered/queries"
import { newCardChoices } from "@/lib/fetch-card/queries"

export const metadata: Metadata = { title: "Ergebnis eintragen" }

// Ergebnis eintragen ([[adr-033]]): nach dem Blatt „Neue Scheibe“ in „Scheibe holen“, mit Disziplin und Art in der
// Adresse. Eine Disziplin, die nicht zur Wahl steht, führt zurück zu „Scheibe holen“; angelegt wird erst beim Speichern.
export default async function NewEnteredCardRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireSession()
  const query = await searchParams
  const disciplineId = Number(query.discipline)
  const kind = query.kind
  const siteId = await requestSiteId(db)
  if (siteId === null || !isRowId(disciplineId) || (kind !== "training" && kind !== "competition"))
    redirect("/scan")
  const discipline = await entryDiscipline(db, { siteId, disciplineId })
  if (!discipline) redirect("/scan")
  const timeZone = getDisplayTimeZone()
  const today = formatIsoDate(new Date(), timeZone)
  const { options } = await newCardChoices(db, { userId: session.user.id, siteId })
  return (
    <EnteredCardForm
      mode="new"
      discipline={discipline}
      kind={kind}
      initial={emptyForm(discipline, today)}
      places={await ownPlaces(db, session.user.id)}
      today={today}
      back="/scan"
      choices={{ options }}
    />
  )
}
