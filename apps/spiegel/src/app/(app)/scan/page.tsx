import type { Metadata } from "next"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { formatIsoDate } from "@vereinsheim/lib/format"

import { ScanScreen } from "@/components/scan/ScanScreen"
import { requireSession } from "@/lib/auth-helpers"
import { requestSiteId } from "@/lib/card-requests/queries"
import { db } from "@/lib/db"
import { legacyRequests, newCardChoices } from "@/lib/fetch-card/queries"

export const metadata: Metadata = { title: "Scheibe holen" }

// Scheibe holen: Kamera, Link, PDF und getippte ID auf einer Seite; dazu die Wahl für eine neue Scheibe und ältere
// Aufträge, die noch auf die Anlage warten
export default async function ScanRoute() {
  const session = await requireSession()
  const userId = session.user.id
  const timeZone = getDisplayTimeZone()
  const siteId = await requestSiteId(db)
  const choices =
    siteId === null
      ? { options: [], preset: { disciplineId: null, kind: "training" as const } }
      : await newCardChoices(db, { userId, siteId })
  return (
    <ScanScreen
      options={choices.options}
      preset={choices.preset}
      legacy={await legacyRequests(db, userId)}
      today={formatIsoDate(new Date(), timeZone)}
      timeZone={timeZone}
    />
  )
}
