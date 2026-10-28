import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { formatIsoDate } from "@vereinsheim/lib/format"

import { EnteredCardForm } from "@/components/entered/EnteredCardForm"
import { isCardIdInput } from "@/lib/action-guards"
import { requireSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { detailsToForm } from "@/lib/entered/form"
import { cardForEdit, ownPlaces } from "@/lib/entered/queries"

export const metadata: Metadata = { title: "Eintrag ändern" }

// Eintrag ändern ([[adr-033]]): nur eine eigene, eingetragene Scheibe; was das Formular nicht ganz zeigen kann (Lage oder
// Zeit an Schüssen), bleibt auf der Seite der Scheibe, statt beim Speichern verloren zu gehen
export default async function EditEnteredCardRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireSession()
  const { id } = await params
  if (!isCardIdInput(id)) notFound()
  const timeZone = getDisplayTimeZone()
  const card = await cardForEdit(db, { cardId: id, ownerId: session.user.id, timeZone })
  if (!card) redirect(`/cards/${id}`)
  const initial = detailsToForm(card.stored, card.discipline, card)
  if (!initial) redirect(`/cards/${id}`)
  return (
    <EnteredCardForm
      mode="edit"
      cardId={card.id}
      discipline={card.discipline}
      kind={card.shownKind}
      initial={initial}
      places={await ownPlaces(db, session.user.id)}
      today={formatIsoDate(new Date(), timeZone)}
      back={`/cards/${id}`}
    />
  )
}
